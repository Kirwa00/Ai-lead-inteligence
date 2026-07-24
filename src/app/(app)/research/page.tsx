"use client";

import { useState } from "react";
import { INDUSTRIES } from "@/lib/industries";

type CompanyMatch = {
  name: string;
  industry: string;
  geography: string;
  size: string;
  description: string;
  fitScore: number;
  signals: string[];
};

const inputClass =
  "w-full bg-surface-container-high border border-outline-variant text-on-surface text-body-sm px-md py-sm rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-on-surface-variant";

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 85 ? "text-primary border-primary" : score >= 70 ? "text-secondary border-secondary" : "text-on-surface-variant border-outline-variant";
  return (
    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-mono text-label-md font-bold shrink-0 ${color}`}>
      {score}
    </div>
  );
}

export default function ResearchPage() {
  const [industry, setIndustry] = useState("FinTech");
  const [geography, setGeography] = useState("Kenya");
  const [companySize, setCompanySize] = useState("11–200 employees");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CompanyMatch[] | null>(null);
  const [mode, setMode] = useState<string>("");
  const [error, setError] = useState("");

  async function runResearch() {
    setLoading(true);
    setResults(null);
    setError("");
    try {
      const res = await fetch("/api/agents/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ industry, geography, companySize, keywords }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setResults(data.companies);
      setMode(data.mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-lg py-lg">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Research Agent</h1>
          <p className="text-body-md text-on-surface-variant">
            AI-powered company discovery — define your ICP and let Claude find the matches.
          </p>
        </div>
        <div className="flex items-center gap-xs px-sm py-xs bg-surface-container-high rounded border border-outline-variant">
          <span className="material-symbols-outlined text-primary text-body-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            travel_explore
          </span>
          <span className="font-mono text-label-sm text-primary uppercase">Research Agent · Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* ICP form */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow space-y-lg">
          <h2 className="text-headline-sm font-semibold text-on-surface">Define Your ICP</h2>

          <div className="space-y-xs">
            <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Industry</label>
            <select className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {INDUSTRIES.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="space-y-xs">
            <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Geography</label>
            <select className={inputClass} value={geography} onChange={(e) => setGeography(e.target.value)}>
              <option>Kenya</option>
              <option>East Africa</option>
              <option>West Africa</option>
              <option>Pan-Africa</option>
              <option>Nigeria</option>
              <option>South Africa</option>
              <option>Global</option>
            </select>
          </div>

          <div className="space-y-xs">
            <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Company Size</label>
            <select className={inputClass} value={companySize} onChange={(e) => setCompanySize(e.target.value)}>
              <option>1–10 employees</option>
              <option>11–50 employees</option>
              <option>11–200 employees</option>
              <option>51–200 employees</option>
              <option>201–1000 employees</option>
              <option>1000+ employees</option>
            </select>
          </div>

          <div className="space-y-xs">
            <label className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">
              Keywords <span className="normal-case text-on-surface-variant">(optional)</span>
            </label>
            <input
              className={inputClass}
              placeholder="e.g. digital payments, BNPL, Series A"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>

          <button
            onClick={runResearch}
            disabled={loading}
            className="w-full flex items-center justify-center gap-sm py-sm bg-primary-container text-on-primary-container font-mono text-label-md font-bold rounded-xl hover:brightness-105 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined text-body-sm animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-body-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                travel_explore
              </span>
            )}
            {loading ? "Researching…" : "Run Research"}
          </button>

          {mode === "demo" && !loading && results && (
            <p className="font-mono text-label-sm text-on-surface-variant text-center">
              Demo mode · Set <span className="text-primary">ANTHROPIC_API_KEY</span> for live AI results
            </p>
          )}
          {mode === "ai" && !loading && results && (
            <p className="font-mono text-label-sm text-primary text-center flex items-center justify-center gap-xs">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Powered by Claude Opus 4.8
            </p>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-md">
          {!results && !loading && !error && (
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-2xl flex flex-col items-center justify-center text-center h-64 ai-glow">
              <span
                className="material-symbols-outlined text-primary mb-md"
                style={{ fontSize: "3rem", fontVariationSettings: "'FILL' 1" }}
              >
                travel_explore
              </span>
              <p className="text-body-md font-semibold text-on-surface mb-xs">Ready to discover companies</p>
              <p className="text-body-sm text-on-surface-variant">
                Configure your ICP on the left and click <strong>Run Research</strong> to find matching prospects.
              </p>
            </div>
          )}

          {loading && (
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-2xl flex flex-col items-center justify-center text-center h-64 ai-glow">
              <span className="material-symbols-outlined text-primary animate-spin mb-md" style={{ fontSize: "2rem" }}>
                progress_activity
              </span>
              <p className="text-body-md font-semibold text-on-surface mb-xs">Research in progress…</p>
              <p className="font-mono text-label-sm text-on-surface-variant">
                Scanning {geography} {industry} companies
              </p>
            </div>
          )}

          {error && (
            <div className="bg-surface-container-low border border-error/30 rounded-xl p-lg flex items-start gap-md">
              <span className="material-symbols-outlined text-error">error</span>
              <div>
                <p className="text-body-sm font-semibold text-error mb-xs">Research failed</p>
                <p className="text-body-sm text-on-surface-variant">{error}</p>
              </div>
            </div>
          )}

          {results && results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-headline-sm font-semibold text-on-surface">
                  {results.length} Companies Found
                </h2>
                <button className="flex items-center gap-xs px-md py-xs border border-outline-variant text-on-surface-variant font-mono text-label-sm rounded-xl hover:border-primary hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-body-sm">download</span>
                  Export
                </button>
              </div>
              <div className="space-y-md">
                {results.map((company, i) => (
                  <div
                    key={i}
                    className="bg-surface-container-low border border-outline-variant rounded-xl p-lg ai-glow hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start gap-md">
                      <ScoreRing score={company.fitScore} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-md mb-xs">
                          <h3 className="text-body-md font-semibold text-on-surface">{company.name}</h3>
                          <div className="flex gap-xs shrink-0">
                            <span className="font-mono text-label-sm px-sm py-xs rounded border text-on-surface-variant bg-surface-container-high border-outline-variant">
                              {company.industry}
                            </span>
                            <span className="font-mono text-label-sm px-sm py-xs rounded border text-on-surface-variant bg-surface-container-high border-outline-variant">
                              {company.size}
                            </span>
                          </div>
                        </div>
                        <p className="font-mono text-label-sm text-secondary mb-sm">{company.geography}</p>
                        <p className="text-body-sm text-on-surface-variant mb-md">{company.description}</p>
                        <div className="flex flex-wrap gap-xs">
                          {company.signals.map((signal) => (
                            <span
                              key={signal}
                              className="font-mono text-label-sm px-sm py-xs rounded border text-primary bg-primary/5 border-primary/20 flex items-center gap-xs"
                            >
                              <span className="material-symbols-outlined text-sm">trending_up</span>
                              {signal}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-sm mt-md pt-md border-t border-outline-variant justify-end">
                      <button className="flex items-center gap-xs px-md py-xs border border-outline-variant text-on-surface-variant font-mono text-label-sm rounded-lg hover:border-primary hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">person_search</span>
                        Find Contacts
                      </button>
                      <button className="flex items-center gap-xs px-md py-xs bg-primary-container text-on-primary-container font-mono text-label-sm font-bold rounded-lg hover:brightness-105 transition-all active:scale-95">
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add to Campaign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
