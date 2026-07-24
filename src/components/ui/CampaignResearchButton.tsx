"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CampaignResearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/research`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        added?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Research failed.");
      setMsg({ ok: true, text: `Added ${data.added ?? 0} lead${data.added === 1 ? "" : "s"}.` });
      router.refresh(); // show the new leads + updated KPIs
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Research failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-xs">
      <button
        onClick={run}
        disabled={loading}
        className="flex items-center gap-sm px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95 w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className={`material-symbols-outlined text-body-sm${loading ? " animate-spin" : ""}`}>
          {loading ? "progress_activity" : "travel_explore"}
        </span>
        {loading ? "Researching…" : "Run Research Agent"}
      </button>
      {loading && (
        <p className="font-mono text-label-sm text-on-surface-variant">
          Finding companies that match this campaign — this takes ~20s.
        </p>
      )}
      {msg && (
        <p className={`flex items-center gap-xs font-mono text-label-sm ${msg.ok ? "text-primary" : "text-error"}`}>
          <span className="material-symbols-outlined text-body-sm">{msg.ok ? "check_circle" : "error"}</span>
          {msg.text}
        </p>
      )}
    </div>
  );
}
