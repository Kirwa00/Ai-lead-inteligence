interface KpiCardProps {
  label: string;
  value: string;
  trend: string;
  icon: string;
  positive: boolean;
}

export default function KpiCard({ label, value, trend, icon, positive }: KpiCardProps) {
  return (
    <div className="bg-surface-container-low border border-outline-variant p-lg rounded-xl ai-glow flex flex-col justify-between">
      <div className="flex justify-between items-start mb-md">
        <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</span>
        <span
          className="material-symbols-outlined text-primary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div>
        <div className="text-display-lg font-bold text-on-surface">{value}</div>
        <div className={`flex items-center gap-xs mt-xs ${positive ? "text-primary" : "text-on-surface-variant"}`}>
          <span className="material-symbols-outlined text-sm">{positive ? "trending_up" : "pause_circle"}</span>
          <span className="font-mono text-label-md">{trend}</span>
        </div>
      </div>
    </div>
  );
}
