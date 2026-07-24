import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TX_OPTS } from "@/lib/agents/shared";
import type { AgentContext, AgentResult } from "@/lib/agents";

// Syntactic + heuristic email validation. No LLM call, so no wallet charge —
// deliverability checks (MX/SMTP) would plug in here behind a provider later.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLE_PREFIXES = ["info", "admin", "sales", "support", "contact", "hello", "team", "office"];

function classify(email: string | null): "valid" | "risky" | "invalid" {
  if (!email || !EMAIL_RE.test(email)) return "invalid";
  const local = email.split("@")[0].toLowerCase();
  if (ROLE_PREFIXES.includes(local)) return "risky"; // role inbox, not a person
  return "valid";
}

export async function runEmailVerification(ctx: AgentContext): Promise<AgentResult> {
  const leads = await prisma.lead.findMany({
    where: { campaignId: ctx.campaign.id, contactId: { not: null } },
    include: { contact: true },
  });
  const contacts = leads.map((l) => l.contact).filter((c): c is NonNullable<typeof c> => !!c);
  if (contacts.length === 0) return { summary: "No contacts to verify — run Contact Discovery first." };

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  let valid = 0;
  for (const c of contacts) {
    const status = classify(c.email);
    if (status === "valid") valid += 1;
    writes.push(prisma.contact.update({ where: { id: c.id }, data: { emailStatus: status } }));
  }
  await prisma.$transaction(writes, TX_OPTS);

  return { summary: `Verified ${contacts.length} email${contacts.length === 1 ? "" : "s"} — ${valid} valid.` };
}
