import KpiCard from "@/components/ui/KpiCard";
import AgentStatusCard from "@/components/ui/AgentStatusCard";
import LeadGrowthChart from "@/components/ui/LeadGrowthChart";
import ActiveCampaignsList from "@/components/ui/ActiveCampaignsList";
import { demoKpis, demoAgents } from "@/lib/demo-data";

const kpis = [
  {
    label: "Qualified Leads",
    value: demoKpis.qualifiedLeads.toLocaleString(),
    trend: "+12.4% vs prev. month",
    icon: "verified",
    positive: true,
  },
  {
    label: "Response Rate",
    value: `${demoKpis.responseRate}%`,
    trend: "+3.1% network improvement",
    icon: "chat_bubble",
    positive: true,
  },
  {
    label: "Active Campaigns",
    value: String(demoKpis.activeCampaigns),
    trend: "2 pending validation",
    icon: "rocket_launch",
    positive: false,
  },
  {
    label: "AI Efficiency",
    value: `${demoKpis.aiEfficiency}%`,
    trend: "0.08s avg latency",
    icon: "memory",
    positive: true,
  },
];

export default function DashboardPage() {
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
        <ActiveCampaignsList />
      </div>

      {/* AI Workforce strip */}
      <section>
        <h2 className="text-headline-sm font-semibold text-on-surface mb-md">AI Workforce Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {demoAgents.map((agent) => (
            <AgentStatusCard
              key={agent.id}
              name={agent.name}
              status={agent.status as "active" | "idle" | "paused" | "error"}
              tasksCompleted={agent.tasksToday}
              currentTask={agent.currentTask}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
