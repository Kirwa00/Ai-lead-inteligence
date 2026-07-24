"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = { label: string; status: string; icon: string; tone: string };

const TONES: Record<string, string> = {
  start: "text-primary bg-primary/10 border-primary/20 hover:bg-primary/20",
  pause: "text-secondary bg-secondary/10 border-secondary/20 hover:bg-secondary/20",
  stop: "text-error bg-error/10 border-error/20 hover:bg-error/20",
};

// Which actions are available depends on the current status.
function actionsFor(status: string): Action[] {
  switch (status) {
    case "active":
      return [
        { label: "Pause", status: "paused", icon: "pause", tone: "pause" },
        { label: "Stop", status: "completed", icon: "stop", tone: "stop" },
      ];
    case "paused":
      return [
        { label: "Resume", status: "active", icon: "play_arrow", tone: "start" },
        { label: "Stop", status: "completed", icon: "stop", tone: "stop" },
      ];
    case "completed":
      return [{ label: "Reactivate", status: "active", icon: "restart_alt", tone: "start" }];
    default: // draft, validating
      return [
        { label: "Start", status: "active", icon: "play_arrow", tone: "start" },
      ];
  }
}

export default function CampaignControls({
  id,
  status,
  size = "sm",
}: {
  id: string;
  status: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function apply(next: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const pad = size === "md" ? "px-md py-sm" : "px-sm py-xs";

  return (
    <div className="flex items-center gap-xs">
      {actionsFor(status).map((a) => (
        <button
          key={a.status + a.label}
          onClick={(e) => apply(a.status, e)}
          disabled={busy}
          className={`flex items-center gap-xs ${pad} rounded-lg font-mono text-label-sm font-bold border transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${TONES[a.tone]}`}
          title={`${a.label} campaign`}
        >
          <span className={`material-symbols-outlined text-body-sm${busy ? " animate-spin" : ""}`}>
            {busy ? "progress_activity" : a.icon}
          </span>
          {a.label}
        </button>
      ))}
    </div>
  );
}
