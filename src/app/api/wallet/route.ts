import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getBalanceMicros } from "@/lib/wallet";
import { microsToUsd, valueMicrosToTokenBudgetUsd } from "@/lib/billing";

export const runtime = "nodejs";

// Rough per-run *value* charged for the Research Agent (~$0.05 raw x 7),
// used only for a friendly "runs remaining" estimate in the UI.
const APPROX_RESEARCH_RUN_VALUE_USD = 0.35;

export async function GET() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balanceMicros = await getBalanceMicros(orgId);
  const balanceUsd = microsToUsd(balanceMicros); // customer-facing value

  return NextResponse.json({
    // What the customer sees: their service-value balance.
    balanceUsd,
    balanceMicros: Number(balanceMicros),
    // Behind the scenes: the raw token budget that value buys (the 1/7).
    tokenBudgetUsd: valueMicrosToTokenBudgetUsd(balanceMicros),
    approxResearchRuns: Math.max(0, Math.floor(balanceUsd / APPROX_RESEARCH_RUN_VALUE_USD)),
  });
}
