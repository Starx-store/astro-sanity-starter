---
name: GitHub push mechanism
description: How to push this repl's code to the user's GitHub repo (Starx-store/evo-store) — raw connector creds are withheld; use the SDK proxy + Git Data API.
---

# Pushing to GitHub from this repl

Repo: `Starx-store/evo-store` (private, default branch `main`). Origin remote is configured locally.

**The rule:** `gitPush`/`gitPull` callbacks fail with `NO_CREDENTIALS` ("No github-source-control credentials found") — the user's GitHub is linked via the *connector* OAuth, not Replit's Git-pane account link. Raw credential fetch (`listConnections('github')` and the `api/v2/connection?include_secrets=true` endpoint) persistently returns 0 items for this repl even after re-binding — credentials are withheld. The **only working path** is the `@replit/connectors-sdk` proxy (`connectors.proxy("github", path)`), which authenticates fine.

**Why:** Two accepted ProposeIntegration rounds + confirmed slug `github` did not change the withheld-credentials behavior; the SDK proxy worked immediately (verified by pushing a commit).

**How to apply:** To push, use the GitHub Git Data API through the proxy: upload missing blobs (local `git ls-files -s` sha == GitHub blob sha, so skip blobs that already exist), create a full tree, create a commit with parent = remote head (preserves their history, no force), PATCH the branch ref. Throttle to ~7 req/s — the proxy enforces 10 RPS per repl (429s) and occasionally throws transient 502s; retry both. Never let `.local-pg-data/` or `zipFile.zip` into a push (gitignored since July 2026; pg data holds real user rows/hashes).
