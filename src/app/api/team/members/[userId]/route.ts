import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/team";

export const runtime = "nodejs";

/**
 * Remove a teammate from the workspace. Deleting the User row is the right
 * semantic here: campaigns/leads belong to the Organization, not the User, so
 * none of the workspace's actual work is lost.
 */
export async function DELETE(_req: Request, { params }: { params: { userId: string } }) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  if (params.userId === ctx.userId) {
    return NextResponse.json(
      { error: "You can't remove yourself. Transfer ownership first, or delete the workspace." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id: params.userId, organizationId: ctx.orgId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Guard against removing the last owner and orphaning the workspace.
  if (target.role === "owner") {
    const owners = await prisma.user.count({
      where: { organizationId: ctx.orgId, role: "owner" },
    });
    if (owners <= 1) {
      return NextResponse.json(
        { error: "A workspace must keep at least one owner." },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction([
    // Drop any outstanding invite so a removed person can't rejoin with an old link.
    prisma.invite.updateMany({
      where: { organizationId: ctx.orgId, email: target.email, status: "pending" },
      data: { status: "revoked" },
    }),
    prisma.user.delete({ where: { id: target.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
