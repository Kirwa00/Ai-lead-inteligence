/**
 * Routes reachable without a session. Single source of truth — both the
 * middleware and the NextAuth `authorized` callback import this, because when
 * the two lists drifted apart the middleware silently won and broke
 * invite-acceptance and email-verification links for logged-out users.
 *
 * Must stay edge-safe: no Node built-ins, no database imports.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/auth", // NextAuth's own handlers + our reset/verify endpoints
  "/api/register",
  "/api/invites", // token lookup shown on the register page before sign-up
  "/api/webhooks", // Stripe / Flutterwave callbacks, verified by signature
];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}
