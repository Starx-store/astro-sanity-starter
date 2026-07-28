# Memory Index

- [Supabase pooler connections](supabase-pooler.md) — user's DB via EXTERNAL_DATABASE_URL secret; session pooler (5432) caps at 15 clients, runtime rewrites to transaction pooler (6543).
- [GitHub push mechanism](github-push.md) — gitPush/raw connector creds fail here; push via connectors-sdk proxy + Git Data API (~7 req/s, commit on top of remote head).
