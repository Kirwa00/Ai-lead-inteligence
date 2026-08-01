import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/auth-emails";
import { rateLimit, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`resend-verify:${userId}`, 3, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Please wait before requesting another email.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const raw = await issueToken(userId, "email_verify");
  const url = `${req.nextUrl.origin}/api/auth/verify-email?token=${raw}`;
  const emailSent = await sendVerificationEmail(user.email, url);

  if (!emailSent && process.env.NODE_ENV !== "production") {
    return NextResponse.json({ ok: true, emailSent, devVerifyUrl: url });
  }
  return NextResponse.json({ ok: true, emailSent });
}
