import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/auth-emails";
import { provisionSoloWorkspace } from "@/lib/provisioning";

export const runtime = "nodejs";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Your name is required.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  workspace: z.string().trim().max(120).optional(),
  inviteToken: z.string().trim().min(1).optional(),
});

export async function POST(req: NextRequest) {
  // Throttle signups per IP — each account grants real token budget, so this
  // blocks scripted free-grant farming that would drain Anthropic credits.
  const rl = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000); // 5 / hour / IP
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many sign-ups from this network. Try again later.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { name, email, password, workspace, inviteToken } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  // Joining via an invite attaches to the existing workspace instead of
  // provisioning a new one — and skips the free grant (the org already has one).
  const invite = inviteToken
    ? await prisma.invite.findUnique({ where: { token: inviteToken } })
    : null;
  if (inviteToken) {
    if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 });
    }
    if (invite.email !== email) {
      return NextResponse.json(
        { error: "This invite was sent to a different email address." },
        { status: 400 }
      );
    }
  }

  const passwordHash = await hashPassword(password);
  let newUserId: string | null = null;

  try {
    if (invite) {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: invite.role,
            organizationId: invite.organizationId,
          },
        });
        newUserId = user.id;
        await tx.invite.update({ where: { id: invite.id }, data: { status: "accepted" } });
      });
    } else {
      // A solo signup provisions its own Organization (workspace) with the
      // registrant as owner. Billing later attaches at the Organization level.
      const created = await provisionSoloWorkspace({
        email,
        name,
        passwordHash,
        workspaceName: workspace,
      });
      newUserId = created.userId;
    }
  } catch (err) {
    // Unique-constraint race (email or slug) or any other write failure.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    console.error("[register] failed to create account:", err);
    return NextResponse.json(
      { error: "Could not create your account. Please try again." },
      { status: 500 }
    );
  }

  // Verification is non-blocking: the account works immediately and the app
  // shows a dismissible reminder banner until confirmed. A mail outage must
  // never leave someone unable to use an account they just paid to create.
  let devVerifyUrl: string | undefined;
  if (newUserId) {
    try {
      const raw = await issueToken(newUserId, "email_verify");
      const url = `${req.nextUrl.origin}/api/auth/verify-email?token=${raw}`;
      const sent = await sendVerificationEmail(email, url);
      if (!sent && process.env.NODE_ENV !== "production") devVerifyUrl = url;
    } catch (err) {
      console.error("[register] could not issue verification email:", err);
    }
  }

  return NextResponse.json({ ok: true, devVerifyUrl }, { status: 201 });
}
