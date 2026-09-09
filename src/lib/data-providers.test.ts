import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apolloPersonToContact,
  dataProvidersAvailable,
  discoveryProviderConfigured,
  findDecisionMaker,
  hunterEmailToContact,
  hunterVerifyEmail,
  mapApolloEmailStatus,
  mapHunterStatus,
  pickBest,
  rankTitle,
  verificationProviderConfigured,
} from "@/lib/data-providers";

const KEYS = ["APOLLO_API_KEY", "HUNTER_API_KEY"] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe("configuration", () => {
  it("reports nothing configured with no keys", () => {
    expect(dataProvidersAvailable()).toEqual({ apollo: false, hunter: false });
    expect(discoveryProviderConfigured()).toBe(false);
    expect(verificationProviderConfigured()).toBe(false);
  });

  it("treats whitespace-only keys as unset", () => {
    process.env.APOLLO_API_KEY = "   ";
    expect(discoveryProviderConfigured()).toBe(false);
  });

  it("hunter alone enables both discovery and verification", () => {
    process.env.HUNTER_API_KEY = "k";
    expect(discoveryProviderConfigured()).toBe(true);
    expect(verificationProviderConfigured()).toBe(true);
  });

  it("apollo alone enables discovery only", () => {
    process.env.APOLLO_API_KEY = "k";
    expect(discoveryProviderConfigured()).toBe(true);
    expect(verificationProviderConfigured()).toBe(false);
  });
});

describe("status mapping", () => {
  it("maps apollo statuses", () => {
    expect(mapApolloEmailStatus("verified", "a@b.co")).toBe("valid");
    expect(mapApolloEmailStatus("guessed", "a@b.co")).toBe("risky");
    expect(mapApolloEmailStatus("invalid", "a@b.co")).toBe("invalid");
    expect(mapApolloEmailStatus("something-new", "a@b.co")).toBe("unverified");
    expect(mapApolloEmailStatus("verified", null)).toBe("unverified");
  });

  it("maps hunter statuses and falls back to score", () => {
    expect(mapHunterStatus("valid")).toBe("valid");
    expect(mapHunterStatus("accept_all")).toBe("risky");
    expect(mapHunterStatus("invalid")).toBe("invalid");
    expect(mapHunterStatus(null, 90)).toBe("valid");
    expect(mapHunterStatus(null, 60)).toBe("risky");
    expect(mapHunterStatus(null, 10)).toBe("invalid");
    expect(mapHunterStatus(null, null)).toBe("unverified");
  });
});

describe("record mapping", () => {
  it("splits a full name when first/last are missing", () => {
    const c = apolloPersonToContact({ name: "Ada Lovelace King", title: "CEO", email: "ada@x.io", email_status: "verified" });
    expect(c).toMatchObject({ firstName: "Ada", lastName: "Lovelace King", emailStatus: "valid", source: "apollo" });
  });

  it("drops nameless records", () => {
    expect(apolloPersonToContact({ email: "x@y.z" })).toBeNull();
    expect(hunterEmailToContact({ value: "x@y.z" })).toBeNull();
  });

  it("maps hunter domain-search rows", () => {
    const c = hunterEmailToContact({
      value: "jo@acme.com",
      first_name: "Jo",
      last_name: "Doe",
      position: "Head of Sales",
      verification: { status: "valid" },
      confidence: 95,
    });
    expect(c).toMatchObject({ email: "jo@acme.com", title: "Head of Sales", emailStatus: "valid", source: "hunter" });
  });
});

describe("pickBest", () => {
  it("ranks seniority", () => {
    expect(rankTitle("Chief Executive Officer")).toBeLessThan(rankTitle("Director of Ops"));
    expect(rankTitle("Director of Ops")).toBeLessThan(rankTitle("Account Manager"));
    expect(rankTitle("Intern")).toBeGreaterThan(rankTitle("Manager"));
  });

  it("prefers a verified email over a more senior guessed one", () => {
    const ceo = { title: "CEO", email: "ceo@x.io", emailStatus: "risky" as const };
    const vp = { title: "VP Sales", email: "vp@x.io", emailStatus: "valid" as const };
    expect(pickBest([ceo, vp])).toBe(vp);
  });

  it("prefers any email over none, then seniority", () => {
    const noEmail = { title: "CEO", email: null, emailStatus: "unverified" as const };
    const dir = { title: "Director", email: "d@x.io", emailStatus: "unverified" as const };
    const mgr = { title: "Manager", email: "m@x.io", emailStatus: "unverified" as const };
    expect(pickBest([noEmail, mgr, dir])).toBe(dir);
    expect(pickBest([])).toBeNull();
  });
});

describe("network calls", () => {
  it("returns null without any configured provider and makes no request", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(await findDecisionMaker("acme.com")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("normalises the domain and falls through apollo -> hunter", async () => {
    process.env.APOLLO_API_KEY = "a";
    process.env.HUNTER_API_KEY = "h";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("apollo.io")) return new Response(JSON.stringify({ people: [] }), { status: 200 });
      return new Response(
        JSON.stringify({ data: { emails: [{ value: "jo@acme.com", first_name: "Jo", last_name: "Doe", position: "CTO" }] } }),
        { status: 200 }
      );
    });
    const hit = await findDecisionMaker("https://www.acme.com/about");
    expect(hit?.source).toBe("hunter");
    expect(String(spy.mock.calls[1][0])).toContain("domain=acme.com");
  });

  it("surfaces provider HTTP errors with status", async () => {
    process.env.HUNTER_API_KEY = "h";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 429 }));
    await expect(hunterVerifyEmail("a@b.co")).rejects.toMatchObject({ status: 429 });
  });

  it("parses the verifier response", async () => {
    process.env.HUNTER_API_KEY = "h";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { status: "accept_all", score: 70 } }), { status: 200 })
    );
    expect(await hunterVerifyEmail("a@b.co")).toEqual({ status: "risky", score: 70, source: "hunter" });
  });
});
