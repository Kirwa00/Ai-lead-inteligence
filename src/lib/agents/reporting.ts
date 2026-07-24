import { prisma } from "@/lib/prisma";
import { debitForUsage } from "@/lib/wallet";
import { AGENT_MODEL, callClaudeJson } from "@/lib/agents/shared";
import type { AgentContext, AgentResult } from "@/lib/agents";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "recommendations"],
  additionalProperties: false,
} as const;

export async function runReporting(ctx: AgentContext): Promise<AgentResult> {
  const leads = await prisma.lead.findMany({ where: { campaignId: ctx.campaign.id } });
  const emails = await prisma.email.count({ where: { campaignId: ctx.campaign.id } });

  const metrics = {
    leads: leads.length,
    qualified: leads.filter((l) => l.status === "qualified").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
    replied: leads.filter((l) => l.status === "replied").length,
    meetings: leads.filter((l) => l.status === "meeting_booked").length,
    disqualified: leads.filter((l) => l.status === "disqualified").length,
    avgScore: leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0,
    draftedEmails: emails,
  };

  const prompt = `You are a B2B campaign analyst. Write a brief performance summary (3-4 sentences) and 2-3 concrete next-step recommendations for this campaign.

Campaign: ${ctx.campaign.name} — ${ctx.campaign.industry ?? ""}, ${ctx.campaign.geography ?? ""}.
Metrics: ${JSON.stringify(metrics)}`;

  const { result, usage } = await callClaudeJson<{ summary: string; recommendations: string[] }>(
    prompt,
    SCHEMA,
    1500
  );

  await prisma.report.create({
    data: {
      name: `${ctx.campaign.name} — performance`,
      type: "campaign_summary",
      campaignId: ctx.campaign.id,
      data: { metrics, summary: result.summary, recommendations: result.recommendations },
    },
  });

  try {
    await debitForUsage({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      feature: "reporting",
      agentType: "reporting",
      model: AGENT_MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  } catch (err) {
    console.error("[reporting] metering failed:", err);
  }

  return { summary: result.summary.slice(0, 200) };
}
