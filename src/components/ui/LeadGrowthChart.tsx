"use client";

const bars = [40, 55, 45, 70, 60, 85, 75, 95, 80, 100, 88, 92];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function LeadGrowthChart() {
  return (
    <div className="lg:col-span-2 bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden flex flex-col min-h-[380px]">
      <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
        <div className="flex items-center gap-md">
          <h2 className="text-headline-sm font-bold text-on-surface">Lead Growth Velocity</h2>
          <div className="flex bg-surface-container-high rounded p-xs">
            <button className="px-md py-xs text-primary font-mono text-label-md bg-surface-container-lowest rounded shadow-sm">Monthly</button>
            <button className="px-md py-xs text-on-surface-variant font-mono text-label-md hover:text-on-surface transition-colors">Daily</button>
          </div>
        </div>
        <button className="text-on-surface-variant hover:text-primary">
          <span className="material-symbols-outlined">more_vert</span>
        </button>
      </div>
      <div className="flex-1 p-lg flex flex-col justify-end">
        {/* Simple bar chart */}
        <div className="flex items-end gap-1 h-48">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/20 hover:bg-primary transition-all duration-300 rounded-t-sm cursor-pointer"
                style={{ height: `${h}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-sm">
          {months.map((m) => (
            <div key={m} className="flex-1 text-center font-mono text-label-sm text-on-surface-variant">{m}</div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex gap-lg mt-md pt-md border-t border-outline-variant">
          <div className="flex items-center gap-xs">
            <span className="w-3 h-3 bg-primary rounded-sm" />
            <span className="font-mono text-label-sm text-on-surface-variant">Qualified</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="w-3 h-3 bg-secondary/40 rounded-sm" />
            <span className="font-mono text-label-sm text-on-surface-variant">Contacted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
