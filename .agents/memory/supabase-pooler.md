---
name: Supabase pooler connections
description: Why the app rewrites Supabase session-pooler URLs to the transaction pooler
---

Rule: when connecting to `pooler.supabase.com`, use the transaction pooler (port 6543, `prepare: false`), not the session pooler (port 5432).

**Why:** The session pooler caps at ~15 clients; Next.js dev (multiple processes + HMR pools) hit `EMAXCONNSESSION` immediately. The runtime DB client auto-rewrites `:5432/` → `:6543/` for Supabase pooler hosts.

Also: the user's Supabase DB predates the current code — its drizzle migration journal is out of sync with the repo's `drizzle/` files. Use `npx drizzle-kit push --force` to sync schema (not `db:migrate`), then re-run `npm run db:seed` to restore hardening constraints that push drops (`wtx_amount_positive`, `wallets_balance_nonneg`).

**How to apply:** If DB connections start failing with max-clients errors, check which pooler port the connection string uses before debugging app code. The user's own database is wired via the `EXTERNAL_DATABASE_URL` secret; `DATABASE_URL` (Replit built-in) is only the fallback.
