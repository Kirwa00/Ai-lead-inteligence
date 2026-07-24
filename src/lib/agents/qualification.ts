import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { debitForUsage } from "@/lib/wallet";
import { AGENT_MODEL, callClaudeJson, TX_OPTS } from "@/lib/agents/shared";
import type { AgentContext, AgentResult } from "@/lib/agents";

const SCHEMA = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          score: { type: "integer" },
          qualified: { type: "boolean" },
          reason: { type: "string" },
        },
        required: ["company", "score", "qualified", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["evaluations"],
  additionalProperties: false,
} as const;

type Evaluation = { company: string; score: number; qualified: boolean; reason: string };

export async function runQualification(ctx: AgentContext): Promise<AgentResult> {
  const leads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id },
    include: { company: true },
  });
  if (leads.length === 0) {
    return { summary: "No leads to qualify — run the Research Agent first." };
  }

  const list = leads
    .map(
      (l, i) =>
        `${i + 1}. ${l.company?.name ?? "Unknown"} — ${l.company?.industry ?? ""}, ${l.company?.country ?? ""}, ${l.company?.size ?? ""}. ${l.company?.description ?? ""}`
    )
    .join("\n");

  const prompt = `You are an expert B2B lead qualification agent.
Score how well each company below fits this campaign's ideal customer profile, and mark it qualified when it is a strong fit (roughly score >= 70).

Campaign ICP — Industry: ${ctx.campaign.industry ?? "Any"}; Geography: ${ctx.campaign.geography ?? "Any"}; Size: ${ctx.campaign.companySize ?? "Any"}; Keywords: ${ctx.campaign.keywords.join(", ") || "General"}.
${ctx.campaign.context ? `What we offer / context:\n${ctx.campaign.context.slice(0, 4000)}\n` : ""}
For each company return: company (exact name as given), score 0-100, qualified (boolean), and a one-line reason.

Companies:
${list}`;

  const { result, usage } = await callClaudeJson<{ evaluations: Evaluation[] }>(prompt, SCHEMA);

  const byName = new Map(result.evaluations.map((e) => [e.company.trim().toLowerCase(), e]));
  let qualified = 0;
  const writes: Prisma.PrismaPromise<unknown>[] = [];

  for (const l of leads) {
    const e = byName.get((l.company?.name ?? "").trim().toLowerCase());
    if (!e) continue;
    if (e.qualified) qualified += 1;
    // Only reclassify leads that haven't progressed yet; never overwrite a
    // contacted/replied lead. Uncontacted -> qualified or disqualified.
    const newStatus =
      l.status === "uncontacted" ? (e.qualified ? "qualified" : "disqualified") : l.status;
    writes.push(
      prisma.lead.update({
        where: { id: l.id },
        data: {
          score: Math.max(0, Math.min(100, Math.round(e.score))),
          status: newStatus,
        },
      })
    );
    writes.push(
      prisma.leadActivity.create({
        data: {
          leadId: l.id,
          type: "qualification",
          note: `${e.qualified ? "Qualified" : "Not qualified"} (${e.score}): ${e.reason}`,
        },
      })
    );
  }
  if (writes.length > 0) await prisma.$transaction(writes, TX_OPTS);

  try {
    await debitForUsage({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      feature: "qualification",
      agentType: "qualification",
      model: AGENT_MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  } catch (err) {
    console.error("[qualification] metering failed:", err);
  }

  return { summary: `Qualified ${qualified} of ${leads.length} leads.` };
}
