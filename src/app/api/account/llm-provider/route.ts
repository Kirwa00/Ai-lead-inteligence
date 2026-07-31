import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { llmConfigured, llmProvidersAvailable, resolveLlmProvider } from "@/lib/agents/shared";

export const runtime = "nodejs";

const patchSchema = z.object({
  provider: z.enum(["anthropic", "deepseek"]),
});

/** GET — current workspace LLM provider + which providers have keys configured. */
export async function GET() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { llmProvider: true },
  });
  const provider = resolveLlmProvider(org?.llmProvider);
  const available = llmProvidersAvailable();

  return NextResponse.json({
    provider,
    available,
    configured: llmConfigured(provider),
  });
}

/** PATCH — switch workspace LLM provider (owner only). */
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string; role?: string; organizationId?: string } | undefined)?.id;
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!userId || !orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "owner") {
    return NextResponse.json({ error: "Only workspace owners can change the AI provider." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  const { provider } = parsed.data;
  const available = llmProvidersAvailable();
  if (!available[provider]) {
    return NextResponse.json(
      { error: `${provider === "deepseek" ? "DeepSeek" : "Claude"} is not configured on the server.` },
      { status: 400 }
    );
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { llmProvider: provider },
  });

  return NextResponse.json({ ok: true, provider, configured: true });
}
