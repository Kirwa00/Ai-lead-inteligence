import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/team";

export const runtime = "nodejs";

// Typing the workspace name is the confirmation step — it makes an accidental
// or CSRF-style delete effectively impossible, since the attacker would need
// to know the exact name.
const schema = z.object({ confirmName: z.string() });

/**
 * Permanently delete the workspace: every campaign, lead, email, invite, wallet
 * ledger row and member account goes with it via the schema's onDelete: Cascade.
 * There is no undo, and any remaining credit balance is forfeited.
 */
export async function DELETE(req: Request) {
  const ctx = await requireOwner();
  if ("error" in ctx) return ctx.error;

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { name: true },
  });
  if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (parsed.data.confirmName.trim() !== org.name) {
    return NextResponse.json(
      { error: "The name you typed doesn't match the workspace name." },
      { status: 400 }
    );
  }

  await prisma.organization.delete({ where: { id: ctx.orgId } });

  return NextResponse.json({ ok: true });
}
