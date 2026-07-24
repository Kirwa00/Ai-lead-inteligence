import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { microsToUsd, valueMicrosToTokenBudgetUsd } from "@/lib/billing";
import { ProfileForm, ChangePasswordForm } from "@/components/ui/AccountSettings";

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
          organization: {
            select: { name: true, slug: true, plan: true, creditBalanceMicros: true },
          },
        },
      })
    : null;

  const org = user?.organization;
  const balanceUsd = org ? microsToUsd(org.creditBalanceMicros) : 0;
  const tokenBudgetUsd = org ? valueMicrosToTokenBudgetUsd(org.creditBalanceMicros) : 0;

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

      <Card title="Workspace" subtitle="Your organisation and credit balance.">
        <Row label="Workspace" value={org?.name ?? "—"} />
        <Row label="Plan" value={org?.plan ?? "—"} />
        <div className="border-t border-outline-variant mt-sm pt-md">
          <Row label="Credit Balance" value={`$${balanceUsd.toFixed(2)}`} />
          <Row label="AI Token Budget" value={`$${tokenBudgetUsd.toFixed(2)} (1/7 of value)`} />
        </div>
      </Card>
    </div>
  );
}
