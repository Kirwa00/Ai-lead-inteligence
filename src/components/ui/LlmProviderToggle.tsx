"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";

type LlmProvider = "anthropic" | "deepseek";

type Props = {
  initialProvider: LlmProvider;
  available: Record<LlmProvider, boolean>;
  isOwner: boolean;
};

const PROVIDERS: {
  id: LlmProvider;
  label: string;
  model: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    model: "claude-sonnet-5",
    description: "Strong reasoning and structured JSON output.",
    icon: "psychology",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    model: "deepseek-chat",
    description: "Cost-efficient alternative for research and outreach.",
    icon: "hub",
  },
];

export default function LlmProviderToggle({ initialProvider, available, isOwner }: Props) {
  const router = useRouter();
  const [provider, setProvider] = useState<LlmProvider>(initialProvider);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string }>({ ok: true, msg: "" });

  async function select(next: LlmProvider) {
    if (next === provider || loading) return;
    if (!available[next]) {
      setStatus({
        ok: false,
        msg: `${next === "deepseek" ? "DeepSeek" : "Claude"} API key is not configured on the server.`,
      });
      return;
    }
    if (!isOwner) {
      setStatus({ ok: false, msg: "Only workspace owners can change the AI provider." });
      return;
    }

    setLoading(true);
    setStatus({ ok: true, msg: "" });
    try {
      const res = await fetch("/api/account/llm-provider", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update provider.");
      setProvider(next);
      setStatus({ ok: true, msg: `Switched to ${next === "deepseek" ? "DeepSeek" : "Claude"}.` });
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Could not update provider." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-md">
      <p className="text-body-sm text-on-surface-variant">
        Choose which AI model powers your agents. Both providers can be configured on the server — this setting
        only controls which one your workspace uses.
      </p>

      <div className="grid gap-sm sm:grid-cols-2">
        {PROVIDERS.map((p) => {
          const active = provider === p.id;
          const ready = available[p.id];
          return (
            <button
              key={p.id}
              type="button"
              disabled={loading || !isOwner}
              onClick={() => select(p.id)}
              className={clsx(
                "text-left p-md rounded-xl border transition-all",
                active
                  ? "border-primary bg-primary-container/30 ring-1 ring-primary"
                  : "border-outline-variant bg-surface-container-high hover:border-primary/50",
                !ready && "opacity-50 cursor-not-allowed",
                !isOwner && "cursor-default"
              )}
            >
              <div className="flex items-start gap-sm">
                <span
                  className={clsx(
                    "material-symbols-outlined text-headline-sm",
                    active ? "text-primary" : "text-on-surface-variant"
                  )}
                >
                  {p.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-xs">
                    <span className="font-semibold text-body-md text-on-surface">{p.label}</span>
                    {active && (
                      <span className="font-mono text-label-sm text-primary uppercase tracking-wider">Active</span>
                    )}
                  </div>
                  <p className="text-body-sm text-on-surface-variant mt-xs">{p.description}</p>
                  <p className="font-mono text-label-sm text-on-surface-variant mt-xs">{p.model}</p>
                  {!ready && (
                    <p className="font-mono text-label-sm text-error mt-xs">API key not configured</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {status.msg && (
        <p className={clsx("flex items-center gap-xs font-mono text-label-sm", status.ok ? "text-primary" : "text-error")}>
          <span className="material-symbols-outlined text-body-sm">{status.ok ? "check_circle" : "error"}</span>
          {status.msg}
        </p>
      )}

      {!isOwner && (
        <p className="font-mono text-label-sm text-on-surface-variant">
          Contact your workspace owner to change the AI provider.
        </p>
      )}
    </div>
  );
}
