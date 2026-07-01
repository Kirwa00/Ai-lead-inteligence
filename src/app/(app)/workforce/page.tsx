import { demoAgents } from "@/lib/demo-data";

const statusStyle: Record<string, { dot: string; label: string; text: string }> = {
  active: { dot: "bg-primary animate-status-pulse", label: "Active", text: "text-primary" },
  idle: { dot: "bg-on-surface-variant", label: "Idle", text: "text-on-surface-variant" },
  paused: { dot: "bg-secondary", label: "Paused", text: "text-secondary" },
  error: { dot: "bg-error animate-status-pulse", label: "Error", text: "text-error" },
};

export default function WorkforcePage() {
  const activeCount = demoAgents.filter((a) => a.status === "active").length;
  const totalTasks = demoAgents.reduce((s, a) => s + a.tasksToday, 0);
  const accuracies = demoAgents
    .map((a) => parseFloat(a.accuracy))
    .filter((n) => !isNaN(n));
  const avgAccuracy = accuracies.length
    ? (accuracies.reduce((s, n) => s + n, 0) / accuracies.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-lg py-lg">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">AI Workforce</h1>
        <p className="text-body-md text-on-surface-variant">Monitor and manage your autonomous AI agents.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-md">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">{activeCount}/{demoAgents.length}</div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Agents Active</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">{totalTasks.toLocaleString()}</div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Tasks Today</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">{avgAccuracy}{avgAccuracy !== "—" ? "%" : ""}</div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Avg Accuracy</div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {demoAgents.map((agent) => {
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

              {/* Current task */}
              <div className="bg-surface-container-highest rounded-lg px-md py-sm mb-md border border-outline-variant">
                <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest block mb-xs">
                  Current Task
                </span>
                <span className="text-body-sm text-on-surface">{agent.currentTask}</span>
              </div>

              {/* Metrics */}
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

              {/* Capabilities */}
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
