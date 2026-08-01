import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindUnique,
  mockInviteFindUnique,
  mockInviteUpdate,
  mockUserCreate,
  mockTransaction,
  mockProvision,
  mockIssueToken,
  mockSendVerification,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockInviteFindUnique: vi.fn(),
  mockInviteUpdate: vi.fn(),
  mockUserCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockProvision: vi.fn(),
  mockIssueToken: vi.fn(),
  mockSendVerification: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
    invite: { findUnique: mockInviteFindUnique },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/provisioning", () => ({ provisionSoloWorkspace: mockProvision }));
vi.mock("@/lib/tokens", () => ({ issueToken: mockIssueToken }));
vi.mock("@/lib/auth-emails", () => ({ sendVerificationEmail: mockSendVerification }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async () => "hashed-password") }));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimit: () => ({ ok: true, remaining: 1, retryAfterSec: 0 }),
    tooMany: () => new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }),
  };
});

import { POST } from "./route";

function post(body: unknown) {
  return new NextRequest("http://localhost/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID = {
  name: "Ada",
  email: "ada@example.com",
  password: "super-secret-123",
  workspace: "Ada Labs",
};

describe("register API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockProvision.mockResolvedValue({ userId: "user-1", organizationId: "org-1" });
    mockIssueToken.mockResolvedValue("raw-token");
    // Simulates a configured mail provider so no dev fallback URL is returned.
    mockSendVerification.mockResolvedValue(true);
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ user: { create: mockUserCreate }, invite: { update: mockInviteUpdate } })
    );
    mockUserCreate.mockResolvedValue({ id: "user-1" });
  });

  it("provisions a solo workspace and returns 201", async () => {
    const res = await POST(post(VALID));

    expect(res.status).toBe(201);
    expect(mockProvision).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@example.com", workspaceName: "Ada Labs" })
    );
  });

  it("sends a verification email for the new account", async () => {
    await POST(post(VALID));

    expect(mockIssueToken).toHaveBeenCalledWith("user-1", "email_verify");
    expect(mockSendVerification).toHaveBeenCalledWith(
      "ada@example.com",
      expect.stringContaining("/api/auth/verify-email?token=raw-token")
    );
  });

  it("rejects an email that already has an account", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing" });

    const res = await POST(post(VALID));

    expect(res.status).toBe(409);
    expect(mockProvision).not.toHaveBeenCalled();
  });

  it("joins the inviting workspace instead of creating one", async () => {
    mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      email: "ada@example.com",
      role: "member",
      organizationId: "org-existing",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await POST(post({ ...VALID, inviteToken: "tok" }));

    expect(res.status).toBe(201);
    // The whole point of an invite: no new org, no second free grant.
    expect(mockProvision).not.toHaveBeenCalled();
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: "org-existing", role: "member" }),
      })
    );
  });

  it("refuses an invite issued to a different address", async () => {
    mockInviteFindUnique.mockResolvedValue({
      id: "inv-1",
      email: "someone-else@example.com",
      role: "member",
      organizationId: "org-existing",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const res = await POST(post({ ...VALID, inviteToken: "tok" }));

    expect(res.status).toBe(400);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("still returns 201 when the verification email fails", async () => {
    mockIssueToken.mockRejectedValue(new Error("mail backend down"));

    const res = await POST(post(VALID));

    // Signup must not hard-fail on a mail outage — verification is a follow-up.
    expect(res.status).toBe(201);
  });
});
