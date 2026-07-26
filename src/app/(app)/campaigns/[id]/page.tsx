import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import CampaignControls from "@/components/ui/CampaignControls";
import AgentRunButton from "@/components/ui/AgentRunButton";
import CampaignDeleteButton from "@/components/ui/CampaignDeleteButton";
import EmailSendButton from "@/components/ui/EmailSendButton";
import { AGENTS } from "@/lib/agents";
import { ESTIMATED_COST_USD } from "@/lib/agents/cost-estimates";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  active: "text-primary bg-primary/10 border-primary/20",
  paused: "text-secondary bg-secondary/10 border-secondary/20",
  validating: "text-tertiary bg-tertiary/10 border-tertiary/20",
  draft: "text-on-surface-variant bg-surface-container-high border-outline-variant",
  completed: "text-on-surface-variant bg-surface-container-high border-outline-variant",
};

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!orgId) notFound();

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, organizationId: orgId }, // org-scoped
    include: {
      leads: {
        include: { company: true, contact: true },
        orderBy: { score: "desc" },
      },
      emails: {
        include: { lead: { include: { company: true, contact: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!campaign) notFound();

  const total = campaign.leads.length;
  const worked = campaign.leads.filter((l) => l.status !== "uncontacted").length;
  const replied = campaign.leads.filter((l) => l.status === "replied").length;
  const meetings = campaign.leads.filter((l) => l.status === "meeting_booked").length;
  const progress = total > 0 ? Math.min(100, Math.round((worked / total) * 100)) : 0;

  const kpis = [
    { label: "Leads", value: total },
    { label: "Replied", value: replied },
    { label: "Meetings", value: meetings },
    { label: "Progress", value: `${progress}%` },
  ];

  const hasLeads = campaign.leads.length > 0;
  const hasContacts = campaign.leads.some((l) => l.contactId);
  const hasSentEmails = campaign.emails.some((e) => e.status === "sent");

  const prerequisiteWarnings: Record<string, string> = {
    qualification: !hasLeads ? "Run Research first to add leads to qualify." : "",
    contact_discovery: !hasLeads ? "Run Research first to add leads." : "",
    email_verification: !hasContacts ? "Run Contact Discovery first to find contacts." : "",
    outreach: !hasContacts ? "Run Contact Discovery first so there's someone to email." : "",
    followup: !hasSentEmails ? "Run Outreach and send at least one email first." : "",
    reporting: !hasLeads ? "Run other agents first — there's no activity to report on yet." : "",
  };

  // Legacy campaigns created before agent selection existed run every agent;
  // new ones only show the agents the wizard assigned.
  const visibleAgentTypes =
    campaign.enabledAgents.length > 0 ? campaign.enabledAgents.filter((t) => t in AGENTS) : Object.keys(AGENTS);

  return (
    <div className="space-y-lg py-lg max-w-5xl">
      {/* Back + header */}
      <Link href="/campaigns" className="inline-flex items-center gap-xs font-mono text-label-sm text-on-surface-variant hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-body-sm">arrow_back</span>
        All campaigns
      </Link>

      <div className="flex flex-wrap justify-between items-start gap-md">
        <div>
          <div className="flex items-center gap-md mb-xs">
            <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">{campaign.name}</h1>
            <span className={`font-mono text-label-sm px-sm py-xs rounded border capitalize ${statusBadge[campaign.status] ?? statusBadge.draft}`}>
              {campaign.status}
            </span>
          </div>
          <p className="font-mono text-label-sm text-on-surface-variant">
            {(campaign.industry ?? "—")} · {(campaign.geography ?? "—")} · {(campaign.companySize ?? "Any size")} · created {campaign.createdAt.toISOString().split("T")[0]}
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <CampaignControls id={campaign.id} status={campaign.status} size="md" />
          <CampaignDeleteButton id={campaign.id} name={campaign.name} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
        {kpis.map((k) => (
          <div key={k.label} className="bg-surface-container-low border border-outline-variant rounded-xl p-md">
            <div className="text-display-lg font-bold text-on-surface">{k.value}</div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Objective & context */}
        <div className="lg:col-span-2 bg-surface-container-low border border-outline-variant rounded-xl p-lg space-y-md">
          <h2 className="text-headline-sm font-semibold text-on-surface">Objective & AI Context</h2>
          <div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">Goal</div>
            <p className="text-body-sm text-on-surface">{campaign.goal ?? "—"}</p>
          </div>
          {campaign.description && (
            <div>
              <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">Description</div>
              <p className="text-body-sm text-on-surface whitespace-pre-wrap">{campaign.description}</p>
            </div>
          )}
          <div>
            <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">Product / Service Context for AI</div>
            <p className="text-body-sm text-on-surface whitespace-pre-wrap">
              {campaign.context?.trim() ? campaign.context : "No context added yet — add product/service details so the AI workforce can tailor research & outreach."}
            </p>
          </div>
          {campaign.keywords.length > 0 && (
            <div className="flex flex-wrap gap-xs">
              {campaign.keywords.map((k) => (
                <span key={k} className="font-mono text-label-sm px-sm py-xs rounded border text-on-surface-variant bg-surface-container-high border-outline-variant">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI workforce actions */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg space-y-sm">
          <h2 className="text-headline-sm font-semibold text-on-surface">AI Workforce</h2>
          <p className="text-body-sm text-on-surface-variant">
            Numbered in recommended run order. Agents run on this campaign&apos;s ICP &amp; context, in the background.
          </p>
          {visibleAgentTypes.map((type, i) => {
            const a = AGENTS[type];
            if (!a) return null;
            return (
              <AgentRunButton
                key={type}
                campaignId={campaign.id}
                type={type}
                label={a.label}
                description={a.description}
                order={i + 1}
                estCost={ESTIMATED_COST_USD[type]}
                prerequisiteWarning={prerequisiteWarnings[type]}
              />
            );
          })}
        </div>
      </div>

      {/* Leads */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface">Leads</h2>
          <Link href="/leads" className="font-mono text-label-sm text-primary hover:underline">Open Lead Explorer</Link>
        </div>
        {campaign.leads.length === 0 ? (
          <div className="px-lg py-xl text-center text-on-surface-variant">
            <p className="text-body-sm">No leads yet. Run the Research Agent to find matching companies.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {campaign.leads.slice(0, 20).map((l) => (
              <div key={l.id} className="px-lg py-sm flex items-center justify-between">
                <div>
                  <div className="text-body-sm text-on-surface">{l.company?.name ?? "Unknown company"}</div>
                  <div className="font-mono text-label-sm text-on-surface-variant">
                    {l.contact ? `${l.contact.firstName} ${l.contact.lastName}${l.contact.title ? " · " + l.contact.title : ""}` : "No contact"}
                  </div>
                </div>
                <div className="flex items-center gap-md">
                  <span className="font-mono text-label-sm text-on-surface-variant capitalize">{l.status.replace(/_/g, " ")}</span>
                  <span className="font-mono text-label-md font-bold text-primary">{l.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Outreach emails */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest">
          <h2 className="text-headline-sm font-semibold text-on-surface">Outreach Emails</h2>
        </div>
        {campaign.emails.length === 0 ? (
          <div className="px-lg py-xl text-center text-on-surface-variant">
            <p className="text-body-sm">
              No emails yet. Run the Outreach or Follow-up agent to draft some.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant">
            {campaign.emails.map((e) => (
              <div key={e.id} className="px-lg py-md flex items-start justify-between gap-md">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-sm mb-xs">
                    <span className="text-body-sm font-semibold text-on-surface">{e.subject}</span>
                    <span
                      className={`font-mono text-label-sm px-sm py-xs rounded border capitalize shrink-0 ${
                        e.status === "sent"
                          ? "text-primary bg-primary/10 border-primary/20"
                          : "text-on-surface-variant bg-surface-container-high border-outline-variant"
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="font-mono text-label-sm text-on-surface-variant mb-xs">
                    To: {e.lead?.company?.name ?? "Unknown"}
                    {e.lead?.contact?.email ? ` <${e.lead.contact.email}>` : " — no contact email on file"}
                  </p>
                  <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap line-clamp-3">
                    {e.body}
                  </p>
                </div>
                {e.status === "draft" ? (
                  e.lead?.contact?.email ? (
                    <EmailSendButton campaignId={campaign.id} emailId={e.id} />
                  ) : (
                    <span className="font-mono text-label-sm text-on-surface-variant shrink-0">No email</span>
                  )
                ) : (
                  <span className="font-mono text-label-sm text-on-surface-variant shrink-0">
                    {e.sentAt ? e.sentAt.toISOString().split("T")[0] : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
