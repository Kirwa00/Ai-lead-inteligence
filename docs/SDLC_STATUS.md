# A1 Lead Intelligence — SDLC Status & Roadmap

> Milestones reconstructed from git history (49 commits, 2026-06-30 →
> 2026-08-01). Roadmap is a proposal toward a public SaaS launch.

## 1. Delivered milestones

| Phase | Dates | What shipped |
|---|---|---|
| **M0–M3: Platform scaffold** | Jun 30 – Jul 1 | Next.js 14 app, MD3 dark theme, NextAuth v5 credentials auth, Prisma schema, all core pages, Research agent (Claude), campaign wizard, demo-data layer |
| **Live data & deploy** | Jul 1 – Jul 3 | Supabase wired, demo layer removed, Edge-runtime auth split, Netlify → deploy fixes, pg-pool hardening |
| **Phase 1: Self-serve accounts** | Jul 23 | Registration, solo-workspace provisioning, Docker dev env, Vercel migration, Node 22 |
| **Phase 2: Monetisation** | Jul 23 – 24 | Prepaid value wallet (7× markup), free grant, Stripe + Flutterwave sandbox top-ups, billing page, metering |
| **AI workforce** | Jul 24 | Agent framework generalised, background jobs, all 7 agents wired & verified, research 40% faster |
| **Team & sending** | Jul 26 | Resend outreach sending, team invites, mobile sidebar, real per-org dashboard data, DeepSeek provider toggle |
| **Phase 3: Trustworthy data** | Sep 9 | Apollo + Hunter behind Contact Discovery (real decision-makers, provider email status) and Email Verification (live deliverability); env-gated with LLM/heuristic fallback; flat per-lookup wallet metering |
| **Hardening sprint** | Jul 31 – Aug 1 | Onboarding UX, email verification, password reset, Google sign-in, member removal / ownership transfer / workspace deletion, per-workspace sending domain, Vercel agent-timeout fix, provider fallback |

**Current status: feature-complete private beta.** Deployed at
https://ai-lead-inteligence.vercel.app; payments in sandbox; no public
launch yet.

## 2. Proposed roadmap to launch

### Phase 3 — Trustworthy data — DONE (code); needs keys
Apollo (`APOLLO_API_KEY`) and Hunter (`HUNTER_API_KEY`) are wired behind
Contact Discovery + Email Verification. Set the keys in Vercel and tune
`*_RAW_MICROS` to your provider plan so the markup holds.

### Phase 4 — Production payments
- Switch Stripe + Flutterwave to live keys; verify webhook signatures in
  production config.
- Verify DeepSeek pricing table before billing real customers (flagged in
  `src/lib/billing.ts`).

### Phase 5 — Deliverability & compliance
- Unsubscribe link + suppression list; bounce/complaint webhooks from
  Resend feeding `Email.status`.
- Reply/open ingestion to close the loop the schema already anticipates
  (`openedAt`, `repliedAt`) and make the Follow-up agent reply-aware.
- Sending throttles/warm-up; GDPR / Kenya DPA basics (data export,
  deletion — workspace deletion already exists).

### Phase 6 — Scale & polish
- Redis-backed global rate limiting (design already anticipates the swap).
- Consolidate legacy `AIAgent`/`AITask`/`Workflow` models into `AgentJob`.
- Adopt Prisma migrations instead of `db push` before the schema has real
  customer data.
- Landing page + pricing page for self-serve acquisition.

## 3. Working agreements (observed from history)

- Conventional-ish commits (`feat:` / `fix:` / `chore:` / `perf:`).
- CI on every push/PR: lint + Vitest with coverage (Node 22).
- Unit tests co-located with the code they test (`*.test.ts`), focused on
  pure logic (billing, tokens, routes, team rules, staleness).
- Direct-to-`master` development so far; PR-based flow recommended once
  the project has users.
