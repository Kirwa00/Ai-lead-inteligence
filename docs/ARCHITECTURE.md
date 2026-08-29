# A1 Lead Intelligence — Architecture

> Reconstructed from the codebase (state as of commit `47a873f`, 2026-08-01).

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, MD3-style dark theme |
| Auth | NextAuth v5 (beta) — credentials + Google OAuth, JWT sessions |
| Database | PostgreSQL (Supabase in prod, Docker Postgres locally) via Prisma 7 + `@prisma/adapter-pg` |
| AI | Anthropic (default `claude-sonnet-5`) and DeepSeek (`deepseek-chat`), raw REST calls — no SDKs |
| Email | Resend (raw REST), platform account + per-workspace verified domains |
| Payments | Stripe (cards) + Flutterwave (M-Pesa, local cards), both sandbox |
| Tests | Vitest (unit tests co-located, `*.test.ts`) |
| CI | GitHub Actions: `npm ci && lint && test:coverage` on Node 22 |
| Hosting | Vercel (migrated from Netlify 2026-07-23); Node 22.x pinned |

## 2. Code layout

```
src/
  app/(auth)/        login, register, forgot/reset-password, verify-email
  app/(app)/         dashboard, campaigns, leads, research, workforce,
                     workflows, reports, notifications, billing, settings
  app/api/           REST route handlers (auth, campaigns, leads, agents,
                     billing, webhooks, team, wallet, sending-domain, ...)
  lib/agents/        the AI workforce (see §4)
  lib/               billing, wallet, packages, llm-provider, research,
                     email-sender, sending-domain, invites, team, tokens,
                     password, rate-limit, provisioning, prisma, ...
  components/        layout (Sidebar, TopBar, AuthShell) + ui widgets
  middleware.ts      JWT route protection (public-routes allowlist)
prisma/schema.prisma 20 models
```

## 3. Data model (Prisma, 20 models)

- **Tenancy:** `Organization` (workspace) ← `User`, `Invite`,
  `SendingDomain`. Everything cascades from Organization; users belong to
  exactly one org.
- **Billing:** `WalletTransaction` (append-only ledger),
  `UsageEvent` (one row per billed LLM call — metering source of truth),
  `Payment` (idempotent via `@@unique([provider, providerRef])`).
  Balances are micro-USD `BigInt` — no floats.
- **CRM:** `Campaign` → `Lead` → (`Company`, `Contact`, `LeadActivity`,
  `Email`). Companies/contacts are global and deduped by domain.
- **Agent runtime:** `AgentJob` (async run tracking; mapped to legacy
  `ResearchJob` table), plus older `AIAgent`/`AITask`/`Workflow` models.
- **Auth:** `VerificationToken` — SHA-256 hashed, single-use, expiring
  (password reset + email verify).
- **Misc:** `Report`, `Integration`, `ActivityLog`.

## 4. Agent framework

- Registry pattern: `AGENTS` map in `src/lib/agents/index.ts`; each entry is
  `{ label, description, run(ctx), usesLlm? }`. Adding an agent = one entry.
- `AgentContext` carries the campaign ICP, org, user, and LLM provider.
- Runs execute as background `AgentJob`s so the UI never blocks on ~20s LLM
  calls; jobs have staleness detection (`job-staleness.ts`) after Vercel
  timeout issues.
- LLM calls go through `callAgentJson` (`agents/shared.ts`): JSON-schema
  constrained output, provider switch (Anthropic/DeepSeek) per workspace,
  automatic fallback to a working provider, and clear errors for malformed
  API keys.
- Every billable call records a `UsageEvent` and debits the wallet
  (`debitForUsage`); Email Verification is heuristic-only and free.

## 5. Billing & metering flow

1. Customer buys a package → `Payment` (pending) → provider webhook →
   wallet credit (`WalletTransaction` type `topup`), idempotent per
   provider ref.
2. Agent run gated on `RESEARCH_RUN_RESERVE_MICROS` (worst-case run value)
   instead of `> 0` — bounds concurrent overspend to one run without a
   reservation system.
3. After each LLM call: raw token cost computed from `MODEL_PRICING`,
   multiplied by `USAGE_MARKUP_MULTIPLIER` (default 7), debited, and
   recorded as a `UsageEvent` linked to its `WalletTransaction`.
4. Unknown models bill at the most expensive (Opus) rate — never
   undercharge.

## 6. Auth & security decisions

- Middleware-level JWT protection with a single source of truth for public
  routes (`lib/public-routes.ts`, unit-tested).
- Auth config split (`auth.config.ts` vs `auth.ts`) for Edge-runtime
  compatibility in middleware.
- Tokens (reset/verify) stored only as SHA-256 hashes; raw token lives only
  in the sent email.
- IDOR fixes + org-scoping on all API routes; in-memory fixed-window rate
  limiter (per-instance; Redis noted as the upgrade path).
- System mail (invites, resets) deliberately sends from the platform
  address, never the customer's sending domain.

## 7. Environments & ops

- `.env.example` documents all config; `.env.docker` + `docker-compose.yml`
  give a local Postgres dev loop (`npm run dev:docker`, port 3003).
- `db:push` (no migration files) + `prisma/seed.js`; `scripts/` holds
  one-off ops (backfill-credits, check-users).
- Deployed at https://ai-lead-inteligence.vercel.app.

## 8. Known architectural debt

- `AIAgent`/`AITask`/`Workflow` models predate the `AGENTS` registry and
  overlap with `AgentJob` — candidates for consolidation.
- No migration history (schema managed via `db push`).
- In-memory rate limiting is per-serverless-instance only.
- Lead/contact data quality depends entirely on LLM knowledge — no
  external data-provider integration yet.
- Email opens/replies fields exist but nothing populates them.
