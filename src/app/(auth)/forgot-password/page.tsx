"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import AuthShell, { authInputClass, authButtonClass } from "@/components/layout/AuthShell";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: fd.get("email") }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.devResetUrl) setDevUrl(data.devResetUrl);
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        sent
          ? undefined
          : "Enter your email and we'll send you a link to set a new password."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-md">
          <p className="flex items-start gap-xs text-body-sm text-on-surface">
            <span className="material-symbols-outlined text-primary text-body-md">mark_email_read</span>
            If that email has an account, a reset link is on its way. The link expires in 1 hour.
          </p>
          {devUrl && (
            <div className="rounded-xl border border-outline-variant bg-surface-container-high p-md">
              <p className="font-mono text-label-sm text-on-surface-variant mb-xs">
                Email delivery isn&apos;t configured, so here&apos;s your link:
              </p>
              <Link href={devUrl} className="font-mono text-label-sm text-primary break-all hover:underline">
                {devUrl}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form className="space-y-md" onSubmit={handleSubmit}>
          <div className="space-y-xs">
            <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={authInputClass}
              placeholder="you@company.com"
            />
          </div>
          <button type="submit" disabled={loading} className={`${authButtonClass} mt-xl`}>
            <span className={`material-symbols-outlined text-body-sm${loading ? " animate-spin" : ""}`}>
              {loading ? "progress_activity" : "send"}
            </span>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
