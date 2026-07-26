import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["uncontacted", "qualified", "contacted", "replied", "meeting_booked", "disqualified", "bounced"] as const;

const patchSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

// Manual status override — lets a user record a reply or booked meeting that
// happened outside the system (a call, a LinkedIn reply, etc.) so KPIs and
// reports stay accurate even without full inbox-monitoring automation.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, campaign: { organizationId: orgId } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { status: parsed.data.status },
  });

  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "status_change", note: `Manually marked as ${parsed.data.status}` },
  });

  return NextResponse.json({ lead: updated });
}
