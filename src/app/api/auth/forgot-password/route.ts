import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/auth-emails";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

// Deliberately uniform response regardless of whether the account exists —
// otherwise this endpoint becomes an account-enumeration oracle.
const GENERIC = { ok: true, message: "If that email has an account, a reset link is on its way." };

export async function POST(req: NextRequest) {
  const rl = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many reset requests. Try again shortly.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  // Even a malformed email gets the generic response — no signal either way.
  if (!parsed.success) return NextResponse.json(GENERIC);

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // No account, or an OAuth-only account with no password to reset. Both fall
  // through to the same response the happy path returns.
  if (!user || !user.passwordHash) return NextResponse.json(GENERIC);

  const raw = await issueToken(user.id, "password_reset");
  const url = `${req.nextUrl.origin}/reset-password?token=${raw}`;
  const emailSent = await sendPasswordResetEmail(email, url);

  // Without a mail provider configured the link would be unreachable, so
  // surface it directly. Guarded to non-production so it can never leak live.
  if (!emailSent && process.env.NODE_ENV !== "production") {
    return NextResponse.json({ ...GENERIC, devResetUrl: url });
  }

  return NextResponse.json(GENERIC);
}
