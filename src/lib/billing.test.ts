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

    expect(raw).toBe(10500n);
    expect(charge).toBe(73500n);
  });

  it("converts micros to USD", () => {
    expect(microsToUsd(3_500_000n)).toBe(3.5);
  });

  it("maps value balance to token budget", () => {
    expect(valueMicrosToTokenBudgetUsd(7_000_000n)).toBe(1);
  });
});
