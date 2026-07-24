// Prepaid top-up packages. Balance is denominated in service VALUE, and a
// package credits its full price as value (token usage is 1/7 of it — the 7x
// markup is baked in at purchase). `approxRuns` is an estimate for display,
// based on a typical Research run value of ~$0.50.
const APPROX_RUN_VALUE_USD = 0.5;

export type CreditPackage = {
  id: string;
  name: string;
  priceUsd: number; // what the customer pays == value credited
  highlight?: boolean;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter", name: "Starter", priceUsd: 70 },
  { id: "growth", name: "Growth", priceUsd: 210, highlight: true },
  { id: "scale", name: "Scale", priceUsd: 700 },
];

export function approxRuns(priceUsd: number): number {
  return Math.round(priceUsd / APPROX_RUN_VALUE_USD);
}
