import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { debitForUsage } from "@/lib/wallet";

// Sonnet 5 is materially cheaper/faster than Opus 4.8, so each credit package
// buys more runs. Override with RESEARCH_MODEL if lead quality needs Opus.
export const RESEARCH_MODEL = process.env.RESEARCH_MODEL || "claude-sonnet-5";

export type CompanyMatch = {
  name: string;
  industry?: string;
  geography?: string;
  size?: string;
  description?: string;
  fitScore?: number;
  signals?: string[];
};

// Guaranteed-valid JSON out — no markdown, no prose, no fragile regex parsing.
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          industry: { type: "string" },
          geography: { type: "string" },
          size: { type: "string" },
          description: { type: "string" },
          fitScore: { type: "integer" },
          signals: { type: "array", items: { type: "string" } },
        },
        required: ["name", "industry", "geography", "size", "description", "fitScore", "signals"],
        additionalProperties: false,
      },
    },
  },
  required: ["companies"],
  additionalProperties: false,
} as const;

type CampaignForResearch = {
  id: string;
  name: string;
  industry: string | null;
  geography: string | null;
  companySize: string | null;
  keywords: string[];
  context: string | null;
};

/**
 * Runs the Research Agent for a campaign: calls Claude with the campaign's ICP
 * + product context, persists the matches as Company/Lead rows, and meters the
 * token spend against the org's wallet. Returns how many leads were added.
 */
export async function runCampaignResearch(
  campaign: CampaignForResearch,
  organizationId: string,
  userId?: string | null
): Promise<number> {
  const prompt = `You are an expert B2B lead research agent specializing in African markets.
Find the top 5-8 companies that best match this campaign's ideal customer profile.

Campaign: ${campaign.name}
Industry: ${campaign.industry ?? "Any"}
Geography: ${campaign.geography ?? "Any"}
Company size: ${campaign.companySize ?? "Any"}
Keywords: ${campaign.keywords.join(", ") || "General"}
${campaign.context ? `\nWhat we offer / context:\n${campaign.context.slice(0, 6000)}` : ""}

Prioritise companies that would genuinely benefit from what we offer.
For each: a 1-2 sentence description, a fitScore 0-100, and 2-3 current buying signals.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: RESEARCH_MODEL,
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: RESULT_SCHEMA },
      },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}`);

  const data = await response.json();
  const usage = (data.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
  const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find(
    (b) => b.type === "text"
  );
  const parsed = JSON.parse(textBlock?.text ?? '{"companies":[]}');
  const companies: CompanyMatch[] = Array.isArray(parsed) ? parsed : parsed.companies ?? [];

  // Batched persistence: 3 statements in one transaction rather than ~16
  // sequential round-trips (which dominated latency against a remote DB).
  const rows = companies
    .slice(0, 8)
    .filter((c) => c?.name)
    .map((c) => ({
      companyId: randomUUID(),
      leadId: randomUUID(),
      name: c.name,
      industry: c.industry ?? campaign.industry ?? null,
      size: c.size ?? null,
      country: c.geography ?? campaign.geography ?? null,
      description: c.description ?? null,
      score: Math.max(0, Math.min(100, Math.round(c.fitScore ?? 0))),
      signals: c.signals?.length ? c.signals.join(" · ") : null,
    }));

  if (rows.length > 0) {
    await prisma.$transaction([
      prisma.company.createMany({
        data: rows.map((r) => ({
          id: r.companyId,
          name: r.name,
          industry: r.industry,
          size: r.size,
          country: r.country,
          description: r.description,
        })),
      }),
      prisma.lead.createMany({
        data: rows.map((r) => ({
          id: r.leadId,
          campaignId: campaign.id,
          companyId: r.companyId,
          score: r.score,
          status: "uncontacted",
        })),
      }),
      prisma.leadActivity.createMany({
        data: rows
          .filter((r) => r.signals)
          .map((r) => ({ leadId: r.leadId, type: "research", note: r.signals as string })),
      }),
    ]);
  }

  // Meter the real token usage — never let a metering failure lose the leads.
  try {
    await debitForUsage({
      organizationId,
      userId,
      feature: "campaign_research",
      agentType: "research",
      model: RESEARCH_MODEL,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
    });
  } catch (err) {
    console.error("[research] metering failed:", err);
  }

  return rows.length;
}
