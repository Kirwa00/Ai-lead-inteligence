/**
 * When an agent job stops being plausibly alive.
 *
 * Agent work runs inside a serverless function via waitUntil. If the platform
 * kills that function at its duration limit, nothing ever writes a terminal
 * status: the row sits at "running" forever, the client polls a spinner that
 * never resolves, and the POST dedupe keeps returning that dead job so the
 * agent can never be retried. Anything older than this cutoff is treated as
 * dead so both paths can recover.
 *
 * Comfortably above the route's maxDuration (60s) so a slow-but-alive run is
 * never mistaken for a dead one.
 */
export const STALE_AFTER_MS = 2 * 60 * 1000;

export const IN_FLIGHT_STATUSES = ["queued", "running"] as const;

/** Timestamp before which an in-flight job must be considered dead. */
export function staleCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_AFTER_MS);
}

export function isStale(createdAt: Date, now: Date = new Date()): boolean {
  return createdAt.getTime() <= staleCutoff(now).getTime();
}
