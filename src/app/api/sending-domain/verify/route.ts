import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/team";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { refreshDomain } from "@/lib/sending-domain";

export const runtime = "nodejs";

/** Ask the provider to re-check DNS and persist whatever it reports back. */
export async function POST() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  // DNS propagation is slow; hammering Verify helps nobody.
  const rl = rateLimit(`verify-domain:${ctx.orgId}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Give DNS a moment before checking again.");

  try {
    const domain = await refreshDomain(ctx.orgId);
    if (!domain) return NextResponse.json({ error: "No sending domain set up." }, { status: 404 });
    return NextResponse.json({ domain });
  } catch (err) {
    console.error("[sending-domain] verify failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not check the domain." },
      { status: 502 }
    );
  }
}
