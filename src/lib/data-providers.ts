/**
 * Real B2B contact-data providers behind Contact Discovery and Email
 * Verification. Both are optional and env-gated:
 *
 *   APOLLO_API_KEY  — people search: find a decision-maker (name, title,
 *                     email + Apollo's own email status) for a company domain.
 *   HUNTER_API_KEY  — email verifier: deliverability status for an address;
 *                     also a domain-search fallback for finding a contact.
 *
 * Without keys the agents fall back to the LLM (discovery) and syntactic
 * heuristics (verification) exactly as before. Each successful lookup is a
 * flat wallet charge (see PROVIDER_LOOKUP_RAW_MICROS in billing.ts).
 */

export type EmailStatus = "valid" | "risky" | "invalid" | "unverified";

export type DiscoveredContact = {
  firstName: string;
  lastName: string;
  title: string;
  email: string | null;
  emailStatus: EmailStatus;
  linkedinUrl: string | null;
  phone: string | null;
  source: "apollo" | "hunter";
};

export type VerificationResult = {
  status: EmailStatus;
  score: number | null;
  source: "hunter";
};

class DataProviderError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "DataProviderError";
    this.status = status;
  }
}

function key(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function apolloConfigured(): boolean {
  return key("APOLLO_API_KEY").length > 0;
}

export function hunterConfigured(): boolean {
  return key("HUNTER_API_KEY").length > 0;
}

/** True when at least one provider can find contacts from a company domain. */
export function discoveryProviderConfigured(): boolean {
  return apolloConfigured() || hunterConfigured();
}

/** True when a deliverability check (rather than heuristics) is available. */
export function verificationProviderConfigured(): boolean {
  return hunterConfigured();
}

export function dataProvidersAvailable(): { apollo: boolean; hunter: boolean } {
  return { apollo: apolloConfigured(), hunter: hunterConfigured() };
}

// Seniority-first ordering used to pick the best person from a result set.
const TITLE_PRIORITY = [
  /\b(ceo|chief executive|founder|co-founder|owner|managing director|md)\b/i,
  /\b(coo|cfo|cto|cmo|cro|chief)\b/i,
  /\b(vp|vice president|svp|evp)\b/i,
  /\b(head of|director)\b/i,
  /\b(manager|lead)\b/i,
];

export function rankTitle(title: string | null | undefined): number {
  if (!title) return TITLE_PRIORITY.length + 1;
  const idx = TITLE_PRIORITY.findIndex((re) => re.test(title));
  return idx === -1 ? TITLE_PRIORITY.length : idx;
}

/** Pick the most senior, best-emailed candidate. Exported for tests. */
export function pickBest<T extends { title: string | null; emailStatus: EmailStatus; email: string | null }>(
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
  const statusWeight: Record<EmailStatus, number> = { valid: 0, risky: 1, unverified: 2, invalid: 3 };
  return [...candidates].sort((a, b) => {
    const emailA = a.email ? 0 : 1;
    const emailB = b.email ? 0 : 1;
    if (emailA !== emailB) return emailA - emailB;
    const s = statusWeight[a.emailStatus] - statusWeight[b.emailStatus];
    if (s !== 0) return s;
    return rankTitle(a.title) - rankTitle(b.title);
  })[0];
}

// ---------------------------------------------------------------- Apollo

type ApolloPerson = {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: Array<{ sanitized_number?: string | null }> | null;
};

/** Map Apollo's email_status vocabulary onto ours. Exported for tests. */
export function mapApolloEmailStatus(status: string | null | undefined, email: string | null): EmailStatus {
  if (!email) return "unverified";
  switch ((status ?? "").toLowerCase()) {
    case "verified":
      return "valid";
    case "likely to engage":
    case "guessed":
    case "unavailable":
      return "risky";
    case "invalid":
    case "bounced":
      return "invalid";
    default:
      return "unverified";
  }
}

export function apolloPersonToContact(p: ApolloPerson): DiscoveredContact | null {
  let firstName = (p.first_name ?? "").trim();
  let lastName = (p.last_name ?? "").trim();
  if (!firstName && !lastName && p.name) {
    const parts = p.name.trim().split(/\s+/);
    firstName = parts[0] ?? "";
    lastName = parts.slice(1).join(" ");
  }
  if (!firstName && !lastName) return null;
  const email = p.email?.trim() || null;
  return {
    firstName,
    lastName,
    title: (p.title ?? "").trim(),
    email,
    emailStatus: mapApolloEmailStatus(p.email_status, email),
    linkedinUrl: p.linkedin_url ?? null,
    phone: p.phone_numbers?.[0]?.sanitized_number ?? null,
    source: "apollo",
  };
}

async function apolloFindContact(domain: string, titleHints: string[]): Promise<DiscoveredContact | null> {
  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: {
      "x-api-key": key("APOLLO_API_KEY"),
      "content-type": "application/json",
      "cache-control": "no-cache",
    },
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      person_seniorities: ["owner", "founder", "c_suite", "vp", "head", "director"],
      person_titles: titleHints.length > 0 ? titleHints : undefined,
      page: 1,
      per_page: 10,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DataProviderError(`Apollo ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, res.status);
  }
  const data = (await res.json()) as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
  const people = [...(data.people ?? []), ...(data.contacts ?? [])];
  const candidates = people.map(apolloPersonToContact).filter((c): c is DiscoveredContact => !!c);
  return pickBest(candidates);
}

// ---------------------------------------------------------------- Hunter

type HunterEmail = {
  value?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  seniority?: string | null;
  linkedin?: string | null;
  phone_number?: string | null;
  verification?: { status?: string | null } | null;
  confidence?: number | null;
};

/** Map Hunter's verifier statuses onto ours. Exported for tests. */
export function mapHunterStatus(status: string | null | undefined, score?: number | null): EmailStatus {
  switch ((status ?? "").toLowerCase()) {
    case "valid":
    case "deliverable":
      return "valid";
    case "accept_all":
    case "webmail":
    case "disposable":
    case "unknown":
      return "risky";
    case "invalid":
    case "undeliverable":
      return "invalid";
    default:
      if (typeof score === "number") return score >= 80 ? "valid" : score >= 50 ? "risky" : "invalid";
      return "unverified";
  }
}

export function hunterEmailToContact(e: HunterEmail): DiscoveredContact | null {
  const firstName = (e.first_name ?? "").trim();
  const lastName = (e.last_name ?? "").trim();
  if (!firstName && !lastName) return null;
  const email = e.value?.trim() || null;
  return {
    firstName,
    lastName,
    title: (e.position ?? "").trim(),
    email,
    emailStatus: mapHunterStatus(e.verification?.status, e.confidence),
    linkedinUrl: e.linkedin ?? null,
    phone: e.phone_number ?? null,
    source: "hunter",
  };
}

async function hunterFindContact(domain: string): Promise<DiscoveredContact | null> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("type", "personal");
  url.searchParams.set("seniority", "executive,senior");
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", key("HUNTER_API_KEY"));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DataProviderError(`Hunter ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, res.status);
  }
  const data = (await res.json()) as { data?: { emails?: HunterEmail[] } };
  const candidates = (data.data?.emails ?? [])
    .map(hunterEmailToContact)
    .filter((c): c is DiscoveredContact => !!c);
  return pickBest(candidates);
}

export async function hunterVerifyEmail(email: string): Promise<VerificationResult> {
  const url = new URL("https://api.hunter.io/v2/email-verifier");
  url.searchParams.set("email", email);
  url.searchParams.set("api_key", key("HUNTER_API_KEY"));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DataProviderError(`Hunter ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, res.status);
  }
  const data = (await res.json()) as { data?: { status?: string | null; result?: string | null; score?: number | null } };
  const score = typeof data.data?.score === "number" ? data.data.score : null;
  return { status: mapHunterStatus(data.data?.status ?? data.data?.result, score), score, source: "hunter" };
}

// ---------------------------------------------------------------- Facade

/**
 * Find the best decision-maker at `domain`. Tries Apollo first (richer people
 * data), then Hunter. Returns null when nothing is configured or no match.
 * Provider errors propagate so the caller can decide whether to fall back.
 */
export async function findDecisionMaker(domain: string, titleHints: string[] = []): Promise<DiscoveredContact | null> {
  const clean = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim().toLowerCase();
  if (!clean) return null;
  if (apolloConfigured()) {
    const hit = await apolloFindContact(clean, titleHints);
    if (hit) return hit;
  }
  if (hunterConfigured()) {
    const hit = await hunterFindContact(clean);
    if (hit) return hit;
  }
  return null;
}
