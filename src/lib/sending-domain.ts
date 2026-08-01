import { prisma } from "@/lib/prisma";
import { resendConfigured } from "@/lib/email-sender";

/**
 * Per-workspace outreach sending identity, backed by Resend's Domains API.
 *
 * Customer domains are registered under the PLATFORM's Resend account — that's
 * the standard SaaS shape: we hold the API key, each workspace proves ownership
 * of its own domain by publishing DNS records.
 *
 * Only outreach uses this. Transactional mail (invites, password resets, email
 * verification) keeps the platform's own from-address on purpose.
 */

const API = "https://api.resend.com/domains";

/** One DNS row the customer has to publish. Shape mirrors Resend's response. */
export type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
};

export type DomainStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failure"
  | "temporary_failure";

/** Verified is the only state we'll actually send customer outreach from. */
export function isUsable(status: string): boolean {
  return status === "verified";
}

/** Human-facing summary of a status, used by the Settings card. */
export function describeStatus(status: string): string {
  switch (status) {
    case "verified":
      return "Verified — outreach sends from your domain.";
    case "pending":
    case "not_started":
      return "Waiting on DNS. Publish the records below, then hit Verify. Propagation can take up to 72 hours, though it's usually minutes.";
    case "temporary_failure":
      return "Couldn't confirm the records yet — this often clears on its own. Try Verify again shortly.";
    case "failure":
      return "Verification failed. Double-check the records match exactly, then try again.";
    default:
      return "Unknown status.";
  }
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${(process.env.RESEND_API_KEY ?? "").trim()}`,
    "content-type": "application/json",
  };
}

async function resendFetch(path: string, init?: RequestInit) {
  if (!resendConfigured()) {
    throw new Error("Email sending isn't configured on the server yet.");
  }
  const res = await fetch(`${API}${path}`, { ...init, headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error?.message || `Resend ${res.status}`);
  }
  return data;
}

/** A domain is only ever one label + TLD here; reject URLs, emails, paths. */
export function normalizeDomain(input: string): string | null {
  const d = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  return d;
}

export async function registerDomain(organizationId: string, domain: string) {
  const created = await resendFetch("", {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });

  return prisma.sendingDomain.upsert({
    where: { organizationId },
    create: {
      organizationId,
      domain,
      providerDomainId: created.id ?? null,
      status: created.status ?? "pending",
      dnsRecords: created.records ?? [],
      lastCheckedAt: new Date(),
    },
    update: {
      domain,
      providerDomainId: created.id ?? null,
      status: created.status ?? "pending",
      dnsRecords: created.records ?? [],
      lastCheckedAt: new Date(),
    },
  });
}

/**
 * Ask Resend to re-check DNS, then read the authoritative status back. The
 * verify call itself only kicks off the check, so the follow-up GET is what
 * tells us where it actually landed.
 */
export async function refreshDomain(organizationId: string) {
  const record = await prisma.sendingDomain.findUnique({ where: { organizationId } });
  if (!record?.providerDomainId) return record;

  await resendFetch(`/${record.providerDomainId}/verify`, { method: "POST" }).catch(() => {
    // Already-verified domains can reject a re-verify; the GET below still
    // gives us the truth, so this isn't fatal.
  });

  const fresh = await resendFetch(`/${record.providerDomainId}`);

  return prisma.sendingDomain.update({
    where: { organizationId },
    data: {
      status: fresh.status ?? record.status,
      dnsRecords: fresh.records ?? record.dnsRecords ?? [],
      lastCheckedAt: new Date(),
    },
  });
}

export async function removeDomain(organizationId: string) {
  const record = await prisma.sendingDomain.findUnique({ where: { organizationId } });
  if (!record) return;

  if (record.providerDomainId) {
    // Best-effort: if it's already gone upstream, still clear our own row.
    await resendFetch(`/${record.providerDomainId}`, { method: "DELETE" }).catch((err) =>
      console.error("[sending-domain] provider delete failed:", err)
    );
  }
  await prisma.sendingDomain.delete({ where: { organizationId } });
}

/** `Name <local@domain>` if this workspace has a verified domain, else null. */
export async function resolveOutreachFrom(organizationId: string): Promise<string | null> {
  const record = await prisma.sendingDomain.findUnique({ where: { organizationId } });
  if (!record || !isUsable(record.status)) return null;

  const address = `${record.fromLocalPart}@${record.domain}`;
  return record.fromName ? `${record.fromName} <${address}>` : address;
}
