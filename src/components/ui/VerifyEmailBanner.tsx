"use client";

import { useState } from "react";

export default function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [devUrl, setDevUrl] = useState("");
  const [dismissed, setDismissed] = useState(false);

  async function resend() {
    setState("sending");
    try {
      const res = await fetch("/api/account/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send.");
      if (data.devVerifyUrl) setDevUrl(data.devVerifyUrl);
      setState("sent");
    } catch {
      setState("error");
    }
  }

  if (dismissed) return null;

  return (
    <div className="mb-lg rounded-xl border border-tertiary/30 bg-tertiary/5 px-lg py-md">
      <div className="flex flex-wrap items-center gap-md">
        <span className="material-symbols-outlined text-tertiary text-body-md">mark_email_unread</span>
        <p className="flex-1 min-w-[200px] text-body-sm text-on-surface">
          {state === "sent" ? (
            <>Confirmation sent to <span className="font-mono">{email}</span>. Check your inbox.</>
          ) : (
            <>Confirm your email <span className="font-mono">{email}</span> to secure your account.</>
          )}
        </p>
        {state !== "sent" && (
          <button
            onClick={resend}
            disabled={state === "sending"}
            className="font-mono text-label-sm font-bold text-primary hover:underline disabled:opacity-60"
          >
            {state === "sending" ? "Sending…" : state === "error" ? "Retry" : "Resend email"}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-body-sm">close</span>
        </button>
      </div>
      {devUrl && (
        <p className="mt-sm font-mono text-label-sm text-on-surface-variant break-all">
          Email delivery isn&apos;t configured —{" "}
          <a href={devUrl} className="text-primary hover:underline">
            confirm directly
          </a>
        </p>
      )}
    </div>
  );
}
