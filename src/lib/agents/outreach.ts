import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { debitForUsage } from "@/lib/wallet";
import { AGENT_MODEL, callClaudeJson, TX_OPTS } from "@/lib/agents/shared";
import type { AgentContext, AgentResult } from "@/lib/agents";

const SCHEMA = {
  type: "object",
  properties: {
    emails: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
        required: ["company", "subject", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["emails"],
  additionalProperties: false,
} as const;

type Draft = { company: string; subject: string; body: string };

export async function runOutreach(ctx: AgentContext): Promise<AgentResult> {
  // Draft first-touch emails for leads not yet contacted (prioritise qualified).
  const leads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id, status: { in: ["qualified", "uncontacted"] } },
    include: { company: true, contact: true },
    orderBy: { score: "desc" },
    take: 10,
  });
  if (leads.length === 0) return { summary: "No leads to write outreach for." };

  const list = leads
    .map(
      (l, i) =>
        `${i + 1}. ${l.company?.name ?? "Unknown"} — ${l.company?.industry ?? ""}. Contact: ${l.contact ? `${l.contact.firstName} ${l.contact.lastName}, ${l.contact.title ?? ""}` : "unknown"}. ${l.company?.description ?? ""}`
    )
    .join("\n");

  const prompt = `You are a B2B outreach copywriter. Write a concise, personalised cold email (subject + 60-90 word body) for each company below, tailored to what we offer. Warm, specific, one clear call to action, no fluff.

What we offer / context:
${ctx.campaign.context?.slice(0, 3000) || ctx.campaign.industry || "our solution"}
Campaign goal: ${ctx.campaign.name}

Return company (exact name), subject, and body for each.

Leads:
${list}`;

  const { result, usage } = await callClaudeJson<{ emails: Draft[] }>(prompt, SCHEMA);
  const byName = new Map(result.emails.map((e) => [e.company.trim().toLowerCase(), e]));

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let drafted = 0;
  for (const l of leads) {
    const e = byName.get((l.company?.name ?? "").trim().toLowerCase());
    if (!e) continue;
    writes.push(
      prisma.email.create({
        data: {
          subject: e.subject,
          body: e.body,
          status: "draft",
          campaignId: ctx.campaign.id,
          leadId: l.id,
        },
      })
    );
    drafted += 1;
  }
  if (writes.length > 0) await prisma.$transaction(writes, TX_OPTS);

  try {
    await debitForUsage({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      feature: "outreach",
      agentType: "outreach",
      model: AGENT_MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  } catch (err) {
    console.error("[outreach] metering failed:", err);
  }

  return { summary: `Drafted ${drafted} outreach email${drafted === 1 ? "" : "s"}.` };
}
