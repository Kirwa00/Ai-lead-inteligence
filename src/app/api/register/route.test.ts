import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique, mockUserCreate, mockOrganizationCreate, mockGrantCredits, mockTransaction } =
  vi.hoisted(() => ({
    mockFindUnique: vi.fn(),
    mockUserCreate: vi.fn(),
    mockOrganizationCreate: vi.fn(),
    mockGrantCredits: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockFindUnique },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/wallet", () => ({
  grantCredits: mockGrantCredits,
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    rateLimit: () => ({ ok: true, remaining: 1, retryAfterSec: 0 }),
    tooMany: () => new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }),
  };
});

import { POST } from "./route";

describe("register API route", () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockUserCreate.mockReset();
    mockOrganizationCreate.mockReset();
    mockGrantCredits.mockReset();
    mockTransaction.mockReset();

    mockFindUnique.mockResolvedValue(null);

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = {
        organization: { create: mockOrganizationCreate },
        user: { create: mockUserCreate },
      };
      return cb(tx);
    });

    mockOrganizationCreate.mockResolvedValue({ id: "org-1" });
    mockUserCreate.mockResolvedValue({});
    mockGrantCredits.mockResolvedValue(undefined);
  });

  it("creates a new workspace and returns 201", async () => {
    const req = new Request("http://localhost/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Ada",
        email: "ada@example.com",
        password: "super-secret-123",
        workspace: "Ada Labs",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mockGrantCredits).toHaveBeenCalled();
  });
});
