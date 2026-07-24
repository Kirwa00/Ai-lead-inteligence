"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = "idle" | "running" | "done" | "error";

export default function CampaignResearchButton({ id }: { id: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resume polling if a run was already in flight (e.g. after a refresh).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/${id}/research`)
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
  }, [id]);

  function poll() {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${id}/research`);
        const d = (await res.json()) as { status: string; added?: number; error?: string };
        if (d.status === "succeeded") {
          finish();
          setPhase("done");
          setMsg(`Added ${d.added ?? 0} lead${d.added === 1 ? "" : "s"}.`);
          router.refresh();
        } else if (d.status === "failed") {
          finish();
          setPhase("error");
          setMsg(d.error ?? "Research failed.");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }

  function finish() {
    if (timer.current) clearInterval(timer.current);
  }

  async function start() {
    setPhase("running");
    setMsg("");
    try {
      const res = await fetch(`/api/campaigns/${id}/research`, { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Could not start research.");
      poll();
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "Could not start research.");
    }
  }

  const running = phase === "running";

  return (
    <div className="space-y-xs">
      <button
        onClick={start}
        disabled={running}
        className="flex items-center gap-sm px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95 w-full justify-center disabled:opacity-70 disabled:cursor-not-allowed"
      >
        <span className={`material-symbols-outlined text-body-sm${running ? " animate-spin" : ""}`}>
          {running ? "progress_activity" : "travel_explore"}
        </span>
        {running ? "Researching…" : "Run Research Agent"}
      </button>
      {running && (
        <p className="font-mono text-label-sm text-on-surface-variant">
          Running in the background — you can leave this page; leads appear when it finishes (~20s).
        </p>
      )}
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
    </div>
  );
}
