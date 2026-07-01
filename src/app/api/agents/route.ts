import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const agentMeta: Record<
  string,
  { icon: string; accuracy: string; avgLatency: string; currentTask: string; description: string; capabilities: string[] }
> = {
  research:           { icon: "travel_explore", accuracy: "94.2%", avgLatency: "1.2s", currentTask: "Scanning SaaS companies in Nairobi tech hub",             description: "Discovers companies matching your ICP across the web, LinkedIn, and business directories.",         capabilities: ["Web scraping", "LinkedIn lookup", "Company profiling", "Industry classification"] },
  qualification:      { icon: "verified",       accuracy: "91.8%", avgLatency: "0.8s", currentTask: "Scoring new FinTech prospects",                            description: "Scores and ranks companies against your ICP criteria using a weighted scoring model.",             capabilities: ["ICP scoring", "Revenue estimation", "Growth signal detection", "Rank ordering"] },
  contact_discovery:  { icon: "contacts",       accuracy: "88.5%", avgLatency: "2.1s", currentTask: "Finding C-suite contacts",                                  description: "Finds decision-makers and their verified business emails for qualified companies.",                capabilities: ["Title matching", "Email pattern generation", "LinkedIn enrichment", "Phone lookup"] },
  email_verification: { icon: "mark_email_read",accuracy: "99.1%", avgLatency: "0.4s", currentTask: "Awaiting next batch",                                        description: "Validates email deliverability and detects risky or catch-all addresses before sending.",         capabilities: ["SMTP verification", "Catch-all detection", "Disposable detection", "Confidence scoring"] },
  outreach:           { icon: "send",           accuracy: "—",     avgLatency: "3.4s", currentTask: "Writing personalised intro emails",                          description: "Generates hyper-personalised email and LinkedIn messages using company research context.",         capabilities: ["Email personalisation", "LinkedIn messages", "Follow-up sequences", "Subject line optimisation"] },
  followup:           { icon: "reply_all",      accuracy: "—",     avgLatency: "—",    currentTask: "Awaiting human approval to resume",                          description: "Monitors inboxes, classifies replies, and schedules intelligent follow-up touchpoints.",          capabilities: ["Reply classification", "Meeting detection", "Objection handling", "Auto-scheduling"] },
  reporting:          { icon: "assessment",     accuracy: "—",     avgLatency: "0.9s", currentTask: "Generating weekly performance report",                       description: "Builds live dashboards, computes KPIs, and recommends campaign optimisations.",                   capabilities: ["KPI computation", "Trend analysis", "Anomaly detection", "PDF report generation"] },
};

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbAgents = await prisma.aIAgent.findMany({ orderBy: { createdAt: "asc" } });

  const agents = dbAgents.map((a) => {
    const meta = agentMeta[a.type] ?? { icon: "smart_toy", accuracy: "—", avgLatency: "—", currentTask: "Idle", description: "", capabilities: [] };
    return { id: a.id, name: a.name, type: a.type, status: a.status, tasksToday: a.tasksTotal, ...meta };
  });

  const summary = {
    active: agents.filter((a) => a.status === "active").length,
    total: agents.length,
    tasksToday: agents.reduce((s, a) => s + a.tasksToday, 0),
  };

  return NextResponse.json({ agents, summary });
}
