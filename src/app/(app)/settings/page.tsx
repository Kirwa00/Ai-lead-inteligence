const sections = [
  {
    title: "Organisation",
    items: [
      { label: "Organisation Name", value: "Enterprise Global", type: "text" },
      { label: "Billing Email", value: "admin@enterprise.global", type: "email" },
      { label: "Timezone", value: "Africa/Nairobi (EAT +3)", type: "select" },
    ],
  },
  {
    title: "AI Configuration",
    items: [
      { label: "Default AI Model", value: "Claude Opus 4.8", type: "select" },
      { label: "Max Concurrent Agent Tasks", value: "50", type: "number" },
      { label: "Human-in-the-Loop", value: "Campaign launch, Large exports", type: "text" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { label: "HubSpot CRM", value: "Connected", type: "badge-success" },
      { label: "LinkedIn Sales Nav", value: "Not connected", type: "badge-warning" },
      { label: "Slack Notifications", value: "Connected", type: "badge-success" },
      { label: "SendGrid", value: "Connected", type: "badge-success" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-lg py-lg max-w-3xl">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Settings</h1>
        <p className="text-body-md text-on-surface-variant">
          Manage your organisation, AI, and integration preferences.
        </p>
      </div>

      {sections.map((section) => (
        <div
          key={section.title}
          className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden"
        >
          <div className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest">
            <h2 className="text-headline-sm font-semibold text-on-surface">{section.title}</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {section.items.map(({ label, value, type }) => (
              <div key={label} className="px-lg py-md flex items-center justify-between">
                <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
                  {label}
                </span>
                {type === "badge-success" && (
                  <span className="font-mono text-label-sm px-sm py-xs rounded border text-primary bg-primary/10 border-primary/20">
                    {value}
                  </span>
                )}
                {type === "badge-warning" && (
                  <div className="flex items-center gap-sm">
                    <span className="font-mono text-label-sm px-sm py-xs rounded border text-on-surface-variant bg-surface-container-high border-outline-variant">
                      {value}
                    </span>
                    <button className="font-mono text-label-sm text-primary hover:underline">Connect</button>
                  </div>
                )}
                {!type.startsWith("badge") && (
                  <input
                    className="bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition-all text-right"
                    defaultValue={value}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end gap-sm">
        <button className="px-lg py-sm border border-outline-variant text-on-surface-variant font-mono text-label-md rounded-xl hover:border-primary hover:text-primary transition-colors">
          Discard Changes
        </button>
        <button className="px-lg py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95">
          Save Settings
        </button>
      </div>
    </div>
  );
}
