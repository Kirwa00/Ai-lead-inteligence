import Link from "next/link";

const statusBadge: Record<string, string> = {
  active: "text-primary bg-primary/10 border-primary/20",
  paused: "text-secondary bg-secondary/10 border-secondary/20",
  validating: "text-tertiary bg-tertiary/10 border-tertiary/20",
  draft: "text-on-surface-variant bg-surface-container-high border-outline-variant",
  completed: "text-on-surface-variant bg-surface-container-high border-outline-variant",
};

type CampaignRow = {
  id?: string;
  name: string;
  leads: number;
  status: string;
  progress?: number;
};

export default function ActiveCampaignsList({ campaigns }: { campaigns: CampaignRow[] }) {
  // "Working on" = anything not a draft or completed.
  const working = campaigns.filter((c) => !["draft", "completed"].includes(c.status));

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="p-lg border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
        <h2 className="text-headline-sm font-bold text-on-surface">Campaigns in progress</h2>
        <Link href="/campaigns" className="font-mono text-label-sm text-primary hover:underline">View all</Link>
      </div>
      <div className="divide-y divide-outline-variant">
        {working.length === 0 && (
          <p className="p-lg text-body-sm text-on-surface-variant">
            No active campaigns. <Link href="/campaigns/new" className="text-primary hover:underline">Create one</Link>.
          </p>
        )}
        {working.map((c) => {
          const inner = (
            <>
              <div className="flex justify-between items-start mb-sm">
                <span className="text-body-sm font-medium text-on-surface line-clamp-1 flex-1 mr-sm">{c.name}</span>
                <span className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${statusBadge[c.status] ?? ""}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex items-center gap-md">
                <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${c.progress ?? 0}%` }} />
                </div>
                <span className="font-mono text-label-sm text-on-surface-variant whitespace-nowrap">
                  {c.progress ?? 0}% · {c.leads} leads
                </span>
              </div>
            </>
          );
          return c.id ? (
            <Link key={c.id} href={`/campaigns/${c.id}`} className="block p-md hover:bg-surface-container-high transition-colors">
              {inner}
            </Link>
          ) : (
            <div key={c.name} className="p-md">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
