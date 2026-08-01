import { describe, expect, it } from "vitest";
import { isPublicRoute } from "@/lib/public-routes";

describe("isPublicRoute", () => {
  it.each([
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/api/auth/verify-email",
    "/api/auth/forgot-password",
    "/api/register",
    "/api/webhooks/stripe",
  ])("allows %s without a session", (path) => {
    expect(isPublicRoute(path)).toBe(true);
  });

  // A logged-out person clicking an invite link must be able to read the
  // invite before they have an account — this was previously blocked.
  it("allows the invite lookup used by the register page", () => {
    expect(isPublicRoute("/api/invites/some-token")).toBe(true);
  });

  it.each(["/dashboard", "/campaigns", "/settings", "/api/campaigns", "/api/team/invites"])(
    "requires a session for %s",
    (path) => {
      expect(isPublicRoute(path)).toBe(false);
    }
  );
});
