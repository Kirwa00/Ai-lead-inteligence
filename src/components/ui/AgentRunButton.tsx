"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "done" | "error";

export default function AgentRunButton({
  campaignId,
  type,
  label,
  description,
  order,
  estCost,
  prerequisiteWarning,
}: {
  campaignId: string;
  type: string;
  label: string;
  description: string;
  order?: number;
  estCost?: string;
  prerequisiteWarning?: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const base = `/api/campaigns/${campaignId}/agents/${type}`;

  useEffect(() => {
    let cancelled = false;
    fetch(base)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && (d.status === "running" || d.status === "queued")) {
          setPhase("running");
          poll();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  function poll() {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const d = (await (await fetch(base)).json()) as { status: string; summary?: string; error?: string };
        if (d.status === "succeeded") {
          if (timer.current) clearInterval(timer.current);
          setPhase("done");
          setMsg(d.summary ?? "Done.");
          router.refresh();
        } else if (d.status === "failed") {
          if (timer.current) clearInterval(timer.current);
          setPhase("error");
          setMsg(d.error ?? "Agent run failed.");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }

  async function start() {
    setPhase("running");
    setMsg("");
    try {
      const res = await fetch(base, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Could not start.");
      poll();
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "Could not start.");
    }
  }

  const running = phase === "running";

  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-high p-md space-y-xs">
      <div className="flex items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-xs">
            {order !== undefined && (
              <span className="w-5 h-5 rounded-full bg-surface-container-highest border border-outline-variant text-label-sm font-mono font-bold flex items-center justify-center text-on-surface-variant shrink-0">
                {order}
              </span>
            )}
            <span className="text-body-sm font-semibold text-on-surface">{label}</span>
          </div>
          <div className="font-mono text-label-sm text-on-surface-variant">{description}</div>
          {estCost && (
            <div className="font-mono text-label-sm text-on-surface-variant mt-xs">Est. cost: {estCost}</div>
          )}
        </div>
        <button
          onClick={start}
          disabled={running}
          className="flex items-center gap-xs px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-sm font-bold rounded-lg hover:brightness-105 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
        >
          <span className={`material-symbols-outlined text-body-sm${running ? " animate-spin" : ""}`}>
            {running ? "progress_activity" : "play_arrow"}
          </span>
          {running ? "Running…" : "Run"}
        </button>
      </div>
      {phase === "done" && (
        <p className="flex items-center gap-xs font-mono text-label-sm text-primary">
          <span className="material-symbols-outlined text-body-sm">check_circle</span>
          {msg}
        </p>
      )}
      {phase === "error" && (
        <p className="flex items-center gap-xs font-mono text-label-sm text-error">
          <span className="material-symbols-outlined text-body-sm">error</span>
          {msg}
        </p>
      )}
      {phase === "idle" && prerequisiteWarning && (
        <p className="flex items-center gap-xs font-mono text-label-sm text-tertiary">
          <span className="material-symbols-outlined text-body-sm">info</span>
          {prerequisiteWarning}
        </p>
      )}
    </div>
  );
}
