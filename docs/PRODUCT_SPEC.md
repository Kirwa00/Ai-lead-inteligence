# A1 Lead Intelligence — Product Spec

> Reconstructed from the codebase and git history (2026-06-30 → 2026-08-01).
> Vision confirmed by the founder: **a SaaS tool used by marketers to get
> leads via an online AI agent.**

## 1. Vision

Marketers and small sales teams describe who they want to sell to; an AI
workforce finds matching companies, identifies decision-makers, drafts
personalised outreach, and follows up — replacing hours of manual
prospecting with a few clicks. Revenue comes from a prepaid credit wallet:
customers buy value up front and each AI run debits it.

## 2. Target users

- **Primary:** marketers / founders at small businesses running their own
  outbound (solo workspaces are the default signup path).
- **Secondary:** small sales teams — multi-tenant workspaces with invites,
  roles (owner / member), ownership transfer, and workspace deletion.
- **Market note:** Flutterwave/M-Pesa checkout alongside Stripe signals a
  deliberate Africa-friendly payments strategy.

## 3. Core user journey (as built)

1. **Sign up** — email + password (with email verification) or Google
   sign-in. A solo workspace is provisioned with a free starter grant
   (~$3.50 of service value ≈ 5 research runs).
2. **Create a campaign** — 4-step wizard: name/goal, ICP (industry,
   geography, company size, target titles, keywords), free-form product
   context, and agent selection. Research auto-launches.
3. **AI workforce runs** — background jobs (non-blocking UI) populate the
   campaign with leads, scores, contacts, and drafted emails.
4. **Review & send** — the marketer reviews drafted outreach and sends via
   the platform's Resend account, optionally from their own verified
   sending domain.
5. **Top up** — when the wallet runs out, paid agents stop until the
   customer buys a credit package (Stripe card or Flutterwave M-Pesa/local
   cards).

## 4. The AI workforce (7 agents)

| Agent | What it does | Uses LLM credits |
|---|---|---|
| Research | Find companies matching the campaign ICP and add them as leads | Yes |
| Qualification | Score/qualify leads against the ICP & context | Yes |
| Contact Discovery | Find a likely decision-maker per lead company | Yes |
| Email Verification | Validate contact emails (pure heuristics) | No |
| Outreach | Draft personalised first-touch emails | Yes |
| Follow-up | Draft follow-ups for contacted leads with no reply | Yes |
| Reporting | Summarise campaign performance with recommendations | Yes |

Agents are campaign-scoped, run as async `AgentJob`s, and are registered in
a single `AGENTS` map (`src/lib/agents/index.ts`) so new agents are one
entry away.

## 5. Monetisation

- **Prepaid value wallet** (decided 2026-07-23). Balance is customer-facing
  *value* in micro-USD; each AI call debits raw token cost × 7 (the markup
  is baked in at purchase, so a $70 balance ≈ $10 of raw tokens, $60 margin).
- **Packages:** Starter $70 · Growth $210 (highlighted) · Scale $700.
- **Free grant:** $3.50 of value per new workspace to demonstrate value
  before asking for payment.
- **Payment rails:** Stripe (cards, sandbox) and Flutterwave (M-Pesa +
  local cards, sandbox); webhooks credit the wallet idempotently.

## 6. MVP scope

### Shipped (in `master`)
- Auth: credentials + Google OAuth, email verification, password reset.
- Multi-tenant workspaces: invites, member removal, ownership transfer,
  workspace deletion.
- Campaign CRUD + wizard, start/pause, industry catalogue.
- All 7 agents wired end-to-end with background jobs and per-org history.
- Wallet metering, usage events, top-up flows for both payment providers.
- Switchable LLM provider per workspace (Anthropic / DeepSeek) with
  automatic fallback to a working provider.
- Outreach sending via Resend, incl. per-workspace verified sending domain.
- Dashboard, Leads, Reports, Notifications, Billing, Settings pages.
- Security hardening: IDOR fixes, rate limits, wallet-race gating, hashed
  single-use tokens.

### Not yet built (gaps to a public launch)
- **Live payments** — both providers are in sandbox mode.
- **Real contact data** — contacts/emails come from LLM inference, not a
  data provider (Apollo/Hunter/Clearbit); accuracy is unverified.
- **Reply detection** — `Email.openedAt` / `repliedAt` exist in the schema
  but nothing ingests opens/replies (no webhook from the send provider).
- **Deliverability tooling** — no warm-up, throttling, or bounce handling.
- **Global rate limiting** — current limiter is per-instance in-memory;
  needs Redis/Upstash for real abuse protection.
- **DeepSeek billing accuracy** — pricing table is approximate and flagged
  in code as "verify before real customer billing".
- **Compliance** — no unsubscribe handling, GDPR/Kenya DPA data-subject
  flows, or sending-consent guardrails for cold outreach.

## 7. Success metrics (proposed)

- Activation: % of signups that run Research within 24h.
- Value: leads accepted (not deleted) per research run.
- Revenue: free→paid conversion after grant exhaustion; wallet top-up
  repeat rate.
- Quality: bounce rate of sent outreach; reply rate.
