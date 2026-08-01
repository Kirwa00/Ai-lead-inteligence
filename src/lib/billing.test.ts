import { describe, expect, it } from "vitest";
import {
  computeChargeMicros,
  computeRawCostMicros,
  microsToUsd,
  valueMicrosToTokenBudgetUsd,
} from "@/lib/billing";

describe("billing helpers", () => {
  it("computes raw cost and markup correctly", () => {
    const raw = computeRawCostMicros("claude-sonnet-5", 1000, 500);
    const charge = computeChargeMicros("claude-sonnet-5", 1000, 500);

    expect(raw).toBe(BigInt(10500));
    expect(charge).toBe(BigInt(73500));
  });

  it("converts micros to USD", () => {
    expect(microsToUsd(BigInt(3_500_000))).toBe(3.5);
  });

  it("maps value balance to token budget", () => {
    expect(valueMicrosToTokenBudgetUsd(BigInt(7_000_000))).toBe(1);
  });
});
