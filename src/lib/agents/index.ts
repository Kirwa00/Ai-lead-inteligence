import { runCampaignResearch } from "@/lib/research";
import { runQualification } from "@/lib/agents/qualification";

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
};

export type AgentType = keyof typeof AGENTS;
