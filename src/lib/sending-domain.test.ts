import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindUnique } = vi.hoisted(() => ({ mockFindUnique: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { sendingDomain: { findUnique: mockFindUnique } },
}));
vi.mock("@/lib/email-sender", () => ({ resendConfigured: () => true }));

import { normalizeDomain, isUsable, resolveOutreachFrom } from "@/lib/sending-domain";

describe("normalizeDomain", () => {
  it.each([
    ["acme.com", "acme.com"],
    ["ACME.com", "acme.com"],
    ["  acme.com  ", "acme.com"],
    ["https://acme.com", "acme.com"],
    ["https://www.acme.com/pricing", "acme.com"],
    ["mail.acme.co.uk", "mail.acme.co.uk"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it.each(["", "acme", "not a domain", "user@acme.com", "acme..com"])(
    "rejects %s",
    (input) => {
      expect(normalizeDomain(input)).toBeNull();
    }
  );
});

describe("isUsable", () => {
  it("only accepts a fully verified domain", () => {
    expect(isUsable("verified")).toBe(true);
    for (const s of ["pending", "not_started", "failure", "temporary_failure"]) {
      expect(isUsable(s)).toBe(false);
    }
  });
});

describe("resolveOutreachFrom", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when no domain is set up", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await resolveOutreachFrom("org1")).toBeNull();
  });

  /** Sending from an unverified domain would fail SPF/DKIM and burn reputation. */
  it("refuses to send from an unverified domain", async () => {
    mockFindUnique.mockResolvedValue({
      domain: "acme.com",
      status: "pending",
      fromLocalPart: "outreach",
      fromName: null,
    });
    expect(await resolveOutreachFrom("org1")).toBeNull();
  });

  it("returns a bare address when no display name is set", async () => {
    mockFindUnique.mockResolvedValue({
      domain: "acme.com",
      status: "verified",
      fromLocalPart: "outreach",
      fromName: null,
    });
    expect(await resolveOutreachFrom("org1")).toBe("outreach@acme.com");
  });

  it("formats a display name into the from header", async () => {
    mockFindUnique.mockResolvedValue({
      domain: "acme.com",
      status: "verified",
      fromLocalPart: "hello",
      fromName: "Acme Growth",
    });
    expect(await resolveOutreachFrom("org1")).toBe("Acme Growth <hello@acme.com>");
  });
});
