import { clsx } from "clsx";

type AgentStatus = "active" | "idle" | "paused" | "error";

interface AgentStatusCardProps {
  name: string;
  status: AgentStatus;
  tasksCompleted: number;
  currentTask: string;
}

const statusConfig: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-primary", dot: "bg-primary animate-status-pulse" },
  idle: { label: "Idle", color: "text-on-surface-variant", dot: "bg-on-surface-variant" },
  paused: { label: "Paused", color: "text-secondary", dot: "bg-secondary" },
  error: { label: "Error", color: "text-error", dot: "bg-error animate-status-pulse" },
};

export default function AgentStatusCard({ name, status, tasksCompleted, currentTask }: AgentStatusCardProps) {
  const cfg = statusConfig[status];
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md ai-glow">
      <div className="flex items-center justify-between mb-sm">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-body-md" style={{ fontVariationSettings: "'FILL' 1" }}>
            smart_toy
          </span>
          <span className="text-body-sm font-semibold text-on-surface">{name}</span>
        </div>
        <div className="flex items-center gap-xs">
          <span className={clsx("w-2 h-2 rounded-full", cfg.dot)} />
          <span className={clsx("font-mono text-label-sm uppercase", cfg.color)}>{cfg.label}</span>
        </div>
      </div>
      <p className="text-label-md font-mono text-on-surface-variant mb-sm line-clamp-1">{currentTask}</p>
      <div className="flex items-center gap-xs text-label-sm font-mono text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">check_circle</span>
        {tasksCompleted.toLocaleString()} tasks completed
      </div>
    </div>
  );
}
