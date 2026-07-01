import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.toLowerCase();

  const leads = await prisma.lead.findMany({
    where: {
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      company: { select: { name: true, industry: true } },
      contact: { select: { firstName: true, lastName: true, title: true, email: true } },
    },
    orderBy: { score: "desc" },
  });

  const data = leads
    .map((l) => ({
      id: l.id,
      company: l.company.name,
      contact: `${l.contact?.firstName ?? ""} ${l.contact?.lastName ?? ""}`.trim(),
      title: l.contact?.title ?? "",
      email: l.contact?.email ?? "",
      score: l.score,
      status: l.status,
      industry: l.company.industry ?? "",
      campaignId: l.campaignId,
    }))
    .filter((l) =>
      q
        ? l.company.toLowerCase().includes(q) ||
          l.contact.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q)
        : true
    );

  const allLeads = await prisma.lead.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  const counts = Object.fromEntries(allLeads.map((r) => [r.status, r._count.status]));
  const summary = {
    total: allLeads.reduce((s, r) => s + r._count.status, 0),
    qualified: counts["qualified"] ?? 0,
    contacted: counts["contacted"] ?? 0,
    replied: counts["replied"] ?? 0,
  };

  return NextResponse.json({ leads: data, summary, total: data.length });
}
