"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EmailSendButton({ campaignId, emailId }: { campaignId: string; emailId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    if (!confirm("Send this email now? This cannot be undone.")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/emails/${emailId}/send`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-xs">
      <button
        onClick={send}
        disabled={loading}
        className="flex items-center gap-xs px-md py-xs bg-primary-container text-on-primary-container font-mono text-label-sm font-bold rounded-lg hover:brightness-105 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className={`material-symbols-outlined text-body-sm${loading ? " animate-spin" : ""}`}>
          {loading ? "progress_activity" : "send"}
        </span>
        {loading ? "Sending…" : "Send"}
      </button>
      {error && <p className="font-mono text-label-sm text-error">{error}</p>}
    </div>
  );
}
