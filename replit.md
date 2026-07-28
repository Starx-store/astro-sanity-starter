# Evo Store

## Overview
Arabic (RTL) digital products storefront with dark mode, internal wallet with append-only ledger, products/orders, Binance Pay, provider auto-fulfillment, support tickets, and admin dashboard.

**Stack:** Next.js 15 (App Router, React 19) + TypeScript + Tailwind CSS + Drizzle ORM + PostgreSQL

Note: upgraded from Next 14 → 15 (July 2026) for security CVEs. Request APIs (`cookies()`, `headers()`) are async now; `getLocale()`, `getRequestIp()`, and `enforceRateLimit()` are async — always `await` them (a missed await on `enforceRateLimit` silently disables rate limiting). TS build errors are intentionally ignored (`typescript.ignoreBuildErrors`); validation is via Zod.

## Running on Replit
- Workflow "Start application" runs `npm run dev -- -p 5000 -H 0.0.0.0` (Next.js dev server on port 5000).
- Database: the user's own Supabase database via the `EXTERNAL_DATABASE_URL` secret (takes priority over the built-in `DATABASE_URL` in `src/server/db/index.ts`, `seed.ts`, and `drizzle.config.ts`). Session-pooler URLs (port 5432) are auto-rewritten to the transaction pooler (6543) at runtime to avoid the 15-connection cap.
- `SESSION_SECRET` is set as a Replit secret.
- Schema applied via `npm run db:migrate`; seed (DB hardening triggers + admin + categories) via `npm run db:seed`.
- Default admin: `admin@evo.store` / `Admin12345` (change via `SEED_ADMIN_*` env vars).

## Optional env vars (not set)
- `BINANCE_PAY_API_KEY` / `BINANCE_PAY_API_SECRET` — automatic deposits via Binance Pay
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google login
- `CRON_SECRET` — protects `/api/cron/poll-providers`
- `PROVIDER_ENCRYPTION_KEY` — independent key for provider secrets (derived from SESSION_SECRET if unset)

## Project structure
- `src/app/` — pages: `(auth)`, `account/`, `admin/`, `products/`, `support/`, `api/`
- `src/server/` — domain logic: `auth/`, `db/` (schema, seed, hardening SQL), `wallet/`, `orders/`, `validation/`
- `src/components/` — UI components by domain
- `src/middleware.ts` — `/admin` protection + maintenance mode

## User preferences
- User communicates in Arabic.
