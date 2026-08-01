import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/password";
import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

export async function POST(req: NextRequest) {
  const rl = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!rl.ok) return tooMany(rl.retryAfterSec, "Too many attempts. Try again shortly.");

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const claim = await consumeToken(parsed.data.token, "password_reset");
  if (!claim) {
    return NextResponse.json(
      { error: "This reset link is invalid, expired, or already used." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: claim.userId },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      // Completing a reset proves control of the inbox, so the address is
      // verified by definition.
      emailVerified: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
