const campaigns = [
  { name: "Kenya FinTech Outreach", leads: 142, status: "active", progress: 72 },
  { name: "East Africa SaaS CEOs", leads: 89, status: "active", progress: 45 },
  { name: "Nairobi Real Estate Q3", leads: 211, status: "paused", progress: 91 },
  { name: "Pan-Africa Healthcare", leads: 54, status: "active", progress: 28 },
  { name: "Logistics & Supply Chain", leads: 76, status: "validating", progress: 60 },
];

const statusBadge: Record<string, string> = {
  active: "text-primary bg-primary/10 border-primary/20",
  paused: "text-secondary bg-secondary/10 border-secondary/20",
  validating: "text-tertiary bg-tertiary/10 border-tertiary/20",
};

export default function ActiveCampaignsList() {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="p-lg border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
        <h2 className="text-headline-sm font-bold text-on-surface">Active Campaigns</h2>
        <span className="font-mono text-label-sm text-on-surface-variant">{campaigns.length} running</span>
      </div>
      <div className="divide-y divide-outline-variant">
        {campaigns.map((c) => (
          <div key={c.name} className="p-md hover:bg-surface-container-high transition-colors cursor-pointer">
            <div className="flex justify-between items-start mb-sm">
              <span className="text-body-sm font-medium text-on-surface line-clamp-1 flex-1 mr-sm">{c.name}</span>
              <span className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${statusBadge[c.status] ?? ""}`}>
                {c.status}
              </span>
            </div>
            <div className="flex items-center gap-md">
              <div className="flex-1 h-1 bg-surface-container-high rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${c.progress}%` }} />
              </div>
              <span className="font-mono text-label-sm text-on-surface-variant whitespace-nowrap">{c.leads} leads</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
