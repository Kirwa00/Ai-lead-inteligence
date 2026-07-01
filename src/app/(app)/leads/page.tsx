import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  qualified: "text-primary bg-primary/10 border-primary/20",
  contacted: "text-secondary bg-secondary/10 border-secondary/20",
  replied: "text-tertiary bg-tertiary/10 border-tertiary/20",
  uncontacted: "text-on-surface-variant bg-surface-container-high border-outline-variant",
  bounced: "text-error bg-error/10 border-error/20",
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? "text-primary" : score >= 75 ? "text-secondary" : "text-on-surface-variant";
  return <span className={`font-mono text-label-md font-bold ${color}`}>{score}</span>;
}

export default async function LeadsPage() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const rawLeads = orgId
    ? await prisma.lead.findMany({
        where: { campaign: { organizationId: orgId } },
        include: { company: true, contact: true },
        orderBy: { score: "desc" },
        take: 200,
      })
    : [];

  const leads = rawLeads.map((l) => ({
    id: l.id,
    company: l.company.name,
    contact: l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : "—",
    title: l.contact?.title ?? "—",
    email: l.contact?.email ?? "—",
    score: l.score,
    status: l.status,
    industry: l.company.industry ?? "—",
  }));

  const stats = {
    total: leads.length,
    qualified: leads.filter((l) => l.status === "qualified").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    replied: leads.filter((l) => l.status === "replied").length,
  };

  return (
    <div className="space-y-lg py-lg">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Lead Explorer</h1>
          <p className="text-body-md text-on-surface-variant">Browse, filter and qualify AI-discovered leads.</p>
        </div>
        <div className="flex gap-sm">
          <button className="flex items-center gap-xs px-md py-sm border border-outline-variant text-on-surface-variant font-mono text-label-md rounded-xl hover:border-primary hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-body-sm">filter_list</span>
            Filter
          </button>
          <button className="flex items-center gap-xs px-md py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95">
            <span className="material-symbols-outlined text-body-sm">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-md">
        {[
          { label: "Total Leads", value: stats.total.toLocaleString() },
          { label: "Qualified", value: stats.qualified.toLocaleString() },
          { label: "Contacted", value: stats.contacted.toLocaleString() },
          { label: "Replied", value: stats.replied.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
            <div className="text-display-lg font-bold text-on-surface">{value}</div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="p-lg border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
          <h2 className="text-headline-sm font-bold text-on-surface">All Leads</h2>
          <div className="flex items-center bg-surface-container-high border border-outline-variant px-md py-xs rounded-xl w-64">
            <span className="material-symbols-outlined text-on-surface-variant mr-sm text-body-sm">search</span>
            <input
              className="bg-transparent border-none outline-none text-body-sm text-on-surface placeholder:text-on-surface-variant w-full"
              placeholder="Search leads..."
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {leads.length === 0 ? (
            <p className="p-lg text-body-sm text-on-surface-variant">No leads yet. Run a campaign to discover prospects.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant text-left">
                  <th className="px-lg py-sm font-mono text-label-sm text-on-surface-variant uppercase">Company</th>
                  <th className="px-lg py-sm font-mono text-label-sm text-on-surface-variant uppercase">Contact</th>
                  <th className="px-lg py-sm font-mono text-label-sm text-on-surface-variant uppercase">Industry</th>
                  <th className="px-lg py-sm font-mono text-label-sm text-on-surface-variant uppercase">Email</th>
                  <th className="px-lg py-sm font-mono text-label-sm text-on-surface-variant uppercase text-center">Score</th>
                  <th className="px-lg py-sm font-mono text-label-sm text-on-surface-variant uppercase">Status</th>
                  <th className="px-lg py-sm" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-surface-container-high transition-colors cursor-pointer">
                    <td className="px-lg py-md text-body-sm font-medium text-on-surface">{lead.company}</td>
                    <td className="px-lg py-md">
                      <div className="text-body-sm text-on-surface">{lead.contact}</div>
                      <div className="font-mono text-label-sm text-on-surface-variant">{lead.title}</div>
                    </td>
                    <td className="px-lg py-md font-mono text-label-md text-on-surface-variant">{lead.industry}</td>
                    <td className="px-lg py-md font-mono text-label-md text-on-surface-variant">{lead.email}</td>
                    <td className="px-lg py-md text-center"><ScoreBadge score={lead.score} /></td>
                    <td className="px-lg py-md">
                      <span className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${statusBadge[lead.status] ?? ""}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-lg py-md">
                      <button className="text-on-surface-variant hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-body-sm">open_in_new</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
