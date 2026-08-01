import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/team";

export const runtime = "nodejs";

const schema = z.object({ userId: z.string().min(1) });

/**
 * Hand the workspace to another member. The caller is demoted to member in the
 * same transaction, so the workspace is never left with zero or two owners
 * mid-flight. The caller's next request picks up the new role because the JWT
 * callback re-reads role from the database when it refreshes.
 */
export async function POST(req: Request) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Pick a member." }, { status: 400 });

  if (parsed.data.userId === ctx.userId) {
    return NextResponse.json({ error: "You already own this workspace." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id: parsed.data.userId, organizationId: ctx.orgId },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.user.update({ where: { id: target.id }, data: { role: "owner" } }),
    prisma.user.update({ where: { id: ctx.userId }, data: { role: "member" } }),
  ]);

  return NextResponse.json({ ok: true });
}
