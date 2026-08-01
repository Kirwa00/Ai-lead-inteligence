import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type OwnerContext = { orgId: string; userId: string };

/**
 * Guard for owner-only team operations. Returns either the caller's context or
 * a ready-to-return error response, so routes can do:
 *   const ctx = await requireOwner(); if ("error" in ctx) return ctx.error;
 *
 * The role is read from the DATABASE, never from the JWT. We use stateless JWT
 * sessions, so a role claim minted at sign-in stays valid for the token's whole
 * lifetime — meaning a demoted owner would otherwise keep full owner powers
 * (including deleting the workspace) until their token happened to expire.
 */
export async function requireOwner(): Promise<OwnerContext | { error: NextResponse }> {
  const session = await auth();
  const sessionUser = session?.user as { id?: string } | undefined;

  const unauthorized = {
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
  if (!sessionUser?.id) return unauthorized;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, organizationId: true },
  });
  if (!user) return unauthorized;

  if (user.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Only the workspace owner can manage the team." },
        { status: 403 }
      ),
    };
  }

  return { orgId: user.organizationId, userId: user.id };
}
