"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CampaignStatusButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const isActive = status === "active";
  const target = isActive ? "paused" : "active";

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) throw new Error();
      router.refresh(); // re-fetch the server component so the badge updates
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const base =
    "flex items-center gap-xs px-sm py-xs rounded-lg font-mono text-label-sm font-bold border transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const tone = isActive
    ? "text-secondary bg-secondary/10 border-secondary/20 hover:bg-secondary/20"
    : "text-primary bg-primary/10 border-primary/20 hover:bg-primary/20";

  return (
    <button onClick={toggle} disabled={loading} className={`${base} ${tone}`} title={isActive ? "Pause campaign" : "Start campaign"}>
      <span className={`material-symbols-outlined text-body-sm${loading ? " animate-spin" : ""}`}>
        {loading ? "progress_activity" : error ? "error" : isActive ? "pause" : "play_arrow"}
      </span>
      {loading ? "…" : isActive ? "Pause" : "Start"}
    </button>
  );
}
