import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const user = session?.user as { organizationId?: string; role?: string } | undefined;
  if (!user?.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json({ error: "Only the workspace owner can manage the team." }, { status: 403 });
  }

  const invite = await prisma.invite.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
  });
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  await prisma.invite.update({ where: { id: invite.id }, data: { status: "revoked" } });
  return NextResponse.json({ ok: true });
}
