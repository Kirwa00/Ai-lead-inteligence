import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { debitForUsage } from "@/lib/wallet";
import { AGENT_MODEL, callClaudeJson, TX_OPTS } from "@/lib/agents/shared";
import type { AgentContext, AgentResult } from "@/lib/agents";

const SCHEMA = {
  type: "object",
  properties: {
    contacts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          title: { type: "string" },
          email: { type: "string" },
        },
        required: ["company", "firstName", "lastName", "title", "email"],
        additionalProperties: false,
      },
    },
  },
  required: ["contacts"],
  additionalProperties: false,
} as const;

type Found = { company: string; firstName: string; lastName: string; title: string; email: string };

export async function runContactDiscovery(ctx: AgentContext): Promise<AgentResult> {
  const leads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id, contactId: null },
    include: { company: true },
  });
  if (leads.length === 0) return { summary: "Every lead already has a contact." };

  const list = leads
    .map((l, i) => `${i + 1}. ${l.company?.name ?? "Unknown"}${l.company?.domain ? ` (${l.company.domain})` : ""} — ${l.company?.industry ?? ""}`)
    .join("\n");

  const prompt = `You are a B2B contact discovery agent. For each company, identify the most likely senior decision-maker to approach for what we offer, and construct a plausible professional email from their name and the company domain.

What we offer / context:
${ctx.campaign.context?.slice(0, 3000) || ctx.campaign.industry || "B2B solution"}

Return company (exact name), firstName, lastName, a relevant senior title, and a best-guess professional email. Mark nothing as verified.

Companies:
${list}`;

  const { result, usage } = await callClaudeJson<{ contacts: Found[] }>(prompt, SCHEMA);
  const byName = new Map(result.contacts.map((c) => [c.company.trim().toLowerCase(), c]));

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let found = 0;
  for (const l of leads) {
    const c = byName.get((l.company?.name ?? "").trim().toLowerCase());
    if (!c || !l.companyId) continue;
    const contactId = randomUUID();
    writes.push(
      prisma.contact.create({
        data: {
          id: contactId,
          firstName: c.firstName,
          lastName: c.lastName,
          title: c.title,
          email: c.email,
          emailStatus: "unverified",
          companyId: l.companyId,
        },
      })
    );
    writes.push(prisma.lead.update({ where: { id: l.id }, data: { contactId } }));
    found += 1;
  }
  if (writes.length > 0) await prisma.$transaction(writes, TX_OPTS);

  try {
    await debitForUsage({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      feature: "contact_discovery",
      agentType: "contact_discovery",
      model: AGENT_MODEL,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  } catch (err) {
    console.error("[contact-discovery] metering failed:", err);
  }

  return { summary: `Found contacts for ${found} compan${found === 1 ? "y" : "ies"} (unverified).` };
}
