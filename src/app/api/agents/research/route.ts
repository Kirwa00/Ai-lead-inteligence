import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBalanceMicros, debitForUsage } from "@/lib/wallet";
import { microsToUsd, RESEARCH_RUN_RESERVE_MICROS } from "@/lib/billing";
import { rateLimit, tooMany } from "@/lib/rate-limit";

const MODEL = "claude-opus-4-8";

const requestSchema = z.object({
  industry: z.string().min(1).max(100),
  geography: z.string().max(100).default("East Africa"),
  companySize: z.string().max(60).optional(),
  keywords: z.string().max(500).optional(),
});

type CompanyMatch = {
  name: string;
  industry: string;
  geography: string;
  size: string;
  description: string;
  fitScore: number;
  signals: string[];
};

const demoResults: CompanyMatch[] = [
  {
    name: "Flutterwave",
    industry: "FinTech",
    geography: "Nigeria / Pan-Africa",
    size: "501-1000",
    description: "Leading African payments technology company enabling global and local commerce.",
    fitScore: 92,
    signals: ["Recent Series D funding", "Active engineering hiring", "Expanding into East Africa"],
  },
  {
    name: "Chipper Cash",
    industry: "FinTech",
    geography: "Kenya / Uganda",
    size: "201-500",
    description: "Cross-border mobile money transfer platform operating across 7 African countries.",
    fitScore: 88,
    signals: ["Growing B2B product suite", "Partnership with Visa", "Series C raise"],
  },
  {
    name: "Lipa Later",
    industry: "FinTech",
    geography: "Kenya",
    size: "51-200",
    description: "Buy-now-pay-later platform for African consumers and merchants.",
    fitScore: 84,
    signals: ["Series A closed", "Merchant network expansion", "New credit product launch"],
  },
  {
    name: "Apollo Agriculture",
    industry: "AgriTech",
    geography: "Kenya",
    size: "51-200",
    description: "Digital farming platform providing credit and farm inputs to smallholder farmers.",
    fitScore: 79,
    signals: ["Impact investor backing", "Rapid farmer acquisition", "New satellite data product"],
  },
  {
    name: "Wasoko",
    industry: "Logistics",
    geography: "East Africa",
    size: "201-500",
    description: "B2B e-commerce platform connecting FMCG brands to informal retailers across Africa.",
    fitScore: 76,
    signals: ["Series B raise", "Expanding distribution network", "New markets in West Africa"],
  },
];

export async function POST(req: NextRequest) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-org throttle — bounds token spend even for a funded account.
  const rl = rateLimit(`research:${orgId}`, 12, 60 * 1000); // 12 / minute / org
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many research runs. Please wait a moment.");

  const body = await req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { industry, geography, companySize, keywords } = parsed.data;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      companies: demoResults,
      mode: "demo",
      message: "Set ANTHROPIC_API_KEY to enable AI-powered research",
    });
  }

  // Balance gate — require at least one run's worth of value before starting.
  // Gating on the reserve (not ">0") bounds concurrent over-spend to one run.
  const balanceBefore = await getBalanceMicros(orgId);
  if (balanceBefore < RESEARCH_RUN_RESERVE_MICROS) {
    return NextResponse.json({
      companies: [],
      mode: "no_credits",
      balanceUsd: microsToUsd(balanceBefore),
      message: "Not enough credits to run the Research Agent. Please top up.",
    });
  }

  const prompt = `You are an expert B2B lead research agent specializing in African markets.
Identify the top 5-8 companies that best match this ideal customer profile:

Industry: ${industry}
Geography: ${geography}
Company size: ${companySize ?? "Any"}
Keywords / focus: ${keywords ?? "General"}

Return a JSON array of company objects. Each object must have exactly these fields:
- name: string
- industry: string (specific segment)
- geography: string (city / country)
- size: string (employee range, e.g. "51-200")
- description: string (1-2 sentences)
- fitScore: number (0-100)
- signals: string[] (2-3 current buying signals or growth triggers)

Respond with ONLY valid JSON — no markdown, no explanation, just the array.`;

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

    if (!response.ok) {
      throw new Error(`Anthropic API returned ${response.status}`);
    }

    const data = await response.json();
    const textBlock = (data.content as Array<{ type: string; text?: string }>)?.find(
      (b) => b.type === "text"
    );
    const rawText = textBlock?.text ?? "[]";

    let companies: CompanyMatch[] = [];
    try {
      companies = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) companies = JSON.parse(match[0]);
    }

    // Meter the real token usage against the wallet. Metering must never break
    // a successful research response, so failures here are logged, not thrown.
    const usage = (data.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
    let balanceUsd: number | undefined;
    let costUsd: number | undefined;
    try {
      const { chargeMicros, balanceMicros } = await debitForUsage({
        organizationId: orgId,
        userId,
        feature: "research",
        agentType: "research",
        model: MODEL,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
      });
      // Customer-facing value: what the run cost them and their remaining balance.
      costUsd = microsToUsd(chargeMicros);
      balanceUsd = microsToUsd(balanceMicros);
    } catch (meterErr) {
      console.error("[research-agent] metering failed:", meterErr);
    }

    return NextResponse.json({ companies, mode: "ai", costUsd, balanceUsd });
  } catch (err) {
    console.error("[research-agent] Anthropic error:", err);
    return NextResponse.json({ companies: demoResults, mode: "demo_fallback" });
  }
}
