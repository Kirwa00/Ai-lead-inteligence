import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  industry: z.string().min(1),
  geography: z.string().default("East Africa"),
  companySize: z.string().optional(),
  keywords: z.string().optional(),
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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        model: "claude-opus-4-8",
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

    return NextResponse.json({ companies, mode: "ai" });
  } catch (err) {
    console.error("[research-agent] Anthropic error:", err);
    return NextResponse.json({ companies: demoResults, mode: "demo_fallback" });
  }
}
