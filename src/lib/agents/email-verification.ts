import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TX_OPTS } from "@/lib/agents/shared";
import { debitForLookups, getBalanceMicros } from "@/lib/wallet";
import { flatChargeMicros, providerLookupRawMicros } from "@/lib/billing";
import { hunterVerifyEmail, verificationProviderConfigured, type EmailStatus } from "@/lib/data-providers";
import type { AgentContext, AgentResult } from "@/lib/agents";

// Syntactic + heuristic email validation — the free path, used when no
// verification provider is configured or the wallet can't cover the lookups.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLE_PREFIXES = ["info", "admin", "sales", "support", "contact", "hello", "team", "office"];

export function classify(email: string | null): "valid" | "risky" | "invalid" {
  if (!email || !EMAIL_RE.test(email)) return "invalid";
  const local = email.split("@")[0].toLowerCase();
  if (ROLE_PREFIXES.includes(local)) return "risky"; // role inbox, not a person
  return "valid";
}

const VERIFY_CONCURRENCY = 4;
const LOOKUP = "hunter/email-verifier";

export async function runEmailVerification(ctx: AgentContext): Promise<AgentResult> {
  const leads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id, contactId: { not: null } },
    include: { contact: true },
  });
  const contacts = leads.map((l) => l.contact).filter((c): c is NonNullable<typeof c> => !!c);
  if (contacts.length === 0) return { summary: "No contacts to verify — run Contact Discovery first." };

  const statuses = new Map<string, EmailStatus>();
  let checked = 0;
  let failed = 0;
  let mode: "provider" | "heuristic" | "no_credits" = "heuristic";

  // Syntactically invalid addresses never reach the paid provider.
  const candidates = contacts.filter((c) => {
    const s = classify(c.email);
    if (s === "invalid") statuses.set(c.id, "invalid");
    return s !== "invalid";
  });

  if (verificationProviderConfigured() && candidates.length > 0) {
    const needed = flatChargeMicros(providerLookupRawMicros(LOOKUP) * BigInt(candidates.length));
    const balance = await getBalanceMicros(ctx.organizationId);
    if (balance >= needed) {
      mode = "provider";
      let cursor = 0;
      const worker = async () => {
        while (cursor < candidates.length) {
          const c = candidates[cursor++];
          try {
            const r = await hunterVerifyEmail(c.email!);
            statuses.set(c.id, r.status);
            checked += 1;
          } catch (err) {
            failed += 1;
            console.error(`[email-verification] provider check failed for contact ${c.id}:`, err);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(VERIFY_CONCURRENCY, candidates.length) }, worker));
    } else {
      mode = "no_credits";
    }
  }

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let valid = 0;
  for (const c of contacts) {
    const status = statuses.get(c.id) ?? classify(c.email);
    if (status === "valid") valid += 1;
    writes.push(prisma.contact.update({ where: { id: c.id }, data: { emailStatus: status } }));
  }
  await prisma.$transaction(writes, TX_OPTS);

  if (checked > 0) {
    try {
      await debitForLookups({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        feature: "email_verification",
        agentType: "email_verification",
        lookup: LOOKUP,
        count: checked,
      });
    } catch (err) {
      console.error("[email-verification] lookup metering failed:", err);
    }
  }

  const n = `${contacts.length} email${contacts.length === 1 ? "" : "s"}`;
  if (mode === "provider") {
    const tail = failed > 0 ? ` (${failed} check${failed === 1 ? "" : "s"} failed, fell back to heuristics)` : "";
    return { summary: `Verified ${n} against live mailbox data — ${valid} deliverable${tail}.` };
  }
  if (mode === "no_credits") {
    return { summary: `Checked ${n} heuristically — ${valid} look valid. Top up credits for live deliverability checks.` };
  }
  return { summary: `Verified ${n} — ${valid} valid.` };
}
