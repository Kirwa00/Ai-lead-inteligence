"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    const password = fd.get("password") as string;

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email,
        password,
        workspace: fd.get("workspace"),
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not create your account.");
      setLoading(false);
      return;
    }

    // Account created — sign the new user straight in.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      // Created but auto sign-in failed; send them to the login page.
      router.push("/login");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-lg">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-sm mb-2xl justify-center">
          <div className="w-10 h-10 bg-primary-container rounded-xl flex items-center justify-center">
            <span
              className="material-symbols-outlined text-on-primary-container text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              bolt
            </span>
          </div>
          <div>
            <div className="font-bold text-primary text-headline-sm leading-none">A1 Intelligence</div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
              Command Center
            </div>
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-2xl ai-glow">
          <h1 className="text-headline-md font-bold text-on-surface mb-xs">Create your account</h1>
          <p className="text-body-sm text-on-surface-variant mb-xl">
            Spin up your own AI lead generation workspace.
          </p>

          <form className="space-y-md" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
                Full name
              </label>
              <input
                name="name"
                type="text"
                required
                autoComplete="name"
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant"
                placeholder="Jane Mwangi"
              />
            </div>
            <div className="space-y-xs">
              <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
                Workspace name <span className="opacity-60">(optional)</span>
              </label>
              <input
                name="workspace"
                type="text"
                autoComplete="organization"
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant"
                placeholder="Acme Growth"
              />
            </div>
            <div className="space-y-xs">
              <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant"
                placeholder="you@company.com"
              />
            </div>
            <div className="space-y-xs">
              <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant"
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <p className="flex items-center gap-xs text-error font-mono text-label-sm">
                <span className="material-symbols-outlined text-body-sm">error</span>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-container text-on-primary-container py-sm font-mono text-label-md font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-sm active:scale-95 transition-transform hover:brightness-105 mt-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span
                className={`material-symbols-outlined text-body-sm${loading ? " animate-spin" : ""}`}
              >
                {loading ? "progress_activity" : "person_add"}
              </span>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>
        </div>

        <p className="text-center font-mono text-label-sm text-on-surface-variant mt-lg">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
