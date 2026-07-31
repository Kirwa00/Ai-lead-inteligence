import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBalanceMicros, debitForUsage } from "@/lib/wallet";
import { microsToUsd, RESEARCH_RUN_RESERVE_MICROS } from "@/lib/billing";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { callAgentJson, llmConfigured } from "@/lib/agents/shared";
import { getOrgLlmProvider } from "@/lib/llm-provider";

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

  const llmProvider = await getOrgLlmProvider(orgId);

  if (!llmConfigured(llmProvider)) {
    return NextResponse.json({
      companies: demoResults,
      mode: "demo",
      message: "AI is not configured yet — set the relevant provider API key to enable live research.",
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

For each: a 1-2 sentence description, a fitScore 0-100, and 2-3 current buying signals or growth triggers.`;

  try {
    const { result, usage, model } = await callAgentJson<{ companies: CompanyMatch[] }>(
      prompt,
      RESULT_SCHEMA,
      3000,
      llmProvider
    );
    const companies = result.companies ?? [];

    // Meter the real token usage against the wallet. Metering must never break
    // a successful research response, so failures here are logged, not thrown.
    let balanceUsd: number | undefined;
    let costUsd: number | undefined;
    try {
      const { chargeMicros, balanceMicros } = await debitForUsage({
        organizationId: orgId,
        userId,
        feature: "research",
        agentType: "research",
        model,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
      });
      // Customer-facing value: what the run cost them and their remaining balance.
      costUsd = microsToUsd(chargeMicros);
      balanceUsd = microsToUsd(balanceMicros);
    } catch (meterErr) {
      console.error("[research-agent] metering failed:", meterErr);
    }

    return NextResponse.json({ companies, mode: "ai", costUsd, balanceUsd });
  } catch (err) {
    console.error("[research-agent] LLM error:", err);
    return NextResponse.json({ companies: demoResults, mode: "demo_fallback" });
  }
}
