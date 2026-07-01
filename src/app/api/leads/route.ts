import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { demoLeads } from "@/lib/demo-data";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.toLowerCase();

  let data = demoLeads;
  if (campaignId) data = data.filter((l) => l.campaignId === campaignId);
  if (status) data = data.filter((l) => l.status === status);
  if (q) data = data.filter((l) =>
    l.company.toLowerCase().includes(q) ||
    l.contact.toLowerCase().includes(q) ||
    l.email.toLowerCase().includes(q)
  );

  // Summary counts
  const summary = {
    total: demoLeads.length,
    qualified: demoLeads.filter((l) => l.status === "qualified").length,
    contacted: demoLeads.filter((l) => l.status === "contacted").length,
    replied: demoLeads.filter((l) => l.status === "replied").length,
  };

  return NextResponse.json({ leads: data, summary, total: data.length });
}
