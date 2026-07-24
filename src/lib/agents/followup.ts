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

export async function runFollowup(ctx: AgentContext): Promise<AgentResult> {
  // Follow-ups for leads already contacted but not yet replied.
  const leads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id, status: "contacted" },
    include: { company: true, contact: true },
    take: 10,
  });
  if (leads.length === 0) return { summary: "No contacted leads awaiting follow-up." };

  const list = leads
    .map((l, i) => `${i + 1}. ${l.company?.name ?? "Unknown"} — contact ${l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : "unknown"}.`)
    .join("\n");

  const prompt = `You are a B2B follow-up copywriter. These leads were emailed once and haven't replied. Write a short, polite, value-adding follow-up (subject + 40-70 word body) for each — reference the prior outreach lightly, add one new angle or proof point, and a soft call to action.

What we offer / context:
${ctx.campaign.context?.slice(0, 2500) || ctx.campaign.industry || "our solution"}

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
      feature: "followup",
      agentType: "followup",
      model: AGENT_MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  } catch (err) {
    console.error("[followup] metering failed:", err);
  }

  return { summary: `Drafted ${drafted} follow-up email${drafted === 1 ? "" : "s"}.` };
}
