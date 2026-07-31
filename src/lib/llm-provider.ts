import { prisma } from "@/lib/prisma";
import { resolveLlmProvider, type LlmProvider } from "@/lib/agents/shared";

/** Load the LLM provider preference for a workspace. */
export async function getOrgLlmProvider(organizationId: string): Promise<LlmProvider> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { llmProvider: true },
  });
  return resolveLlmProvider(org?.llmProvider);
}
