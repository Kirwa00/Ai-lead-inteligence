"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, FormEvent } from "react";
import { signIn } from "next-auth/react";
import AuthShell, { authInputClass, authButtonClass } from "@/components/layout/AuthShell";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    if (password !== fd.get("confirm")) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not reset your password.");

      // The email in the token is now proven; sign them straight in rather than
      // making them retype the password they just set.
      const email = (fd.get("email") as string)?.trim();
      const result = await signIn("credentials", { email, password, redirect: false });
      router.push(result?.error ? "/login" : "/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset your password.");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Invalid reset link"
        footer={
          <Link href="/forgot-password" className="text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-body-sm text-on-surface-variant">
          This link is missing its token. Request a fresh reset email and try again.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a password you haven't used before."
      footer={
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
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
        <div className="space-y-xs">
          <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
            New password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={authInputClass}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-xs">
          <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
            Confirm new password
          </label>
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className={authInputClass}
            placeholder="Re-enter your password"
          />
        </div>

        {error && (
          <p className="flex items-center gap-xs text-error font-mono text-label-sm">
            <span className="material-symbols-outlined text-body-sm">error</span>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className={`${authButtonClass} mt-xl`}>
          <span className={`material-symbols-outlined text-body-sm${loading ? " animate-spin" : ""}`}>
            {loading ? "progress_activity" : "lock_reset"}
          </span>
          {loading ? "Updating…" : "Update Password"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
