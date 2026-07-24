import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { microsToUsd, valueMicrosToTokenBudgetUsd } from "@/lib/billing";
import TopUpButtons from "@/components/ui/TopUpButtons";

export const dynamic = "force-dynamic";

function money(micros: bigint) {
  return `$${microsToUsd(micros).toFixed(2)}`;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { topup?: string };
}) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;

  const [org, txns, usage] = orgId
    ? await Promise.all([
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { creditBalanceMicros: true },
        }),
        prisma.walletTransaction.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        prisma.usageEvent.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ])
    : [null, [], []];

  const balance = org?.creditBalanceMicros ?? BigInt(0);

  return (
    <div className="space-y-lg py-lg max-w-4xl">
      <div>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight mb-xs">Billing & Usage</h1>
        <p className="text-body-md text-on-surface-variant">Top up credits and track your AI spend.</p>
      </div>

      {searchParams.topup === "success" && (
        <div className="flex items-center gap-sm px-lg py-md rounded-xl border border-primary/30 bg-primary/10 text-primary font-mono text-label-md">
          <span className="material-symbols-outlined text-body-sm">check_circle</span>
          Payment received — your balance updates within a few seconds.
        </div>
      )}
      {searchParams.topup === "cancelled" && (
        <div className="flex items-center gap-sm px-lg py-md rounded-xl border border-outline-variant bg-surface-container-high text-on-surface-variant font-mono text-label-md">
          <span className="material-symbols-outlined text-body-sm">info</span>
          Checkout cancelled — no charge was made.
        </div>
      )}

      {/* Balance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg">
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">Credit Balance</div>
          <div className="text-display-lg font-bold text-on-surface mt-xs">{money(balance)}</div>
        </div>
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg">
          <div className="font-mono text-label-sm text-on-surface-variant uppercase tracking-widest">AI Token Budget</div>
          <div className="text-display-lg font-bold text-on-surface mt-xs">
            ${valueMicrosToTokenBudgetUsd(balance).toFixed(2)}
          </div>
          <div className="font-mono text-label-sm text-on-surface-variant">1/7 of value</div>
        </div>
      </div>

      {/* Packages */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-lg">
        <h2 className="text-headline-sm font-semibold text-on-surface mb-md">Top up</h2>
        <TopUpButtons />
      </div>

      {/* History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest">
            <h2 className="text-headline-sm font-semibold text-on-surface">Transactions</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {txns.length === 0 && <div className="px-lg py-md text-body-sm text-on-surface-variant">No transactions yet.</div>}
            {txns.map((t) => (
              <div key={t.id} className="px-lg py-sm flex items-center justify-between">
                <div>
                  <div className="text-body-sm text-on-surface capitalize">{t.type}</div>
                  <div className="font-mono text-label-sm text-on-surface-variant">
                    {t.createdAt.toISOString().split("T")[0]} · {t.description ?? ""}
                  </div>
                </div>
                <span className={`font-mono text-label-md font-bold ${t.amountMicros < BigInt(0) ? "text-on-surface-variant" : "text-primary"}`}>
                  {t.amountMicros < BigInt(0) ? "-" : "+"}${Math.abs(microsToUsd(t.amountMicros)).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-lg py-md border-b border-outline-variant bg-surface-container-lowest">
            <h2 className="text-headline-sm font-semibold text-on-surface">Recent AI Usage</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {usage.length === 0 && <div className="px-lg py-md text-body-sm text-on-surface-variant">No usage yet.</div>}
            {usage.map((u) => (
              <div key={u.id} className="px-lg py-sm flex items-center justify-between">
                <div>
                  <div className="text-body-sm text-on-surface capitalize">{u.feature}</div>
                  <div className="font-mono text-label-sm text-on-surface-variant">
                    {u.model} · {u.inputTokens + u.outputTokens} tokens
                  </div>
                </div>
                <span className="font-mono text-label-md text-on-surface-variant">
                  raw {money(u.rawCostMicros)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
