import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getBalanceMicros, debitForUsage } from "@/lib/wallet";
import { RESEARCH_RUN_RESERVE_MICROS } from "@/lib/billing";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
const MODEL = "claude-opus-4-8";

type CompanyMatch = {
  name: string;
  industry?: string;
  geography?: string;
  size?: string;
  description?: string;
  fitScore?: number;
  signals?: string[];
};

// Runs the Research Agent scoped to a campaign — uses its ICP + context and
// saves the matches as Leads on the campaign, so the pipeline fills up.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`campaign-research:${orgId}`, 12, 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many runs. Please wait a moment.");

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, organizationId: orgId },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  }

  const balance = await getBalanceMicros(orgId);
  if (balance < RESEARCH_RUN_RESERVE_MICROS) {
    return NextResponse.json(
      { error: "Not enough credits. Please top up.", mode: "no_credits" },
      { status: 402 }
    );
  }

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

  let companies: CompanyMatch[] = [];
  let usage = { input_tokens: 0, output_tokens: 0 };
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        thinking: { type: "adaptive" },
        // Low effort is plenty for a bounded list-generation task and cuts
        // latency substantially; structured output guarantees valid JSON.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: RESULT_SCHEMA },
        },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const data = await response.json();
    usage = data.usage ?? usage;
    const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find(
      (b) => b.type === "text"
    );
    const parsed = JSON.parse(textBlock?.text ?? '{"companies":[]}');
    companies = Array.isArray(parsed) ? parsed : parsed.companies ?? [];
  } catch (err) {
    console.error("[campaign-research] Anthropic error:", err);
    return NextResponse.json({ error: "Research failed. Please try again." }, { status: 502 });
  }

  // Persist matches. Pre-generate ids so this is 3 batched statements in one
  // transaction instead of ~16 sequential round-trips (which dominated the
  // request time against a remote database).
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

  let added = 0;
  if (rows.length > 0) {
    try {
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
      added = rows.length;
    } catch (err) {
      console.error("[campaign-research] save failed:", err);
    }
  }

  // Meter the real token usage against the wallet.
  let balanceUsd: number | undefined;
  try {
    const { balanceMicros } = await debitForUsage({
      organizationId: orgId,
      userId,
      feature: "campaign_research",
      agentType: "research",
      model: MODEL,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
    });
    balanceUsd = Number(balanceMicros) / 1_000_000;
  } catch (err) {
    console.error("[campaign-research] metering failed:", err);
  }

  return NextResponse.json({ added, balanceUsd });
}
