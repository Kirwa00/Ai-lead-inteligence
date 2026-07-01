import { prisma } from "@/lib/prisma";

const agentMeta: Record<
  string,
  { icon: string; accuracy: string; avgLatency: string; currentTask: string; description: string; capabilities: string[] }
> = {
  research: {
    icon: "travel_explore",
    accuracy: "94.2%",
    avgLatency: "1.2s",
    currentTask: "Scanning SaaS companies in Nairobi tech hub",
    description: "Discovers companies matching your ICP across the web, LinkedIn, and business directories.",
    capabilities: ["Web scraping", "LinkedIn lookup", "Company profiling", "Industry classification"],
  },
  qualification: {
    icon: "verified",
    accuracy: "91.8%",
    avgLatency: "0.8s",
    currentTask: "Scoring new FinTech prospects",
    description: "Scores and ranks companies against your ICP criteria using a weighted scoring model.",
    capabilities: ["ICP scoring", "Revenue estimation", "Growth signal detection", "Rank ordering"],
  },
  contact_discovery: {
    icon: "contacts",
    accuracy: "88.5%",
    avgLatency: "2.1s",
    currentTask: "Finding C-suite contacts",
    description: "Finds decision-makers and their verified business emails for qualified companies.",
    capabilities: ["Title matching", "Email pattern generation", "LinkedIn enrichment", "Phone lookup"],
  },
  email_verification: {
    icon: "mark_email_read",
    accuracy: "99.1%",
    avgLatency: "0.4s",
    currentTask: "Awaiting next batch",
    description: "Validates email deliverability and detects risky or catch-all addresses before sending.",
    capabilities: ["SMTP verification", "Catch-all detection", "Disposable detection", "Confidence scoring"],
  },
  outreach: {
    icon: "send",
    accuracy: "—",
    avgLatency: "3.4s",
    currentTask: "Writing personalised intro emails",
    description: "Generates hyper-personalised email and LinkedIn messages using company research context.",
    capabilities: ["Email personalisation", "LinkedIn messages", "Follow-up sequences", "Subject line optimisation"],
  },
  followup: {
    icon: "reply_all",
    accuracy: "—",
    avgLatency: "—",
    currentTask: "Awaiting human approval to resume",
    description: "Monitors inboxes, classifies replies, and schedules intelligent follow-up touchpoints.",
    capabilities: ["Reply classification", "Meeting detection", "Objection handling", "Auto-scheduling"],
  },
  reporting: {
    icon: "assessment",
    accuracy: "—",
    avgLatency: "0.9s",
    currentTask: "Generating weekly performance report",
    description: "Builds live dashboards, computes KPIs, and recommends campaign optimisations.",
    capabilities: ["KPI computation", "Trend analysis", "Anomaly detection", "PDF report generation"],
  },
};

const statusStyle: Record<string, { dot: string; label: string; text: string }> = {
  active: { dot: "bg-primary animate-status-pulse", label: "Active", text: "text-primary" },
  idle: { dot: "bg-on-surface-variant", label: "Idle", text: "text-on-surface-variant" },
  paused: { dot: "bg-secondary", label: "Paused", text: "text-secondary" },
  error: { dot: "bg-error animate-status-pulse", label: "Error", text: "text-error" },
};

export default async function WorkforcePage() {
  const dbAgents = await prisma.aIAgent.findMany({ orderBy: { createdAt: "asc" } });

  const agents = dbAgents.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    status: a.status,
    tasksToday: a.tasksTotal,
    ...(agentMeta[a.type] ?? {
      icon: "smart_toy",
      accuracy: "—",
      avgLatency: "—",
      currentTask: "Idle",
      description: "",
      capabilities: [],
    }),
  }));

  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalTasks = agents.reduce((s, a) => s + a.tasksToday, 0);
  const accuracies = agents.map((a) => parseFloat(a.accuracy)).filter((n) => !isNaN(n));
  const avgAccuracy =
    accuracies.length ? (accuracies.reduce((s, n) => s + n, 0) / accuracies.length).toFixed(1) : "—";

  return (
    <div className="space-y-lg py-lg">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">AI Workforce</h1>
        <p className="text-body-md text-on-surface-variant">Monitor and manage your autonomous AI agents.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-md">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">
            {activeCount}/{agents.length}
          </div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Agents Active</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">{totalTasks.toLocaleString()}</div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Tasks Today</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">
            {avgAccuracy}
            {avgAccuracy !== "—" ? "%" : ""}
          </div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Avg Accuracy</div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {agents.map((agent) => {
          const st = statusStyle[agent.status] ?? statusStyle.idle;
          return (
            <div
              key={agent.id}
              className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow"
            >
              <div className="flex items-start justify-between mb-md">
                <div className="flex items-center gap-md">
                  <div className="w-10 h-10 bg-primary-container/10 border border-primary/20 rounded-xl flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {agent.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-body-md font-semibold text-on-surface">{agent.name}</h3>
                    <div className="flex items-center gap-xs mt-xs">
                      <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                      <span className={`font-mono text-label-sm uppercase ${st.text}`}>{st.label}</span>
                    </div>
                  </div>
                </div>
                <button className="text-on-surface-variant hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>

              <p className="text-body-sm text-on-surface-variant mb-md">{agent.description}</p>

              <div className="bg-surface-container-highest rounded-lg px-md py-sm mb-md border border-outline-variant">
                <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest block mb-xs">
                  Current Task
                </span>
                <span className="text-body-sm text-on-surface">{agent.currentTask}</span>
              </div>

              <div className="grid grid-cols-3 gap-sm mb-md">
                {[
                  { label: "Tasks Today", value: agent.tasksToday.toLocaleString() },
                  { label: "Accuracy", value: agent.accuracy },
                  { label: "Avg Latency", value: agent.avgLatency },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-surface-container-highest rounded-lg p-sm text-center">
                    <div className="font-mono text-label-md font-bold text-on-surface">{value}</div>
                    <div className="font-mono text-label-sm text-on-surface-variant">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-xs">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="font-mono text-label-sm px-sm py-xs bg-surface-container-highest text-on-surface-variant rounded border border-outline-variant"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
