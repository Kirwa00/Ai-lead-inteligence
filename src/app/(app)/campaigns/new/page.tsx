"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const steps = [
  { id: 1, label: "Setup", icon: "settings" },
  { id: 2, label: "Targeting", icon: "my_location" },
  { id: 3, label: "AI Agents", icon: "smart_toy" },
  { id: 4, label: "Review", icon: "fact_check" },
];

const AGENT_LIST = [
  { name: "Research Agent", icon: "travel_explore", description: "Discovers matching companies from web & directories." },
  { name: "Qualification Agent", icon: "verified", description: "Scores and ranks companies against your ICP." },
  { name: "Contact Discovery", icon: "contacts", description: "Finds decision-makers and their emails." },
  { name: "Email Verification", icon: "mark_email_read", description: "Validates emails before sending." },
  { name: "Outreach Agent", icon: "send", description: "Writes personalised outreach messages." },
  { name: "Follow-up Agent", icon: "reply_all", description: "Automates intelligent follow-up sequences." },
];

type Form = {
  name: string;
  goal: string;
  description: string;
  startDate: string;
  industry: string;
  geography: string;
  companySize: string;
  targetTitle: string;
  keywords: string;
  exclusions: string;
  agents: Record<string, boolean>;
};

const defaultForm: Form = {
  name: "",
  goal: "Generate qualified leads",
  description: "",
  startDate: "",
  industry: "FinTech",
  geography: "Kenya",
  companySize: "11–50 employees",
  targetTitle: "",
  keywords: "",
  exclusions: "",
  agents: Object.fromEntries(
    AGENT_LIST.map((a, i) => [a.name, i < 5])
  ),
};

const inputClass =
  "w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-xs">
      <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

export default function NewCampaignPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(defaultForm);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleAgent(name: string) {
    setForm((f) => ({ ...f, agents: { ...f.agents, [name]: !f.agents[name] } }));
  }

  async function launch() {
    setLoading(true);
    try {
      await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name || "Untitled Campaign",
          goal: form.goal,
          description: form.description,
          industry: form.industry,
          geography: form.geography,
          companySize: form.companySize,
          targetTitles: form.targetTitle,
          keywords: form.keywords,
        }),
      });
      router.push("/campaigns");
    } catch {
      setLoading(false);
    }
  }

  const selectedAgentCount = Object.values(form.agents).filter(Boolean).length;

  return (
    <div className="space-y-lg py-lg max-w-3xl">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">New Campaign</h1>
        <p className="text-body-md text-on-surface-variant">Configure your AI-powered lead generation campaign.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <button
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-sm p-md rounded-xl border transition-all w-full ${
                step === s.id
                  ? "bg-surface-container-low border-primary text-primary"
                  : step > s.id
                  ? "bg-surface-container-low border-outline-variant text-on-surface-variant"
                  : "border-transparent text-on-surface-variant opacity-50"
              }`}
            >
              <div
                className={`w-6 h-6 rounded flex items-center justify-center text-label-sm font-mono font-bold ${
                  step === s.id
                    ? "bg-primary text-on-primary"
                    : step > s.id
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {step > s.id ? (
                  <span className="material-symbols-outlined text-sm">check</span>
                ) : (
                  s.id
                )}
              </div>
              <span className="font-mono text-label-md">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="h-px w-4 bg-outline-variant flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow">
        {step === 1 && (
          <div className="space-y-lg">
            <h2 className="text-headline-sm font-semibold text-on-surface">Campaign Setup</h2>
            <Field label="Campaign Name">
              <input
                className={inputClass}
                placeholder="e.g. Kenya FinTech Outreach Q3 2026"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="Campaign Goal">
              <select
                className={inputClass}
                value={form.goal}
                onChange={(e) => set("goal", e.target.value)}
              >
                <option>Generate qualified leads</option>
                <option>Book discovery calls</option>
                <option>Drive demo signups</option>
                <option>Market research</option>
              </select>
            </Field>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={3}
                placeholder="Describe the campaign objective and target audience..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field label="Start Date">
              <input
                className={inputClass}
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-lg">
            <h2 className="text-headline-sm font-semibold text-on-surface">Ideal Customer Profile (ICP)</h2>
            <div className="grid grid-cols-2 gap-md">
              <Field label="Industry">
                <select
                  className={inputClass}
                  value={form.industry}
                  onChange={(e) => set("industry", e.target.value)}
                >
                  <option>FinTech</option>
                  <option>SaaS</option>
                  <option>Healthcare</option>
                  <option>Logistics</option>
                  <option>AgriTech</option>
                  <option>CleanTech</option>
                  <option>EdTech</option>
                  <option>Real Estate</option>
                </select>
              </Field>
              <Field label="Geography">
                <select
                  className={inputClass}
                  value={form.geography}
                  onChange={(e) => set("geography", e.target.value)}
                >
                  <option>Kenya</option>
                  <option>East Africa</option>
                  <option>Pan-Africa</option>
                  <option>Global</option>
                </select>
              </Field>
              <Field label="Company Size">
                <select
                  className={inputClass}
                  value={form.companySize}
                  onChange={(e) => set("companySize", e.target.value)}
                >
                  <option>1–10 employees</option>
                  <option>11–50 employees</option>
                  <option>51–200 employees</option>
                  <option>201–1000 employees</option>
                  <option>1000+ employees</option>
                </select>
              </Field>
              <Field label="Target Title">
                <input
                  className={inputClass}
                  placeholder="e.g. CEO, CTO, Head of Growth"
                  value={form.targetTitle}
                  onChange={(e) => set("targetTitle", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Keywords / Topics">
              <input
                className={inputClass}
                placeholder="e.g. mobile payments, digital lending, BNPL"
                value={form.keywords}
                onChange={(e) => set("keywords", e.target.value)}
              />
            </Field>
            <Field label="Exclusions">
              <input
                className={inputClass}
                placeholder="Companies or domains to exclude..."
                value={form.exclusions}
                onChange={(e) => set("exclusions", e.target.value)}
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-md">
            <h2 className="text-headline-sm font-semibold text-on-surface">Assign AI Agents</h2>
            <p className="text-body-sm text-on-surface-variant">Select which agents will run in this campaign.</p>
            <div className="space-y-sm">
              {AGENT_LIST.map((a) => {
                const enabled = form.agents[a.name];
                return (
                  <div
                    key={a.name}
                    onClick={() => toggleAgent(a.name)}
                    className={`flex items-center gap-md p-md rounded-xl border transition-colors cursor-pointer ${
                      enabled
                        ? "border-primary/30 bg-primary/5"
                        : "border-outline-variant bg-surface-container-high"
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {a.icon}
                    </span>
                    <div className="flex-1">
                      <div className="text-body-sm font-medium text-on-surface">{a.name}</div>
                      <div className="font-mono text-label-sm text-on-surface-variant">{a.description}</div>
                    </div>
                    <div
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        enabled ? "bg-primary" : "bg-surface-container-highest"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-lg">
            <h2 className="text-headline-sm font-semibold text-on-surface">Review & Launch</h2>
            <div className="bg-surface-container-high border border-outline-variant rounded-xl p-lg space-y-md">
              {[
                ["Campaign Name", form.name || "(Untitled)"],
                ["Goal", form.goal],
                ["Industry", form.industry],
                ["Geography", form.geography],
                ["Company Size", form.companySize],
                ["Target Title", form.targetTitle || "(Any)"],
                ["Keywords", form.keywords || "(None)"],
                ["Agents", `${selectedAgentCount} of ${AGENT_LIST.length} selected`],
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="flex justify-between border-b border-outline-variant pb-md last:border-0 last:pb-0"
                >
                  <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
                    {label}
                  </span>
                  <span className="text-body-sm text-on-surface">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-sm p-md bg-primary/5 border border-primary/20 rounded-xl">
              <span
                className="material-symbols-outlined text-primary text-body-md"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                info
              </span>
              <p className="text-body-sm text-on-surface-variant">
                Launching will start the Research Agent immediately. You can pause or edit the campaign at any time.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Nav buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : router.push("/campaigns"))}
          className="flex items-center gap-xs px-lg py-sm border border-outline-variant text-on-surface-variant font-mono text-label-md rounded-xl hover:border-primary hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-body-sm">arrow_back</span>
          {step === 1 ? "Cancel" : "Back"}
        </button>
        <button
          disabled={loading}
          onClick={() => (step < 4 ? setStep(step + 1) : launch())}
          className="flex items-center gap-xs px-lg py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="material-symbols-outlined text-body-sm animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-body-sm">
              {step === 4 ? "rocket_launch" : "arrow_forward"}
            </span>
          )}
          {loading ? "Launching…" : step === 4 ? "Launch Campaign" : "Continue"}
        </button>
      </div>
    </div>
  );
}
