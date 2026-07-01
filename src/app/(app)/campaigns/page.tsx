import Link from "next/link";
import { demoCampaigns } from "@/lib/demo-data";

const statusBadge: Record<string, string> = {
  active: "text-primary bg-primary/10 border-primary/20",
  paused: "text-secondary bg-secondary/10 border-secondary/20",
  validating: "text-tertiary bg-tertiary/10 border-tertiary/20",
  draft: "text-on-surface-variant bg-surface-container-high border-outline-variant",
  completed: "text-on-surface-variant bg-surface-container-high border-outline-variant",
};

export default function CampaignsPage() {
  const totalMeetings = demoCampaigns.reduce((s, c) => s + c.meetings, 0);
  const totalReplied = demoCampaigns.reduce((s, c) => s + c.replied, 0);
  const totalLeads = demoCampaigns.reduce((s, c) => s + c.leads, 0);
  const replyRate = totalLeads > 0 ? ((totalReplied / totalLeads) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-lg py-lg">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Campaign Builder</h1>
          <p className="text-body-md text-on-surface-variant">Create and manage your AI-powered outreach campaigns.</p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-xs px-lg py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-body-sm">add</span>
          New Campaign
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-md">
        {[
          { label: "Total Campaigns", value: String(demoCampaigns.length) },
          { label: "Active", value: String(demoCampaigns.filter((c) => c.status === "active").length) },
          { label: "Meetings Booked", value: String(totalMeetings) },
          { label: "Avg Reply Rate", value: `${replyRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
            <div className="text-display-lg font-bold text-on-surface">{value}</div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</div>
          </div>
        ))}
      </div>

      {/* Campaign cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {demoCampaigns.map((c) => (
          <div
            key={c.id}
            className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow hover:border-primary/40 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start mb-md">
              <h3 className="text-body-md font-semibold text-on-surface flex-1 mr-md">{c.name}</h3>
              <span className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${statusBadge[c.status]}`}>
                {c.status}
              </span>
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
              <span className="font-mono text-label-sm text-on-surface-variant">Created {c.created}</span>
              <div className="flex gap-sm">
                <button className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-body-sm">edit</span>
                </button>
                <button className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-body-sm">open_in_new</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
