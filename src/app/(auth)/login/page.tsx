"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
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
          <h1 className="text-headline-md font-bold text-on-surface mb-xs">Sign in</h1>
          <p className="text-body-sm text-on-surface-variant mb-xl">
            Access your AI lead generation platform.
          </p>

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
                autoComplete="current-password"
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-xl focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant"
                placeholder="••••••••"
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
                {loading ? "progress_activity" : "login"}
              </span>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-lg pt-lg border-t border-outline-variant flex items-center justify-center gap-md">
            <button className="flex items-center gap-sm px-md py-xs border border-outline-variant rounded-xl text-on-surface-variant font-mono text-label-sm hover:border-primary hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-body-sm">business</span>
              SSO Login
            </button>
          </div>
        </div>

        <p className="text-center font-mono text-label-sm text-on-surface-variant mt-lg">
          Demo:{" "}
          <span className="text-primary">admin@a1intel.com</span>
          {" / "}
          <span className="text-primary">demo1234</span>
        </p>
      </div>

      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />
    </div>
  );
}
