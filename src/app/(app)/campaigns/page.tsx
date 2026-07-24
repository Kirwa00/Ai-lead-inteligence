import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CampaignsBoard, { type CampaignCard } from "@/components/ui/CampaignsBoard";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const rawCampaigns = orgId
    ? await prisma.campaign.findMany({
        where: { organizationId: orgId },
        include: { leads: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const campaigns: CampaignCard[] = rawCampaigns.map((c) => {
    const total = c.leads.length;
    const worked = c.leads.filter((l) => l.status !== "uncontacted").length;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      industry: c.industry ?? "—",
      geography: c.geography ?? "—",
      leads: total,
      replied: c.leads.filter((l) => l.status === "replied").length,
      meetings: c.leads.filter((l) => l.status === "meeting_booked").length,
      progress: total > 0 ? Math.min(100, Math.round((worked / total) * 100)) : 0,
      created: c.createdAt.toISOString().split("T")[0],
    };
  });

  const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
  const totalReplied = campaigns.reduce((s, c) => s + c.replied, 0);
  const totalMeetings = campaigns.reduce((s, c) => s + c.meetings, 0);
  const replyRate = totalLeads > 0 ? ((totalReplied / totalLeads) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-lg py-lg">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Campaign Builder</h1>
          <p className="text-body-md text-on-surface-variant">Create, launch, and manage your AI-powered outreach campaigns.</p>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        {[
          { label: "Total Campaigns", value: String(campaigns.length) },
          { label: "Active", value: String(campaigns.filter((c) => c.status === "active").length) },
          { label: "Meetings Booked", value: String(totalMeetings) },
          { label: "Avg Reply Rate", value: `${replyRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
            <div className="text-display-lg font-bold text-on-surface">{value}</div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-2xl text-on-surface-variant">
          <span className="material-symbols-outlined text-display-sm mb-md block">rocket_launch</span>
          <p className="text-body-md">No campaigns yet. Create your first one.</p>
        </div>
      ) : (
        <CampaignsBoard campaigns={campaigns} />
      )}
    </div>
  );
}
