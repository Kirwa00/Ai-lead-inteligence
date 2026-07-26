import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AGENTS } from "@/lib/agents";

export const dynamic = "force-dynamic";

const icons: Record<string, string> = {
  research: "travel_explore",
  qualification: "verified",
  contact_discovery: "contacts",
  email_verification: "mark_email_read",
  outreach: "send",
  followup: "reply_all",
  reporting: "assessment",
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function WorkforcePage() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const jobs = orgId
    ? await prisma.agentJob.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const byType = new Map<string, typeof jobs>();
  for (const j of jobs) {
    const arr = byType.get(j.agentType) ?? [];
    arr.push(j);
    byType.set(j.agentType, arr);
  }

  const agents = Object.entries(AGENTS).map(([type, def]) => {
    const runs = byType.get(type) ?? [];
    const succeeded = runs.filter((r) => r.status === "succeeded").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const running = runs.some((r) => r.status === "queued" || r.status === "running");
    const last = runs[0];
    const successRate = succeeded + failed > 0 ? Math.round((succeeded / (succeeded + failed)) * 100) : null;
    return {
      type,
      label: def.label,
      description: def.description,
      icon: icons[type] ?? "smart_toy",
      totalRuns: runs.length,
      running,
      successRate,
      lastRunAt: last?.createdAt ?? null,
      lastStatus: last?.status ?? null,
      lastSummary: last?.summary ?? last?.error ?? null,
    };
  });

  const totalRuns = jobs.length;
  const runningCount = agents.filter((a) => a.running).length;
  const overallSucceeded = jobs.filter((j) => j.status === "succeeded").length;
  const overallFailed = jobs.filter((j) => j.status === "failed").length;
  const overallRate =
    overallSucceeded + overallFailed > 0
      ? Math.round((overallSucceeded / (overallSucceeded + overallFailed)) * 100)
      : null;

  return (
    <div className="space-y-lg py-lg">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">AI Workforce</h1>
        <p className="text-body-md text-on-surface-variant">
          Real run history for your agents, across every campaign in this workspace.
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-md">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">{runningCount}</div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Running Now</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">{totalRuns.toLocaleString()}</div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Total Runs</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
          <div className="text-display-lg font-bold text-on-surface">
            {overallRate !== null ? `${overallRate}%` : "—"}
          </div>
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Success Rate</div>
        </div>
      </div>

      {totalRuns === 0 && (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg text-center">
          <p className="text-body-sm text-on-surface-variant">
            No agent runs yet. Open a campaign and run an agent to see real activity here.
          </p>
        </div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {agents.map((agent) => (
          <div key={agent.type} className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow">
            <div className="flex items-start justify-between mb-md">
              <div className="flex items-center gap-md">
                <div className="w-10 h-10 bg-primary-container/10 border border-primary/20 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {agent.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-body-md font-semibold text-on-surface">{agent.label}</h3>
                  <div className="flex items-center gap-xs mt-xs">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        agent.running ? "bg-primary animate-status-pulse" : "bg-on-surface-variant"
                      }`}
                    />
                    <span
                      className={`font-mono text-label-sm uppercase ${
                        agent.running ? "text-primary" : "text-on-surface-variant"
                      }`}
                    >
                      {agent.running ? "Running" : "Idle"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-body-sm text-on-surface-variant mb-md">{agent.description}</p>

            <div className="bg-surface-container-highest rounded-lg px-md py-sm mb-md border border-outline-variant">
              <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest block mb-xs">
                Last Run
              </span>
              <span className="text-body-sm text-on-surface">
                {agent.lastRunAt
                  ? `${timeAgo(agent.lastRunAt)} · ${agent.lastStatus} — ${agent.lastSummary ?? "no summary"}`
                  : "Never run yet"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              {[
                { label: "Total Runs", value: agent.totalRuns.toLocaleString() },
                { label: "Success Rate", value: agent.successRate !== null ? `${agent.successRate}%` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-container-highest rounded-lg p-sm text-center">
                  <div className="font-mono text-label-md font-bold text-on-surface">{value}</div>
                  <div className="font-mono text-label-sm text-on-surface-variant">{label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
