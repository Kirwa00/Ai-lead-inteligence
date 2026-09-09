import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { debitForLookups, debitForUsage } from "@/lib/wallet";
import { callAgentJson, TX_OPTS } from "@/lib/agents/shared";
import { discoveryProviderConfigured, findDecisionMaker, type DiscoveredContact } from "@/lib/data-providers";
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

type LeadWithCompany = Prisma.LeadGetPayload<{ include: { company: true } }>;

const PROVIDER_CONCURRENCY = 4;

/**
 * Look up real contacts for every lead that has a company domain. Returns the
 * hits plus the leads still needing the LLM (no domain, no match, or the
 * provider failed for that lead — a provider outage must not stop the run).
 */
async function discoverViaProviders(
  leads: LeadWithCompany[],
  titleHints: string[]
): Promise<{ hits: Map<string, DiscoveredContact>; remaining: LeadWithCompany[]; errors: number }> {
  const hits = new Map<string, DiscoveredContact>();
  const remaining: LeadWithCompany[] = [];
  let errors = 0;

  const queue = leads.filter((l) => {
    if (l.company?.domain) return true;
    remaining.push(l);
    return false;
  });

  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const lead = queue[cursor++];
      try {
        const hit = await findDecisionMaker(lead.company!.domain!, titleHints);
        if (hit) hits.set(lead.id, hit);
        else remaining.push(lead);
      } catch (err) {
        errors += 1;
        console.error(`[contact-discovery] provider lookup failed for ${lead.company?.domain}:`, err);
        remaining.push(lead);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROVIDER_CONCURRENCY, queue.length) }, worker));
  return { hits, remaining, errors };
}

export async function runContactDiscovery(ctx: AgentContext): Promise<AgentResult> {
  const allLeads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id, contactId: null },
    include: { company: true },
  });
  if (allLeads.length === 0) return { summary: "Every lead already has a contact." };

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let found = 0;
  let fromProviders = 0;
  let verifiedEmails = 0;
  let providerErrors = 0;
  let leads = allLeads;

  if (discoveryProviderConfigured()) {
    const { hits, remaining, errors } = await discoverViaProviders(allLeads, ctx.campaign.keywords ?? []);
    providerErrors = errors;
    leads = remaining;
    const bySource: Record<string, number> = {};
    for (const l of allLeads) {
      const c = hits.get(l.id);
      if (!c || !l.companyId) continue;
      const contactId = randomUUID();
      writes.push(
        prisma.contact.create({
          data: {
            id: contactId,
            firstName: c.firstName,
            lastName: c.lastName,
            title: c.title || null,
            email: c.email,
            emailStatus: c.emailStatus,
            phone: c.phone,
            linkedinUrl: c.linkedinUrl,
            companyId: l.companyId,
          },
        })
      );
      writes.push(prisma.lead.update({ where: { id: l.id }, data: { contactId } }));
      found += 1;
      fromProviders += 1;
      if (c.emailStatus === "valid") verifiedEmails += 1;
      const lookup = c.source === "apollo" ? "apollo/people-search" : "hunter/domain-search";
      bySource[lookup] = (bySource[lookup] ?? 0) + 1;
    }
    if (writes.length > 0) await prisma.$transaction(writes, TX_OPTS);
    writes.length = 0;

    for (const [lookup, count] of Object.entries(bySource)) {
      try {
        await debitForLookups({
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          feature: "contact_discovery",
          agentType: "contact_discovery",
          lookup,
          count,
        });
      } catch (err) {
        console.error("[contact-discovery] lookup metering failed:", err);
      }
    }
  }

  if (leads.length === 0) {
    return { summary: summarize(found, fromProviders, verifiedEmails, providerErrors) };
  }

  const list = leads
    .map((l, i) => `${i + 1}. ${l.company?.name ?? "Unknown"}${l.company?.domain ? ` (${l.company.domain})` : ""} — ${l.company?.industry ?? ""}`)
    .join("\n");

  const prompt = `You are a B2B contact discovery agent. For each company, identify the most likely senior decision-maker to approach for what we offer, and construct a plausible professional email from their name and the company domain.

What we offer / context:
${ctx.campaign.context?.slice(0, 3000) || ctx.campaign.industry || "B2B solution"}

Return company (exact name), firstName, lastName, a relevant senior title, and a best-guess professional email. Mark nothing as verified.

Companies:
${list}`;

  const { result, usage, model } = await callAgentJson<{ contacts: Found[] }>(
    prompt,
    SCHEMA,
    3000,
    ctx.llmProvider
  );
  const byName = new Map(result.contacts.map((c) => [c.company.trim().toLowerCase(), c]));

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
      model,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });
  } catch (err) {
    console.error("[contact-discovery] metering failed:", err);
  }

  return { summary: summarize(found, fromProviders, verifiedEmails, providerErrors) };
}

function summarize(found: number, fromProviders: number, verifiedEmails: number, providerErrors: number): string {
  const companies = `${found} compan${found === 1 ? "y" : "ies"}`;
  if (fromProviders === 0) {
    return providerErrors > 0
      ? `Found contacts for ${companies} via AI (unverified) — the data provider was unavailable.`
      : `Found contacts for ${companies} (unverified).`;
  }
  const guessed = found - fromProviders;
  const parts = [`${fromProviders} from verified data sources (${verifiedEmails} with verified emails)`];
  if (guessed > 0) parts.push(`${guessed} AI-suggested (unverified)`);
  if (providerErrors > 0) parts.push(`${providerErrors} lookup${providerErrors === 1 ? "" : "s"} failed`);
  return `Found contacts for ${companies}: ${parts.join(", ")}.`;
}
