import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import KpiCard from "@/components/ui/KpiCard";
import LeadGrowthChart from "@/components/ui/LeadGrowthChart";
import ActiveCampaignsList from "@/components/ui/ActiveCampaignsList";
import OnboardingChecklist from "@/components/ui/OnboardingChecklist";
import { AGENTS } from "@/lib/agents";
import { microsToUsd } from "@/lib/billing";
import { getQuickStartState } from "@/lib/ux";

export const dynamic = "force-dynamic";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function DashboardPage() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const [
    campaignCount,
    totalCampaigns,
    qualifiedCount,
    leadStatuses,
    recentJobs,
    sentEmailCount,
    recentCampaigns,
    org,
  ] = await Promise.all([
    orgId ? prisma.campaign.count({ where: { organizationId: orgId, status: "active" } }) : Promise.resolve(0),
    orgId ? prisma.campaign.count({ where: { organizationId: orgId } }) : Promise.resolve(0),
    orgId ? prisma.lead.count({ where: { campaign: { organizationId: orgId }, status: "qualified" } }) : Promise.resolve(0),
    orgId
      ? prisma.lead.findMany({ where: { campaign: { organizationId: orgId } }, select: { status: true } })
      : Promise.resolve([]),
    orgId
      ? prisma.agentJob.findMany({
          where: { organizationId: orgId },
          include: { campaign: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    orgId
      ? prisma.email.count({ where: { campaign: { organizationId: orgId }, status: "sent" } })
      : Promise.resolve(0),
    orgId
      ? prisma.campaign.findMany({
          where: { organizationId: orgId },
          include: { leads: { select: { status: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    orgId
      ? prisma.organization.findUnique({ where: { id: orgId }, select: { creditBalanceMicros: true } })
      : Promise.resolve(null),
  ]);

  const contactedOrMore = leadStatuses.filter((l) => l.status !== "uncontacted").length;
  const repliedCount = leadStatuses.filter((l) => l.status === "replied" || l.status === "meeting_booked").length;
  const responseRate = contactedOrMore > 0 ? Math.round((repliedCount / contactedOrMore) * 100) : null;

  const succeeded = recentJobs.filter((j) => j.status === "succeeded").length;
  const runningCount = recentJobs.filter((j) => j.status === "running" || j.status === "queued").length;

  const balanceUsd = org ? microsToUsd(org.creditBalanceMicros) : 0;

  const kpis = [
    {
      label: "Qualified Leads",
      value: qualifiedCount.toLocaleString(),
      trend: "From your campaigns",
      icon: "verified",
      positive: true,
    },
    {
      label: "Response Rate",
      value: responseRate !== null ? `${responseRate}%` : "—",
      trend: contactedOrMore > 0 ? `${repliedCount} of ${contactedOrMore} contacted` : "No outreach sent yet",
      icon: "chat_bubble",
      positive: true,
    },
    {
      label: "Active Campaigns",
      value: String(campaignCount),
      trend: "Running now",
      icon: "rocket_launch",
      positive: false,
    },
    {
      label: "Account Value",
      value: `$${balanceUsd.toFixed(2)}`,
      trend: balanceUsd > 0 ? "Available to run agents" : "Add credits to run agents",
      icon: "account_balance_wallet",
      positive: balanceUsd > 0,
    },
  ];

  const campaignRows = recentCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    leads: c.leads.length,
    status: c.status,
    progress:
      c.leads.length > 0
        ? Math.min(
            100,
            Math.round(
              (c.leads.filter((l) => l.status !== "uncontacted").length / c.leads.length) * 100
            )
          )
        : 0,
  }));

  const showOnboarding = totalCampaigns === 0 || leadStatuses.length === 0 || sentEmailCount === 0;
  const quickStart = getQuickStartState({
    hasCampaign: totalCampaigns > 0,
    hasLeads: leadStatuses.length > 0,
    hasEmailSent: sentEmailCount > 0,
  });

  return (
    <div className="space-y-lg py-lg">
      {/* Page header */}
      <div className="flex justify-between items-end mb-xl">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Dashboard</h1>
          <p className="text-body-md text-on-surface-variant">
            Autonomous pipeline monitoring and real-time agent coordination.
          </p>
        </div>
        <div className="flex items-center gap-xs px-sm py-xs bg-surface-container-high rounded border border-outline-variant">
          <span className="w-2 h-2 bg-primary rounded-full animate-status-pulse" />
          <span className="font-mono text-label-sm text-primary uppercase">Live System Active</span>
        </div>
      </div>

      {showOnboarding && (
        <div className="space-y-md animate-[fadeIn_0.35s_ease-out]">
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-lg shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]">
            <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface">{quickStart.title}</h2>
                <p className="mt-xs text-body-sm text-on-surface-variant">{quickStart.intro}</p>
              </div>
              <div className="flex flex-wrap gap-sm">
                <Link href={quickStart.primaryHref} className="inline-flex items-center gap-xs rounded-xl bg-primary-container px-md py-sm font-mono text-label-md font-bold text-on-primary-container transition-all hover:brightness-105 active:scale-95">
                  <span className="material-symbols-outlined text-body-sm">rocket_launch</span>
                  {quickStart.primaryLabel}
                </Link>
                <Link href={quickStart.secondaryHref} className="inline-flex items-center gap-xs rounded-xl border border-outline-variant px-md py-sm font-mono text-label-md font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary">
                  <span className="material-symbols-outlined text-body-sm">list</span>
                  {quickStart.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
          <div className="animate-[fadeIn_0.45s_ease-out]">
            <OnboardingChecklist
              hasCampaign={totalCampaigns > 0}
              hasLeads={leadStatuses.length > 0}
              hasEmailSent={sentEmailCount > 0}
            />
          </div>
        </div>
      )}

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </section>

      {/* Chart + Campaign list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        <LeadGrowthChart />
        <ActiveCampaignsList campaigns={campaignRows} />
      </div>

      {/* AI Workforce strip — real recent runs, not simulated status */}
      <section>
        <div className="flex items-center justify-between mb-md">
          <h2 className="text-headline-sm font-semibold text-on-surface">Recent Agent Activity</h2>
          <Link href="/workflows" className="font-mono text-label-sm text-primary hover:underline">
            View full activity log
          </Link>
        </div>
        {recentJobs.length === 0 ? (
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg text-center">
            <p className="text-body-sm text-on-surface-variant">
              No agent runs yet. Open a campaign and run the Research Agent to get started.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-md mb-md">
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
                <div className="text-display-lg font-bold text-on-surface">{runningCount}</div>
                <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Running Now</div>
              </div>
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
                <div className="text-display-lg font-bold text-on-surface">{succeeded}</div>
                <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Succeeded (last 5)</div>
              </div>
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
                <div className="text-display-lg font-bold text-on-surface">{sentEmailCount.toLocaleString()}</div>
                <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Emails Sent</div>
              </div>
            </div>
            <div className="bg-surface-container-low border border-outline-variant rounded-xl divide-y divide-outline-variant overflow-hidden">
              {recentJobs.map((j) => (
                <Link
                  key={j.id}
                  href={j.campaign ? `/campaigns/${j.campaign.id}` : "/workflows"}
                  className="flex items-center justify-between px-lg py-sm hover:bg-surface-container-high transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-body-sm font-medium text-on-surface">
                      {AGENTS[j.agentType]?.label ?? j.agentType}
                    </span>
                    <span className="font-mono text-label-sm text-on-surface-variant ml-sm">
                      {j.campaign?.name ?? "Unknown campaign"}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-label-sm capitalize shrink-0 ${
                      j.status === "succeeded"
                        ? "text-primary"
                        : j.status === "failed"
                        ? "text-error"
                        : "text-secondary"
                    }`}
                  >
                    {j.status} · {timeAgo(j.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
