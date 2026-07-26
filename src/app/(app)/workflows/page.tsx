import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AGENTS } from "@/lib/agents";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, { icon: string; color: string }> = {
  succeeded: { icon: "check_circle", color: "text-primary bg-primary/10 border-primary/30" },
  running: { icon: "progress_activity", color: "text-secondary bg-secondary/10 border-secondary/30 animate-status-pulse" },
  queued: { icon: "pending", color: "text-secondary bg-secondary/10 border-secondary/30" },
  failed: { icon: "error", color: "text-error bg-error/10 border-error/30" },
};

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function WorkflowsPage() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const jobs = orgId
    ? await prisma.agentJob.findMany({
        where: { organizationId: orgId },
        include: { campaign: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    : [];

  const runningNow = jobs.filter((j) => j.status === "queued" || j.status === "running");

  return (
    <div className="space-y-lg py-lg">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Activity Log</h1>
        <p className="text-body-md text-on-surface-variant">
          Real-time history of every AI agent run across your campaigns.
        </p>
      </div>

      {runningNow.length > 0 && (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow">
          <div className="flex items-center gap-xs mb-md">
            <span className="w-2 h-2 bg-primary rounded-full animate-status-pulse" />
            <span className="font-mono text-label-sm text-primary uppercase">
              {runningNow.length} agent{runningNow.length > 1 ? "s" : ""} running now
            </span>
          </div>
          <div className="space-y-sm">
            {runningNow.map((j) => (
              <div key={j.id} className="flex items-center justify-between">
                <span className="text-body-sm text-on-surface">
                  {AGENTS[j.agentType]?.label ?? j.agentType} · {j.campaign?.name ?? "Unknown campaign"}
                </span>
                <span className="font-mono text-label-sm text-secondary">{timeAgo(j.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant">
          <h2 className="text-headline-sm font-bold text-on-surface">Recent Runs</h2>
        </div>
        {jobs.length === 0 ? (
          <div className="px-lg py-xl text-center">
            <p className="text-body-sm text-on-surface-variant">
              No agent activity yet. Run an agent from a campaign to see it logged here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {jobs.map((j) => {
              const st = statusStyle[j.status] ?? statusStyle.queued;
              return (
                <div key={j.id} className="px-lg py-md flex items-start gap-md">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${st.color}`}>
                    <span className={`material-symbols-outlined text-body-sm${j.status === "running" ? " animate-spin" : ""}`}>
                      {st.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-md">
                      <span className="text-body-sm font-medium text-on-surface">
                        {AGENTS[j.agentType]?.label ?? j.agentType}
                      </span>
                      <span className="font-mono text-label-sm text-on-surface-variant shrink-0">
                        {timeAgo(j.createdAt)}
                      </span>
                    </div>
                    <p className="font-mono text-label-sm text-on-surface-variant truncate">
                      {j.campaign ? (
                        <Link href={`/campaigns/${j.campaign.id}`} className="hover:text-primary hover:underline">
                          {j.campaign.name}
                        </Link>
                      ) : (
                        "Unknown campaign"
                      )}
                    </p>
                    {(j.summary || j.error) && (
                      <p className="text-body-sm text-on-surface-variant mt-xs line-clamp-2">
                        {j.error ?? j.summary}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
