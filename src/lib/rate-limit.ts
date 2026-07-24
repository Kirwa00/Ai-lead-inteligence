/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * NOTE: state is per-process. On serverless (Vercel) each instance keeps its
 * own map, so this is a strong *first* layer (blocks scripted floods hitting a
 * warm instance) but not a global guarantee. For hard global limits, back it
 * with Upstash/Redis — same call sites, swap the store.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();

  // Opportunistic sweep so the map can't grow unbounded.
  if (buckets.size > 5000) {
    buckets.forEach((v, k) => {
      if (v.resetAt <= now) buckets.delete(k);
    });
  }

  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (Vercel/Next set x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 429 JSON response with a Retry-After header. */
export function tooMany(retryAfterSec: number, message = "Too many requests. Please slow down.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(retryAfterSec) },
  });
}
