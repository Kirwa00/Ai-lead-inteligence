import { runCampaignResearch } from "@/lib/research";
import { runQualification } from "@/lib/agents/qualification";
import { runContactDiscovery } from "@/lib/agents/contact-discovery";
import { runEmailVerification } from "@/lib/agents/email-verification";
import { runOutreach } from "@/lib/agents/outreach";
import { runFollowup } from "@/lib/agents/followup";
import { runReporting } from "@/lib/agents/reporting";

export type AgentCampaign = {
  id: string;
  name: string;
  industry: string | null;
  geography: string | null;
  companySize: string | null;
  keywords: string[];
  context: string | null;
};

export type AgentContext = {
  campaign: AgentCampaign;
  organizationId: string;
  userId?: string | null;
};

export type AgentResult = { summary: string };
export type AgentRunner = (ctx: AgentContext) => Promise<AgentResult>;

// The AI workforce. Add an entry here to expose a new campaign-scoped agent.
export const AGENTS: Record<string, { label: string; description: string; run: AgentRunner }> = {
  research: {
    label: "Research Agent",
    description: "Find companies matching this campaign and add them as leads.",
    run: async (ctx) => ({
      summary: `Added ${await runCampaignResearch(ctx.campaign, ctx.organizationId, ctx.userId)} leads.`,
    }),
  },
  qualification: {
    label: "Qualification Agent",
    description: "Score and qualify this campaign's leads against your ICP & context.",
    run: runQualification,
  },
  contact_discovery: {
    label: "Contact Discovery Agent",
    description: "Find a likely decision-maker for each lead company.",
    run: runContactDiscovery,
  },
  email_verification: {
    label: "Email Verification Agent",
    description: "Validate contact emails (no AI credits used).",
    run: runEmailVerification,
  },
  outreach: {
    label: "Outreach Agent",
    description: "Draft personalised first-touch emails for your leads.",
    run: runOutreach,
  },
  followup: {
    label: "Follow-up Agent",
    description: "Draft follow-ups for contacted leads that haven't replied.",
    run: runFollowup,
  },
  reporting: {
    label: "Reporting Agent",
    description: "Summarise this campaign's performance with recommendations.",
    run: runReporting,
  },
};

export type AgentType = keyof typeof AGENTS;
