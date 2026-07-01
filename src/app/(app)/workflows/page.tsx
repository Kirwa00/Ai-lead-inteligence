const workflowSteps = [
  { label: "Receive Campaign", icon: "inbox", status: "done" },
  { label: "Understand ICP", icon: "manage_search", status: "done" },
  { label: "Research Companies", icon: "travel_explore", status: "active" },
  { label: "Extract Contacts", icon: "contacts", status: "pending" },
  { label: "Verify Emails", icon: "mark_email_read", status: "pending" },
  { label: "Score Leads", icon: "verified", status: "pending" },
  { label: "Store in Database", icon: "storage", status: "pending" },
  { label: "Generate Outreach", icon: "send", status: "pending" },
  { label: "Human Approval", icon: "how_to_reg", status: "pending" },
  { label: "Launch Campaign", icon: "rocket_launch", status: "pending" },
  { label: "Monitor Replies", icon: "forum", status: "pending" },
  { label: "Generate Reports", icon: "assessment", status: "pending" },
];

const statusStyle: Record<string, { icon: string; color: string; ring: string }> = {
  done: { icon: "check_circle", color: "text-primary bg-primary/10 border-primary/30", ring: "ring-primary/20" },
  active: { icon: "pending", color: "text-secondary bg-secondary/10 border-secondary/30", ring: "ring-secondary/20 animate-status-pulse" },
  pending: { icon: "radio_button_unchecked", color: "text-on-surface-variant bg-surface-container-high border-outline-variant", ring: "" },
};

export default function WorkflowsPage() {
  return (
    <div className="space-y-lg py-lg">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Workflow Monitor</h1>
        <p className="text-body-md text-on-surface-variant">Real-time view of the lead generation pipeline.</p>
      </div>

      {/* Active workflow */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow">
        <div className="flex justify-between items-center mb-lg">
          <div>
            <h2 className="text-headline-sm font-bold text-on-surface">Kenya FinTech Outreach Q3</h2>
            <span className="font-mono text-label-sm text-on-surface-variant">Step 3 of 12 · Started 2 hours ago</span>
          </div>
          <div className="flex items-center gap-xs px-sm py-xs bg-surface-container-high rounded border border-outline-variant">
            <span className="w-2 h-2 bg-primary rounded-full animate-status-pulse" />
            <span className="font-mono text-label-sm text-primary uppercase">Running</span>
          </div>
        </div>

        {/* Pipeline steps */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-outline-variant" />
          <div className="space-y-sm">
            {workflowSteps.map((step, i) => {
              const st = statusStyle[step.status];
              return (
                <div key={i} className="flex items-center gap-md relative">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center z-10 ${st.color}`}>
                    <span className="material-symbols-outlined text-body-sm" style={step.status !== "pending" ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      {step.status === "done" ? "check_circle" : step.status === "active" ? step.icon : step.icon}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-between">
                    <span className={`text-body-sm ${step.status === "pending" ? "text-on-surface-variant" : "text-on-surface font-medium"}`}>
                      {step.label}
                    </span>
                    {step.status === "done" && <span className="font-mono text-label-sm text-primary">Completed</span>}
                    {step.status === "active" && <span className="font-mono text-label-sm text-secondary animate-status-pulse">In Progress</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live agent log */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg font-mono text-label-md">
        <h2 className="text-headline-sm font-bold text-on-surface mb-md">Live Agent Log</h2>
        <div className="space-y-xs text-on-surface-variant">
          {[
            { time: "14:32:01", agent: "Research", msg: "Found 23 FinTech companies matching ICP in Nairobi" },
            { time: "14:31:48", agent: "Research", msg: "Scanning Crunchbase for Series A+ startups" },
            { time: "14:31:12", agent: "Research", msg: "Cross-referencing with LinkedIn company data" },
            { time: "14:30:55", agent: "ICP Analyzer", msg: "ICP definition parsed: FinTech, Kenya, 11–200 emp, CEO/CTO" },
            { time: "14:30:40", agent: "System", msg: "Campaign workflow started" },
          ].map(({ time, agent, msg }) => (
            <div key={time} className="flex gap-md">
              <span className="text-outline shrink-0">[{time}]</span>
              <span className="text-secondary shrink-0">[{agent}]</span>
              <span className="text-on-surface-variant">{msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
