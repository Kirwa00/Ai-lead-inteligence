"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type DnsRow = {
  record?: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
};

export type SendingDomainView = {
  domain: string;
  status: string;
  dnsRecords: DnsRow[];
  fromLocalPart: string;
  fromName: string | null;
  lastCheckedAt: string | null;
} | null;

const STATUS_STYLE: Record<string, string> = {
  verified: "text-primary bg-primary/10 border-primary/20",
  pending: "text-secondary bg-secondary/10 border-secondary/20",
  not_started: "text-secondary bg-secondary/10 border-secondary/20",
  temporary_failure: "text-secondary bg-secondary/10 border-secondary/20",
  failure: "text-error bg-error/10 border-error/20",
};

function statusBlurb(status: string): string {
  switch (status) {
    case "verified":
      return "Verified — outreach sends from your domain.";
    case "pending":
    case "not_started":
      return "Waiting on DNS. Publish the records below, then hit Verify. Usually minutes, occasionally up to 72 hours.";
    case "temporary_failure":
      return "Couldn't confirm the records yet — this often clears on its own. Try Verify again shortly.";
    case "failure":
      return "Verification failed. Check the records match exactly, then try again.";
    default:
      return "";
  }
}

export default function SendingDomainCard({
  initial,
  isOwner,
  resendConfigured,
}: {
  initial: SendingDomainView;
  isOwner: boolean;
  resendConfigured: boolean;
}) {
  const router = useRouter();
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const verified = initial?.status === "verified";

  async function call(action: string, run: () => Promise<Response>) {
    setBusy(action);
    setError("");
    try {
      const res = await run();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  if (!resendConfigured) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        Email sending isn&apos;t configured on the server yet, so a domain can&apos;t be verified.
        Set <span className="font-mono text-on-surface">RESEND_API_KEY</span> first.
      </p>
    );
  }

  if (!isOwner) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        {initial
          ? `Outreach sends from ${initial.fromLocalPart}@${initial.domain} (${initial.status}).`
          : "No sending domain set up yet."}{" "}
        Only the workspace owner can change this.
      </p>
    );
  }

  // ── Not set up yet ────────────────────────────────────────────────────────
  if (!initial) {
    return (
      <div className="space-y-md">
        <p className="text-body-sm text-on-surface-variant">
          Until you verify a domain, outreach goes out from a shared address that only reaches
          your own inbox — prospects won&apos;t receive it. Add a domain you own to send as
          yourself.
        </p>
        <form
          className="flex flex-wrap gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            call("create", () =>
              fetch("/api/sending-domain", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ domain: domainInput }),
              })
            );
          }}
        >
          <input
            required
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="acme.com"
            className="flex-1 min-w-[200px] bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!!busy}
            className="px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-sm font-bold rounded-lg hover:brightness-105 transition-all active:scale-95 disabled:opacity-60"
          >
            {busy === "create" ? "Adding…" : "Add Domain"}
          </button>
        </form>
        {error && <p className="font-mono text-label-sm text-error">{error}</p>}
      </div>
    );
  }

  // ── Set up: show status, identity, and the DNS records to publish ─────────
  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div>
          <div className="flex items-center gap-sm">
            <span className="text-body-md font-semibold text-on-surface">{initial.domain}</span>
            <span
              className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${
                STATUS_STYLE[initial.status] ?? STATUS_STYLE.pending
              }`}
            >
              {initial.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-xs max-w-prose">
            {statusBlurb(initial.status)}
          </p>
        </div>
        <div className="flex gap-sm shrink-0">
          <button
            onClick={() => call("verify", () => fetch("/api/sending-domain/verify", { method: "POST" }))}
            disabled={!!busy}
            className="px-md py-sm border border-outline-variant text-on-surface-variant font-mono text-label-sm rounded-lg hover:border-primary hover:text-primary transition-colors disabled:opacity-60"
          >
            {busy === "verify" ? "Checking…" : "Verify"}
          </button>
          <button
            onClick={() => {
              if (!confirm(`Remove ${initial.domain}? Outreach will fall back to the shared sender.`)) return;
              call("delete", () => fetch("/api/sending-domain", { method: "DELETE" }));
            }}
            disabled={!!busy}
            className="px-md py-sm border border-error/40 text-error font-mono text-label-sm rounded-lg hover:bg-error/10 transition-colors disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>

      {/* From-address identity */}
      <form
        className="space-y-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          call("identity", () =>
            fetch("/api/sending-domain", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                fromLocalPart: fd.get("fromLocalPart"),
                fromName: fd.get("fromName"),
              }),
            })
          );
        }}
      >
        <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
          Outreach sends as
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <input
            name="fromName"
            defaultValue={initial.fromName ?? ""}
            placeholder="Display name (optional)"
            className="flex-1 min-w-[160px] bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-xs">
            <input
              name="fromLocalPart"
              defaultValue={initial.fromLocalPart}
              className="w-32 bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="font-mono text-body-sm text-on-surface-variant">@{initial.domain}</span>
          </div>
          <button
            type="submit"
            disabled={!!busy}
            className="px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-sm font-bold rounded-lg hover:brightness-105 transition-all active:scale-95 disabled:opacity-60"
          >
            {busy === "identity" ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {/* DNS records */}
      {!verified && initial.dnsRecords.length > 0 && (
        <div className="space-y-sm">
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
            Add these DNS records at your registrar
          </div>
          <div className="overflow-x-auto border border-outline-variant rounded-xl">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-lowest text-left">
                  <th className="px-md py-sm font-mono text-label-sm text-on-surface-variant uppercase">Type</th>
                  <th className="px-md py-sm font-mono text-label-sm text-on-surface-variant uppercase">Name</th>
                  <th className="px-md py-sm font-mono text-label-sm text-on-surface-variant uppercase">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {initial.dnsRecords.map((r, i) => (
                  <tr key={i} className="bg-surface-container-high align-top">
                    <td className="px-md py-sm font-mono text-label-sm text-on-surface">{r.type}</td>
                    <td className="px-md py-sm font-mono text-label-sm text-on-surface break-all">{r.name}</td>
                    <td className="px-md py-sm font-mono text-label-sm text-on-surface-variant break-all">
                      {r.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Records live at your DNS provider (the registrar the domain is with), not here.
          </p>
        </div>
      )}

      {error && <p className="font-mono text-label-sm text-error">{error}</p>}
    </div>
  );
}
