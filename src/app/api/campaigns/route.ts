import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Session } from "next-auth";

function getOrgId(session: Session | null) {
  return (session?.user as { organizationId?: string } | undefined)?.organizationId;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const oid = getOrgId(session);
  if (!oid) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: oid, ...(status ? { status } : {}) },
    include: { leads: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  const data = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    industry: c.industry,
    geography: c.geography,
    leads: c.leads.length,
    replied: c.leads.filter((l) => l.status === "replied").length,
    meetings: c.leads.filter((l) => l.status === "meeting_booked").length,
    created: c.createdAt.toISOString().split("T")[0],
  }));

  return NextResponse.json({ campaigns: data, total: data.length });
}

const createSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  description: z.string().optional(),
  context: z.string().max(20000).optional(),
  industry: z.string().optional(),
  geography: z.string().optional(),
  companySize: z.string().optional(),
  targetTitles: z.string().optional(),
  keywords: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const oid = getOrgId(session);
  if (!oid) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { targetTitles, keywords, ...rest } = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      ...rest,
      targetTitles: targetTitles ? targetTitles.split(",").map((s) => s.trim()).filter(Boolean) : [],
      keywords: keywords ? keywords.split(",").map((s) => s.trim()).filter(Boolean) : [],
      organizationId: oid,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}
