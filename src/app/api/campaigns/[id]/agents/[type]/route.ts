import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { getBalanceMicros } from "@/lib/wallet";
import { RESEARCH_RUN_RESERVE_MICROS } from "@/lib/billing";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { AGENTS } from "@/lib/agents";
import { IN_FLIGHT_STATUSES, isStale, staleCutoff } from "@/lib/agents/job-staleness";
import { llmConfigured } from "@/lib/agents/shared";
import { getOrgLlmProvider } from "@/lib/llm-provider";

export const runtime = "nodejs";

/**
 * Vercel defaults serverless functions to 10s (Hobby) / 15s (Pro), and that
 * ceiling applies to waitUntil work too — it extends past the response, but not
 * past the function's lifetime. A research run takes ~20s, so on the default
 * the platform killed the function mid-run: no exception, no catch block, the
 * job row stuck at "running" forever and the UI polled a spinner that never
 * resolved. Worked locally only because there is no timeout there.
 *
 * 60s is the Hobby ceiling and well inside Pro's, so it's safe on either.
 */
export const maxDuration = 60;

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

  const llmProvider = await getOrgLlmProvider(orgId);

  if (agent.usesLlm !== false && !llmConfigured(llmProvider)) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  }

  if (agent.usesLlm !== false) {
    const balance = await getBalanceMicros(orgId);
    if (balance < RESEARCH_RUN_RESERVE_MICROS) {
      return NextResponse.json(
        { error: "Not enough credits. Please top up.", mode: "no_credits" },
        { status: 402 }
      );
    }
  }

  // Dedupe concurrent runs — but only against jobs that could still be alive.
  // Without the age bound, one killed function would leave a "running" row that
  // this check kept returning forever, permanently blocking the agent.
  const cutoff = staleCutoff();
  const inFlight = await prisma.agentJob.findFirst({
    where: {
      campaignId: campaign.id,
      agentType: params.type,
      status: { in: [...IN_FLIGHT_STATUSES] },
      createdAt: { gt: cutoff },
    },
  });
  if (inFlight) return NextResponse.json({ jobId: inFlight.id, status: inFlight.status }, { status: 202 });

  // Any older in-flight rows belong to functions that no longer exist.
  await prisma.agentJob.updateMany({
    where: {
      campaignId: campaign.id,
      agentType: params.type,
      status: { in: [...IN_FLIGHT_STATUSES] },
      createdAt: { lte: cutoff },
    },
    data: { status: "failed", error: "The run timed out and was stopped.", completedAt: new Date() },
  });

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
    llmProvider,
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

  // If the platform killed the function mid-run, nothing ever wrote a terminal
  // status — the row would sit at "running" forever and the client would poll
  // indefinitely. Reap it here so the failure is visible and retryable.
  const inFlight = (IN_FLIGHT_STATUSES as readonly string[]).includes(job.status);
  if (inFlight && isStale(job.createdAt)) {
    const reaped = await prisma.agentJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: "The run timed out and was stopped. Try again — if it keeps happening, the campaign may be too broad.",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ jobId: reaped.id, status: reaped.status, error: reaped.error });
  }

  return NextResponse.json({ jobId: job.id, status: job.status, summary: job.summary, error: job.error });
}
