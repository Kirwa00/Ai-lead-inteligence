import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { getBalanceMicros } from "@/lib/wallet";
import { RESEARCH_RUN_RESERVE_MICROS } from "@/lib/billing";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";

// Queue a campaign-scoped agent run; return 202 immediately, work runs in the
// background (waitUntil), poll via GET. See ai-agent-build-playbook.
export async function POST(_req: Request, { params }: { params: { id: string; type: string } }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agent = AGENTS[params.type];
  if (!agent) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });

  const rl = rateLimit(`agent:${params.type}:${orgId}`, 12, 60 * 1000);
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

  const inFlight = await prisma.agentJob.findFirst({
    where: { campaignId: campaign.id, agentType: params.type, status: { in: ["queued", "running"] } },
  });
  if (inFlight) return NextResponse.json({ jobId: inFlight.id, status: inFlight.status }, { status: 202 });

  const job = await prisma.agentJob.create({
    data: { campaignId: campaign.id, organizationId: orgId, agentType: params.type, status: "running" },
  });

  const ctx = {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      industry: campaign.industry,
      geography: campaign.geography,
      companySize: campaign.companySize,
      keywords: campaign.keywords,
      context: campaign.context,
    },
    organizationId: orgId,
    userId,
  };

  waitUntil(
    (async () => {
      try {
        const { summary } = await agent.run(ctx);
        await prisma.agentJob.update({
          where: { id: job.id },
          data: { status: "succeeded", summary, completedAt: new Date() },
        });
      } catch (err) {
        console.error(`[agent:${params.type}] failed:`, err);
        await prisma.agentJob
          .update({
            where: { id: job.id },
            data: {
              status: "failed",
              error: err instanceof Error ? err.message : "Agent run failed",
              completedAt: new Date(),
            },
          })
          .catch(() => {});
      }
    })()
  );

  return NextResponse.json({ jobId: job.id, status: "running" }, { status: 202 });
}

export async function GET(req: Request, { params }: { params: { id: string; type: string } }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await prisma.agentJob.findFirst({
    where: { campaignId: params.id, organizationId: orgId, agentType: params.type },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return NextResponse.json({ status: "none" });
  return NextResponse.json({ jobId: job.id, status: job.status, summary: job.summary, error: job.error });
}
