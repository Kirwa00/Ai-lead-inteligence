"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const OPTIONS: { status: string; label: string; icon: string }[] = [
  { status: "contacted", label: "Mark Contacted", icon: "outgoing_mail" },
  { status: "replied", label: "Mark Replied", icon: "reply" },
  { status: "meeting_booked", label: "Mark Meeting Booked", icon: "event_available" },
  { status: "disqualified", label: "Disqualify", icon: "block" },
];

export default function LeadQuickActions({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function setStatus(status: string) {
    setBusy(true);
    setOpen(false);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        disabled={busy}
        className="text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50"
        aria-label="Lead actions"
      >
        <span className={`material-symbols-outlined text-body-sm${busy ? " animate-spin" : ""}`}>
          {busy ? "progress_activity" : "more_vert"}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 w-56 bg-surface-container-low border border-outline-variant rounded-xl shadow-lg overflow-hidden z-20">
            {OPTIONS.map((o) => (
              <button
                key={o.status}
                onClick={(e) => {
                  e.stopPropagation();
                  setStatus(o.status);
                }}
                className="w-full flex items-center gap-sm px-md py-sm text-left text-body-sm text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-body-sm">{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
