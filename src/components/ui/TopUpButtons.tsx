"use client";

import { useState } from "react";
import { CREDIT_PACKAGES, approxRuns } from "@/lib/packages";

const PROVIDERS = [
  { id: "stripe", label: "Card", icon: "credit_card", endpoint: "/api/billing/stripe/checkout" },
  { id: "flutterwave", label: "M-Pesa / Card", icon: "smartphone", endpoint: "/api/billing/flutterwave/checkout" },
] as const;

export default function TopUpButtons() {
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]["id"]>("stripe");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const endpoint = PROVIDERS.find((p) => p.id === provider)!.endpoint;

  async function buy(pkgId: string) {
    setError("");
    setLoadingId(pkgId);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: pkgId }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Could not start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-md">
      {/* Provider choice */}
      <div className="flex items-center gap-xs">
        {PROVIDERS.map((p) => {
          const active = provider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`flex items-center gap-xs px-md py-xs rounded-lg font-mono text-label-sm border transition-colors ${
                active
                  ? "text-primary bg-primary/10 border-primary/30"
                  : "text-on-surface-variant border-outline-variant hover:border-primary/40"
              }`}
            >
              <span className="material-symbols-outlined text-body-sm">{p.icon}</span>
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {CREDIT_PACKAGES.map((pkg) => (
          <div
            key={pkg.id}
            className={`rounded-xl border p-lg flex flex-col gap-sm ${
              pkg.highlight ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-high"
            }`}
          >
            {pkg.highlight && (
              <span className="self-start font-mono text-label-sm px-sm py-xs rounded border text-primary bg-primary/10 border-primary/20">
                Popular
              </span>
            )}
            <div className="text-body-md font-semibold text-on-surface">{pkg.name}</div>
            <div className="text-display-sm font-bold text-on-surface">${pkg.priceUsd}</div>
            <div className="font-mono text-label-sm text-on-surface-variant">
              ~{approxRuns(pkg.priceUsd).toLocaleString()} research runs
            </div>
            <button
              onClick={() => buy(pkg.id)}
              disabled={loadingId !== null}
              className="mt-auto px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingId === pkg.id ? "Redirecting…" : "Top up"}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="flex items-center gap-xs font-mono text-label-sm text-error">
          <span className="material-symbols-outlined text-body-sm">error</span>
          {error}
        </p>
      )}
      <p className="font-mono text-label-sm text-on-surface-variant">
        Card payments via Stripe; M-Pesa &amp; local cards via Flutterwave. Both in secure hosted checkout.
      </p>
    </div>
  );
}
