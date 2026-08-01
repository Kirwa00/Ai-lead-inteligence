import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeToken } from "@/lib/tokens";

export const runtime = "nodejs";

// Landed on directly from an email link, so this redirects to a page rather
// than returning JSON — the browser is the client here, not fetch().
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const done = (status: string) =>
    NextResponse.redirect(new URL(`/verify-email?status=${status}`, req.nextUrl.origin));

  if (!token) return done("invalid");

  const claim = await consumeToken(token, "email_verify");
  if (!claim) return done("invalid");

  await prisma.user.update({
    where: { id: claim.userId },
    data: { emailVerified: new Date() },
  });

  return done("success");
}
