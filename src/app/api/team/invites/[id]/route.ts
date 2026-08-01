import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/team";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const invite = await prisma.invite.findFirst({
    where: { id: params.id, organizationId: ctx.orgId },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await prisma.invite.update({ where: { id: invite.id }, data: { status: "revoked" } });
  return NextResponse.json({ ok: true });
}
