import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { demoAgents } from "@/lib/demo-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = {
    active: demoAgents.filter((a) => a.status === "active").length,
    total: demoAgents.length,
    tasksToday: demoAgents.reduce((s, a) => s + a.tasksToday, 0),
  };

  return NextResponse.json({ agents: demoAgents, summary });
}
