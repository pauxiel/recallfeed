# RecallFeed status update: Nov 22 work merged, DevRecall started

**Review Request ID:** recallfeed-20261121-180810-status-devrecall-start
**Date:** 2026-11-21 18:08:10 UTC
**Type:** status update. No verdict is needed. The one thing to read is the "Open points" section.
**Workspace:** `/Users/paulobayuwana/.treehouse/recallfeed-38ad39/7/recallfeed`, branch `feat/gate3-dev-recall` (local only)
**Base:** `6d8e2a2f501e4625184935f14ca6609827cee768` (`main`)

## Where things stand

- **Merged since the last update:**
  - PR #7 was approved by the user and merged to `main` as `6d8e2a2f501e4625184935f14ca6609827cee768`, with a
    merge commit and no squash or force.
  - It brings highlight cards into normal imports (`DEFAULT_CARD_TYPES`) and the `@recallfeed/client` package.
  - PR CI (run 44928988616) and main CI (run 44931579845) both passed: 889 of 889 tests, none skipped.
- **On `main` now:** the shared API, feed engine, database, connectors and client packages, and the
  ReflectionFeed app (deployed earlier as the spike; the live copy still runs the spike version).
- **Started today:** DevRecall, the public React + Vite app (Spec 09), on a new branch from `main`.

## What I am doing now (DevRecall, step by step)

1. **Records:** correct the stale "not pushed" lines in `tasks/todo.md` (this branch's first commit).
2. **`apps/dev-recall`:** a Vite + React app that reads a public feed through `@recallfeed/client` (its first
   consumer), with load-more pagination and no admin or write UI. `API_SECRET_KEY` never enters the browser bundle.
3. **Admin CLI** (`scripts/admin.ts`, Spec 09 option 1): import and publish through the client, with the key
   read from the environment on the server side.
4. **Different from ReflectionFeed:** a distinct Tailwind theme, programming sample content, and
   `FEED_VISIBILITY=public`, `DEFAULT_RESURFACING_STRATEGY=recency`, `DEFAULT_CARD_TYPES=original,summary,code_snippet`.
5. **Local demo first,** against a separate local database. Nothing is deployed until the user approves it.

## Open points

- **`code_snippet` and `summary` cards do not exist yet.** DevRecall's configured types resolve to `original`
  only, because `code_snippet` has no generator and `summary` needs AI. The user's plan is to build the
  `code_snippet` generator (first fenced code block, no AI) only after both apps work.
- **The public cursor discloses** a card's effective time and, under `importance`, its `reviewCount`.
  DevRecall uses `recency`, so only the effective time is disclosed. This was accepted at the Phase 4 review.
- **CI time is rising:** the test step took about 11 minutes on `main`, up from about 6 before Phase 4.
  There is no action yet. I will fix only a file that actually times out.
- **Needed from the user for the live DevRecall:** a second Neon project, a second Cloudflare Worker, and a
  Cloudflare Pages project, plus approval to deploy.

## Not authorized

Deploying, re-seeding, cleanup, Phase 5, merging anything.
