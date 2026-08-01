import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateInviteToken, INVITE_TTL_MS } from "@/lib/invites";
import { sendEmail, resendConfigured } from "@/lib/email-sender";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/team";

export async function GET() {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const invites = await prisma.invite.findMany({
    where: { organizationId: ctx.orgId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invites });
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["member", "owner"]).default("member"),
});

export async function POST(req: NextRequest) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const rl = rateLimit(`invite:${ctx.orgId}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many invites sent. Try again later.");

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const { email, role } = parsed.data;

  const [existingUser, org] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true, organizationId: true } }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
  ]);
  if (existingUser?.organizationId === ctx.orgId) {
    return NextResponse.json({ error: "This person is already a member of your workspace." }, { status: 409 });
  }

  await prisma.invite.updateMany({
    where: { organizationId: ctx.orgId, email, status: "pending" },
    data: { status: "revoked" },
  });

  const token = generateInviteToken();
  const invite = await prisma.invite.create({
    data: {
      organizationId: ctx.orgId,
      email,
      role,
      token,
      invitedByUserId: ctx.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = `${req.nextUrl.origin}/register?invite=${token}`;

  let emailSent = false;
  if (resendConfigured()) {
    try {
      await sendEmail({
        to: email,
        subject: `You're invited to join ${org?.name ?? "a workspace"} on A1 Intelligence`,
        text: `You've been invited to join ${org?.name ?? "a workspace"} on A1 Intelligence.\n\nAccept your invite: ${inviteUrl}\n\nThis link expires in 7 days.`,
      });
      emailSent = true;
    } catch (err) {
      console.error("[invite] failed to send email:", err);
    }
  }

  return NextResponse.json({ invite, inviteUrl, emailSent }, { status: 201 });
}
