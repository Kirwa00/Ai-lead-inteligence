import { describe, expect, it } from "vitest";
import { STALE_AFTER_MS, isStale, staleCutoff } from "@/lib/agents/job-staleness";

const NOW = new Date("2026-08-01T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("agent job staleness", () => {
  it("treats a job that just started as alive", () => {
    expect(isStale(ago(1_000), NOW)).toBe(false);
  });

  /**
   * The route allows 60s of work, so a run at 90s is slow but could still be
   * mid-flight. Reaping it here would kill a job that's about to succeed.
   */
  it("does not reap a slow run that is still within its allowed lifetime", () => {
    expect(isStale(ago(90_000), NOW)).toBe(false);
  });

  it("reaps a job older than the cutoff", () => {
    expect(isStale(ago(STALE_AFTER_MS + 1_000), NOW)).toBe(true);
  });

  it("is inclusive exactly at the cutoff", () => {
    expect(isStale(ago(STALE_AFTER_MS), NOW)).toBe(true);
  });

  it("stays clear of the 60s function limit so live runs are never reaped", () => {
    expect(STALE_AFTER_MS).toBeGreaterThan(60_000);
  });

  it("derives a cutoff consistent with isStale", () => {
    const cutoff = staleCutoff(NOW);
    expect(cutoff.getTime()).toBe(NOW.getTime() - STALE_AFTER_MS);
    // Anything at or before the cutoff is stale; anything after it is alive.
    expect(isStale(new Date(cutoff.getTime() - 1), NOW)).toBe(true);
    expect(isStale(new Date(cutoff.getTime() + 1), NOW)).toBe(false);
  });
});
