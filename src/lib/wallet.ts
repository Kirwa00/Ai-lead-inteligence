import { prisma } from "@/lib/prisma";
import { computeRawCostMicros, computeChargeMicros } from "@/lib/billing";
import type { Prisma } from "@prisma/client";

/** Any client that can run the writes — the shared prisma client or a $transaction tx. */
type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getBalanceMicros(organizationId: string): Promise<bigint> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { creditBalanceMicros: true },
  });
  return org?.creditBalanceMicros ?? BigInt(0);
}

/**
 * Credit an organization's wallet (free grant, package top-up, promo, refund)
 * and append a ledger row. Uses an atomic `increment` so it's race-safe, and
 * can run inside a caller's transaction (pass `tx`) or standalone.
 */
export async function grantCredits(
  client: DbClient,
  organizationId: string,
  amountMicros: bigint,
  description: string,
  type: string = "grant"
): Promise<bigint> {
  const org = await client.organization.update({
    where: { id: organizationId },
    data: { creditBalanceMicros: { increment: amountMicros } },
    select: { creditBalanceMicros: true },
  });
  await client.walletTransaction.create({
    data: {
      organizationId,
      type,
      amountMicros,
      balanceAfterMicros: org.creditBalanceMicros,
      description,
    },
  });
  return org.creditBalanceMicros;
}

export type MeterInput = {
  organizationId: string;
  userId?: string | null;
  feature: string;
  agentType?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Debit the wallet for one completed LLM call. Atomic: balance decrement +
 * ledger row + usage event all commit together. The `decrement` is a single
 * SQL UPDATE, so concurrent calls can't race on a stale balance.
 */
export async function debitForUsage(
  input: MeterInput
): Promise<{ chargeMicros: bigint; rawCostMicros: bigint; balanceMicros: bigint }> {
  // Value charged to the wallet = raw token cost x markup (the "1/7" model).
  // We store the raw cost on the usage event so margin per call is auditable.
  const rawCostMicros = computeRawCostMicros(input.model, input.inputTokens, input.outputTokens);
  const chargeMicros = computeChargeMicros(input.model, input.inputTokens, input.outputTokens);

  const balanceMicros = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: input.organizationId },
      data: { creditBalanceMicros: { decrement: chargeMicros } },
      select: { creditBalanceMicros: true },
    });
    const wtx = await tx.walletTransaction.create({
      data: {
        organizationId: input.organizationId,
        type: "debit",
        amountMicros: -chargeMicros,
        balanceAfterMicros: org.creditBalanceMicros,
        description: `${input.feature} · ${input.model}`,
      },
    });
    await tx.usageEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        feature: input.feature,
        agentType: input.agentType ?? null,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        rawCostMicros,
        walletTransactionId: wtx.id,
      },
    });
    return org.creditBalanceMicros;
  });

  return { chargeMicros, rawCostMicros, balanceMicros };
}
