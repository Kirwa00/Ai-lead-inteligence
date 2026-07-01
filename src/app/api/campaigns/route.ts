import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { demoCampaigns } from "@/lib/demo-data";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const data = status ? demoCampaigns.filter((c) => c.status === status) : demoCampaigns;

  return NextResponse.json({ campaigns: data, total: data.length });
}

const createSchema = z.object({
  name: z.string().min(1),
  goal: z.string().optional(),
  description: z.string().optional(),
  industry: z.string().optional(),
  geography: z.string().optional(),
  companySize: z.string().optional(),
  targetTitles: z.string().optional(),
  keywords: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // TODO: replace with Prisma create once DATABASE_URL is configured
  const newCampaign = {
    id: String(Date.now()),
    ...parsed.data,
    status: "draft",
    leads: 0,
    replied: 0,
    meetings: 0,
    created: new Date().toISOString().split("T")[0],
  };

  return NextResponse.json({ campaign: newCampaign }, { status: 201 });
}
