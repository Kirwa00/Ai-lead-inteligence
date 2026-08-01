import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { microsToUsd } from "@/lib/billing";
import { ProfileForm, ChangePasswordForm } from "@/components/ui/AccountSettings";
import TeamSection from "@/components/ui/TeamSection";
import DeleteWorkspace from "@/components/ui/DeleteWorkspace";
import SendingDomainCard, {
  type SendingDomainView,
  type DnsRow,
} from "@/components/ui/SendingDomainCard";
import { resendConfigured } from "@/lib/email-sender";
import LlmProviderToggle from "@/components/ui/LlmProviderToggle";
import { llmProvidersAvailable, resolveLlmProvider, type LlmProvider } from "@/lib/agents/shared";

export const dynamic = "force-dynamic";

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest">
        <h2 className="text-headline-sm font-semibold text-on-surface">{title}</h2>
        {subtitle && <p className="text-body-sm text-on-surface-variant mt-xs">{subtitle}</p>}
      </div>
      <div className="p-lg">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-sm">
      <span className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</span>
      <span className="text-body-sm text-on-surface">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          role: true,
          createdAt: true,
          emailVerified: true,
          organizationId: true,
          organization: {
            select: { name: true, slug: true, plan: true, creditBalanceMicros: true, llmProvider: true },
          },
        },
      })
    : null;

  const org = user?.organization;
  const balanceUsd = org ? microsToUsd(org.creditBalanceMicros) : 0;
  const isOwner = user?.role === "owner";
  const llmProvider = resolveLlmProvider(org?.llmProvider) as LlmProvider;
  const llmAvailable = llmProvidersAvailable();

  const orgId = user?.organizationId;
  const sendingDomainRow = orgId
    ? await prisma.sendingDomain.findUnique({ where: { organizationId: orgId } })
    : null;

  const sendingDomain: SendingDomainView = sendingDomainRow
    ? {
        domain: sendingDomainRow.domain,
        status: sendingDomainRow.status,
        // Stored as Json, so narrow it back to the shape the card renders.
        dnsRecords: Array.isArray(sendingDomainRow.dnsRecords)
          ? (sendingDomainRow.dnsRecords as unknown as DnsRow[])
          : [],
        fromLocalPart: sendingDomainRow.fromLocalPart,
        fromName: sendingDomainRow.fromName,
        lastCheckedAt: sendingDomainRow.lastCheckedAt?.toISOString() ?? null,
      }
    : null;

  const [members, invites] = await Promise.all([
    orgId
      ? prisma.user.findMany({
          where: { organizationId: orgId },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    orgId
      ? prisma.invite.findMany({
          where: { organizationId: orgId, status: "pending" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-lg py-lg max-w-3xl">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Settings</h1>
        <p className="text-body-md text-on-surface-variant">Manage your account, security, and workspace.</p>
      </div>

      <Card title="Account" subtitle="Your personal profile.">
        <div className="space-y-md">
          <ProfileForm initialName={user?.name ?? ""} />
          <div className="border-t border-outline-variant pt-md">
            <Row label="Email" value={user?.email ?? "—"} />
            <Row
              label="Email Status"
              value={user?.emailVerified ? "Verified" : "Not verified"}
            />
            <Row label="Role" value={user?.role ?? "—"} />
            <Row
              label="Member Since"
              value={user?.createdAt ? user.createdAt.toISOString().split("T")[0] : "—"}
            />
          </div>
        </div>
      </Card>

      <Card title="Security" subtitle="Change your password.">
        <ChangePasswordForm />
      </Card>

      <Card title="AI Provider" subtitle="Choose Claude or DeepSeek for your AI agents.">
        <LlmProviderToggle initialProvider={llmProvider} available={llmAvailable} isOwner={isOwner} />
      </Card>

      <Card title="Workspace" subtitle="Your organisation and credit balance.">
        <Row label="Workspace" value={org?.name ?? "—"} />
        <Row label="Plan" value={org?.plan ?? "—"} />
        <div className="border-t border-outline-variant mt-sm pt-md">
          <Row label="Credit Balance" value={`$${balanceUsd.toFixed(2)}`} />
        </div>
      </Card>

      <Card
        title="Sending Domain"
        subtitle="Send outreach from your own domain so it reaches prospects' inboxes."
      >
        <SendingDomainCard
          initial={sendingDomain}
          isOwner={isOwner}
          resendConfigured={resendConfigured()}
        />
      </Card>

      <Card title="Team" subtitle="Invite teammates and manage who has access.">
        <TeamSection
          isOwner={isOwner}
          currentUserId={userId ?? ""}
          members={members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
          invites={invites.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            createdAt: i.createdAt.toISOString(),
            expiresAt: i.expiresAt.toISOString(),
          }))}
        />
      </Card>

      {isOwner && org && (
        <div className="bg-surface-container-low border border-error/30 rounded-xl overflow-hidden">
          <div className="px-lg py-md border-b border-error/30 bg-surface-container-lowest">
            <h2 className="text-headline-sm font-semibold text-error">Danger Zone</h2>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              Irreversible actions. Please be certain.
            </p>
          </div>
          <div className="p-lg">
            <DeleteWorkspace orgName={org.name} />
          </div>
        </div>
      )}
    </div>
  );
}
