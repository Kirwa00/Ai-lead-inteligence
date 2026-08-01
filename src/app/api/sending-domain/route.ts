import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/team";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { normalizeDomain, registerDomain, removeDomain } from "@/lib/sending-domain";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const domain = await prisma.sendingDomain.findUnique({
    where: { organizationId: ctx.orgId },
  });
  return NextResponse.json({ domain });
}

const createSchema = z.object({
  domain: z.string().trim().min(3).max(253),
  fromLocalPart: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]+$/i, "Use letters, numbers, dots, dashes or underscores.")
    .max(64)
    .optional(),
  fromName: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  // Each call registers a domain upstream, so keep it modest.
  const rl = rateLimit(`sending-domain:${ctx.orgId}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many attempts. Try again later.");

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const domain = normalizeDomain(parsed.data.domain);
  if (!domain) {
    return NextResponse.json(
      { error: "Enter a bare domain like acme.com — not a URL or an email address." },
      { status: 400 }
    );
  }

  try {
    const record = await registerDomain(ctx.orgId, domain);

    // Optional identity tweaks are applied after registration so a bad
    // local-part can't block the domain itself from being created.
    const { fromLocalPart, fromName } = parsed.data;
    const updated =
      fromLocalPart || fromName
        ? await prisma.sendingDomain.update({
            where: { organizationId: ctx.orgId },
            data: {
              ...(fromLocalPart ? { fromLocalPart: fromLocalPart.toLowerCase() } : {}),
              ...(fromName ? { fromName } : {}),
            },
          })
        : record;

    return NextResponse.json({ domain: updated }, { status: 201 });
  } catch (err) {
    console.error("[sending-domain] register failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not register that domain." },
      { status: 502 }
    );
  }
}

const patchSchema = z.object({
  fromLocalPart: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]+$/i, "Use letters, numbers, dots, dashes or underscores.")
    .max(64)
    .optional(),
  fromName: z.string().trim().max(80).nullable().optional(),
});

/** Change the from-address identity without re-registering the domain. */
export async function PATCH(req: Request) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const existing = await prisma.sendingDomain.findUnique({
    where: { organizationId: ctx.orgId },
  });
  if (!existing) return NextResponse.json({ error: "No sending domain set up." }, { status: 404 });

  const { fromLocalPart, fromName } = parsed.data;
  const domain = await prisma.sendingDomain.update({
    where: { organizationId: ctx.orgId },
    data: {
      ...(fromLocalPart ? { fromLocalPart: fromLocalPart.toLowerCase() } : {}),
      ...(fromName !== undefined ? { fromName: fromName || null } : {}),
    },
  });

  return NextResponse.json({ domain });
}

export async function DELETE() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  try {
    await removeDomain(ctx.orgId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sending-domain] delete failed:", err);
    return NextResponse.json({ error: "Could not remove the domain." }, { status: 502 });
  }
}
