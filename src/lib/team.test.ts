import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockFindUnique } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mockFindUnique } } }));

import { requireOwner } from "@/lib/team";

async function statusOf(result: Awaited<ReturnType<typeof requireOwner>>) {
  return "error" in result ? result.error.status : null;
}

describe("requireOwner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a real owner through", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValue({ id: "u1", role: "owner", organizationId: "org1" });

    const result = await requireOwner();

    expect(result).toEqual({ orgId: "org1", userId: "u1" });
  });

  it("rejects a member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u2" } });
    mockFindUnique.mockResolvedValue({ id: "u2", role: "member", organizationId: "org1" });

    expect(await statusOf(await requireOwner())).toBe(403);
  });

  it("rejects when there is no session", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await statusOf(await requireOwner())).toBe(401);
  });

  it("rejects a session whose user no longer exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "deleted" } });
    mockFindUnique.mockResolvedValue(null);

    expect(await statusOf(await requireOwner())).toBe(401);
  });

  /**
   * Regression: JWT sessions are stateless, so a demoted owner keeps a stale
   * `role: "owner"` claim until the token expires. Trusting it let an ex-owner
   * delete the entire workspace after transferring ownership away.
   */
  it("ignores a stale owner claim on the session and uses the database role", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u3", role: "owner", organizationId: "org1" } });
    mockFindUnique.mockResolvedValue({ id: "u3", role: "member", organizationId: "org1" });

    expect(await statusOf(await requireOwner())).toBe(403);
  });
});
