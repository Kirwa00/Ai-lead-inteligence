/**
 * Billing / metering configuration.
 *
 * Pricing model (decided 2026-07-23): prepaid **value** wallet.
 *
 * The wallet balance is a customer-facing **value** in micro-USD (1e-6 USD).
 * The token usage it buys is **1/7 of that value** — i.e. each AI call debits
 * the raw Anthropic token cost x the markup (7x). So a $70 balance is worth
 * ~$10 of real tokens, and you keep the other $60 as margin. When the value
 * hits zero, the paid agents stop until the customer tops up.
 *
 * All amounts are micro-USD stored as BigInt so nothing is lost to floats.
 */

/** Markup: a balance of $X of value buys $X / markup of raw token usage. */
export const USAGE_MARKUP_MULTIPLIER = Number(process.env.USAGE_MARKUP_MULTIPLIER ?? 7);

/**
 * Free starter grant for a new workspace, in **value** micro-USD.
 * Default $3.50 of service value (= $0.50 of raw token budget at 7x, ~5 runs).
 */
export const FREE_GRANT_MICROS = BigInt(process.env.FREE_GRANT_MICROS ?? 3_500_000);

/**
 * Minimum value balance required to START a Research run (worst-case run value,
 * ~$0.10 raw x 7). Gating on this instead of ">0" bounds concurrent over-spend
 * to at most one run, closing the check-then-debit race without a full
 * reservation system.
 */
export const RESEARCH_RUN_RESERVE_MICROS = BigInt(700_000);

/** Per-token raw price in micro-USD, by model id. $/1M tokens == micro-USD/token. */
type ModelRate = { inputMicrosPerToken: number; outputMicrosPerToken: number };

export const MODEL_PRICING: Record<string, ModelRate> = {
  "claude-opus-4-8": { inputMicrosPerToken: 5, outputMicrosPerToken: 25 },
  "claude-sonnet-5": { inputMicrosPerToken: 3, outputMicrosPerToken: 15 },
  "claude-haiku-4-5": { inputMicrosPerToken: 1, outputMicrosPerToken: 5 },
};

// Unknown models bill at the most expensive (Opus) rate so we never undercharge.
const FALLBACK_RATE: ModelRate = { inputMicrosPerToken: 5, outputMicrosPerToken: 25 };

/** Raw Anthropic cost of a call, in micro-USD (what the tokens actually cost us). */
export function computeRawCostMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): bigint {
  const rate = MODEL_PRICING[model] ?? FALLBACK_RATE;
  const micros = inputTokens * rate.inputMicrosPerToken + outputTokens * rate.outputMicrosPerToken;
  return BigInt(Math.ceil(micros));
}

/** Value charged to the wallet for a call = raw token cost x markup. */
export function computeChargeMicros(
  model: string,
  inputTokens: number,
  outputTokens: number
): bigint {
  const raw = Number(computeRawCostMicros(model, inputTokens, outputTokens));
  return BigInt(Math.ceil(raw * USAGE_MARKUP_MULTIPLIER));
}

export function microsToUsd(micros: bigint): number {
  return Number(micros) / 1_000_000;
}

/** The raw token budget (in USD) behind a value balance — the "1/7". */
export function valueMicrosToTokenBudgetUsd(micros: bigint): number {
  return microsToUsd(micros) / USAGE_MARKUP_MULTIPLIER;
}

/** A package purchase credits its full price as value (tokens are 1/7 of it). */
export function packagePriceToValueMicros(priceUsd: number): bigint {
  return BigInt(Math.floor(priceUsd * 1_000_000));
}
