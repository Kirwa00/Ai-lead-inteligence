import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Session } from "next-auth";

export const runtime = "nodejs";

function getOrgId(session: Session | null) {
  return (session?.user as { organizationId?: string } | undefined)?.organizationId;
}

const patchSchema = z.object({
  status: z.enum(["active", "paused", "draft", "validating", "completed"]),
});

// Update a campaign's status (start = "active", pause = "paused").
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const oid = getOrgId(session);
  if (!oid) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Scope the update to the caller's org so one tenant can't touch another's.
  const result = await prisma.campaign.updateMany({
    where: { id: params.id, organizationId: oid },
    data: { status: parsed.data.status },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ id: params.id, status: parsed.data.status });
}
