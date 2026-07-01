import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import KpiCard from "@/components/ui/KpiCard";
import AgentStatusCard from "@/components/ui/AgentStatusCard";
import LeadGrowthChart from "@/components/ui/LeadGrowthChart";
import ActiveCampaignsList from "@/components/ui/ActiveCampaignsList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const [campaignCount, qualifiedCount, agents, recentCampaigns] = await Promise.all([
    orgId ? prisma.campaign.count({ where: { organizationId: orgId } }) : Promise.resolve(0),
    orgId
      ? prisma.lead.count({ where: { campaign: { organizationId: orgId }, status: "qualified" } })
      : Promise.resolve(0),
    prisma.aIAgent.findMany({ orderBy: { createdAt: "asc" } }),
    orgId
      ? prisma.campaign.findMany({
          where: { organizationId: orgId },
          include: { leads: { select: { status: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

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
      value: "—",
      trend: "Awaiting outreach data",
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
      label: "AI Efficiency",
      value: "99.2%",
      trend: "0.08s avg latency",
      icon: "memory",
      positive: true,
    },
  ];

  const campaignRows = recentCampaigns.map((c) => ({
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

      {/* AI Workforce strip */}
      {agents.length > 0 && (
        <section>
          <h2 className="text-headline-sm font-semibold text-on-surface mb-md">AI Workforce Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {agents.map((agent) => (
              <AgentStatusCard
                key={agent.id}
                name={agent.name}
                status={agent.status as "active" | "idle" | "paused" | "error"}
                tasksCompleted={agent.tasksTotal}
                currentTask={
                  (agent.config as { currentTask?: string } | null)?.currentTask ?? "Awaiting tasks"
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
