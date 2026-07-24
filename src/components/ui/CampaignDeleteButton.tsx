"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CampaignDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${name}"? This removes the campaign and its leads. This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/campaigns");
        router.refresh();
      } else {
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={remove}
      disabled={busy}
      className="flex items-center gap-xs px-md py-sm rounded-lg font-mono text-label-sm font-bold border text-error bg-error/10 border-error/20 hover:bg-error/20 transition-all active:scale-95 disabled:opacity-50"
      title="Delete campaign"
    >
      <span className={`material-symbols-outlined text-body-sm${busy ? " animate-spin" : ""}`}>
        {busy ? "progress_activity" : "delete"}
      </span>
      Delete
    </button>
  );
}
