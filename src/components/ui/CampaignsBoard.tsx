"use client";

import Link from "next/link";
import { useState } from "react";
import CampaignControls from "@/components/ui/CampaignControls";

export type CampaignCard = {
  id: string;
  name: string;
  status: string;
  industry: string;
  geography: string;
  leads: number;
  replied: number;
  meetings: number;
  progress: number;
  created: string;
};

const statusBadge: Record<string, string> = {
  active: "text-primary bg-primary/10 border-primary/20",
  paused: "text-secondary bg-secondary/10 border-secondary/20",
  validating: "text-tertiary bg-tertiary/10 border-tertiary/20",
  draft: "text-on-surface-variant bg-surface-container-high border-outline-variant",
  completed: "text-on-surface-variant bg-surface-container-high border-outline-variant",
};

const FILTERS = ["all", "active", "paused", "draft", "completed"] as const;

export default function CampaignsBoard({ campaigns }: { campaigns: CampaignCard[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const counts = campaigns.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const visible = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  return (
    <div className="space-y-md">
      {/* Filter tabs */}
      <div className="flex items-center gap-xs flex-wrap">
        {FILTERS.map((f) => {
          const n = f === "all" ? campaigns.length : counts[f] ?? 0;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-xs px-md py-xs rounded-lg font-mono text-label-sm border capitalize transition-colors ${
                active
                  ? "text-primary bg-primary/10 border-primary/30"
                  : "text-on-surface-variant border-outline-variant hover:border-primary/40"
              }`}
            >
              {f}
              <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-2xl text-on-surface-variant">
          <span className="material-symbols-outlined text-display-sm mb-md block">rocket_launch</span>
          <p className="text-body-md">No {filter === "all" ? "" : filter} campaigns.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {visible.map((c) => (
            <div
              key={c.id}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow hover:border-primary/40 transition-colors"
            >
              <div className="flex justify-between items-start mb-md">
                <Link href={`/campaigns/${c.id}`} className="text-body-md font-semibold text-on-surface flex-1 mr-md hover:text-primary transition-colors">
                  {c.name}
                </Link>
                <span className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${statusBadge[c.status] ?? statusBadge.draft}`}>
                  {c.status}
                </span>
              </div>

              {/* Progress */}
              <div className="mb-md">
                <div className="flex justify-between font-mono text-label-sm text-on-surface-variant mb-xs">
                  <span>Progress</span>
                  <span>{c.progress}%</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${c.progress}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-sm mb-md">
                {[
                  { label: "Leads", value: c.leads },
                  { label: "Replied", value: c.replied },
                  { label: "Meetings", value: c.meetings },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface-container-high rounded-lg p-sm text-center">
                    <div className="font-mono text-label-md font-bold text-on-surface">{value}</div>
                    <div className="font-mono text-label-sm text-on-surface-variant">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <CampaignControls id={c.id} status={c.status} />
                <Link href={`/campaigns/${c.id}`} className="flex items-center gap-xs font-mono text-label-sm text-on-surface-variant hover:text-primary transition-colors" title="Manage">
                  Manage
                  <span className="material-symbols-outlined text-body-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
