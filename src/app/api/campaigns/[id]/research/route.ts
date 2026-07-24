import { auth } from "@/auth";
import { NextResponse } from "next/server";
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
Return ONLY a valid JSON array; each object must have exactly:
- name: string
- industry: string
- geography: string (city / country)
- size: string (employee range)
- description: string (1-2 sentences)
- fitScore: number (0-100)
- signals: string[] (2-3 current buying signals)
No markdown, just the JSON array.`;

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
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const data = await response.json();
    usage = data.usage ?? usage;
    const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find(
      (b) => b.type === "text"
    );
    const rawText = textBlock?.text ?? "[]";
    try {
      companies = JSON.parse(rawText);
    } catch {
      const m = rawText.match(/\[[\s\S]*\]/);
      if (m) companies = JSON.parse(m[0]);
    }
  } catch (err) {
    console.error("[campaign-research] Anthropic error:", err);
    return NextResponse.json({ error: "Research failed. Please try again." }, { status: 502 });
  }

  // Persist matches as Company + Lead rows on this campaign.
  let added = 0;
  for (const c of companies.slice(0, 8)) {
    if (!c?.name) continue;
    try {
      const company = await prisma.company.create({
        data: {
          name: c.name,
          industry: c.industry ?? campaign.industry ?? null,
          size: c.size ?? null,
          country: c.geography ?? campaign.geography ?? null,
          description: c.description ?? null,
        },
      });
      await prisma.lead.create({
        data: {
          campaignId: campaign.id,
          companyId: company.id,
          score: Math.max(0, Math.min(100, Math.round(c.fitScore ?? 0))),
          status: "uncontacted",
          activities: c.signals?.length
            ? { create: { type: "research", note: c.signals.join(" · ") } }
            : undefined,
        },
      });
      added += 1;
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
