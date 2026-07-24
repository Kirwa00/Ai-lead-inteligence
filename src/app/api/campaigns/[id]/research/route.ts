import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { getBalanceMicros } from "@/lib/wallet";
import { RESEARCH_RUN_RESERVE_MICROS } from "@/lib/billing";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { runCampaignResearch } from "@/lib/research";

export const runtime = "nodejs";

/**
 * Queues a Research Agent run and returns immediately (202) so the UI never
 * blocks on the ~20s LLM call. Progress is polled via GET.
 */
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

  // Don't stack concurrent runs for the same campaign.
  const inFlight = await prisma.researchJob.findFirst({
    where: { campaignId: campaign.id, status: { in: ["queued", "running"] } },
  });
  if (inFlight) {
    return NextResponse.json({ jobId: inFlight.id, status: inFlight.status }, { status: 202 });
  }

  const job = await prisma.researchJob.create({
    data: { campaignId: campaign.id, organizationId: orgId, status: "running" },
  });

  // Run detached. waitUntil keeps the serverless function alive past the
  // response; locally the promise simply resolves in the long-lived process.
  const work = (async () => {
    try {
      const added = await runCampaignResearch(campaign, orgId, userId);
      await prisma.researchJob.update({
        where: { id: job.id },
        data: { status: "succeeded", added, completedAt: new Date() },
      });
    } catch (err) {
      console.error("[campaign-research] job failed:", err);
      await prisma.researchJob
        .update({
          where: { id: job.id },
          data: {
            status: "failed",
            error: err instanceof Error ? err.message : "Research failed",
            completedAt: new Date(),
          },
        })
        .catch(() => {});
    }
  })();
  waitUntil(work);

  return NextResponse.json({ jobId: job.id, status: "running" }, { status: 202 });
}

/** Poll the latest (or a specific) research job for this campaign. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = new URL(req.url).searchParams.get("jobId");
  const job = await prisma.researchJob.findFirst({
    where: {
      ...(jobId ? { id: jobId } : {}),
      campaignId: params.id,
      organizationId: orgId, // org-scoped
    },
    orderBy: { createdAt: "desc" },
  });

  if (!job) return NextResponse.json({ status: "none" });
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    added: job.added,
    error: job.error,
  });
}
