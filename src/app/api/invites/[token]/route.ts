import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public lookup (no auth) so the register page can show "you've been invited
// to join X" before the person has an account. Only exposes non-sensitive fields.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: { organization: { select: { name: true } } },
  });

  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false }, { status: 200 });
  }

  return NextResponse.json({
    valid: true,
    email: invite.email,
    organizationName: invite.organization.name,
  });
}
