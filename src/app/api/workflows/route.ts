import { auth } from "@/auth";
import { NextResponse } from "next/server";

const workflowSteps = [
  { id: 1, label: "Receive Campaign", icon: "inbox", status: "done", agent: "System" },
  { id: 2, label: "Understand ICP", icon: "manage_search", status: "done", agent: "System" },
  { id: 3, label: "Research Companies", icon: "travel_explore", status: "active", agent: "Research Agent" },
  { id: 4, label: "Extract Contacts", icon: "contacts", status: "pending", agent: "Contact Discovery Agent" },
  { id: 5, label: "Verify Emails", icon: "mark_email_read", status: "pending", agent: "Email Verification Agent" },
  { id: 6, label: "Score Leads", icon: "verified", status: "pending", agent: "Qualification Agent" },
  { id: 7, label: "Store in Database", icon: "storage", status: "pending", agent: "System" },
  { id: 8, label: "Generate Outreach", icon: "send", status: "pending", agent: "Outreach Agent" },
  { id: 9, label: "Human Approval", icon: "how_to_reg", status: "pending", agent: "Human" },
  { id: 10, label: "Launch Campaign", icon: "rocket_launch", status: "pending", agent: "System" },
  { id: 11, label: "Monitor Replies", icon: "forum", status: "pending", agent: "Follow-up Agent" },
  { id: 12, label: "Generate Reports", icon: "assessment", status: "pending", agent: "Reporting Agent" },
];

const activeRun = {
  campaignName: "Kenya FinTech Outreach Q3",
  currentStep: 3,
  totalSteps: 12,
  startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  status: "running",
};

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ steps: workflowSteps, activeRun });
}
