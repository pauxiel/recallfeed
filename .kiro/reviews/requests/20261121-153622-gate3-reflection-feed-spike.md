# RecallFeed Review Request: Gate 3 deployment spike (ReflectionFeed)

**Review Request ID:** recallfeed-20261121-153622-gate3-reflection-feed-spike
**Date:** 2026-11-21 15:36:22 UTC
**Workspace:** `/Users/paulobayuwana/.treehouse/recallfeed-38ad39/5/recallfeed`, branch `feat/gate3-reflection-feed-spike` (local only)
**Revision to review:** `ac315e8964094e3da609f22d8fb776f2b038984c`, based on `bdde8c3` (main)

## What to look at first

1. **`packages/api/src/access-token.ts`** (security). Cloudflare does not pass `ctx.access` to Workers with
   Static Assets (OpenNext), so this verifies `Cf-Access-Jwt-Assertion` with `jose`:
   - RS256 only, against the team's published keys;
   - `iss`, `aud`, a required `exp`, `nbf`, and an 8 KB cap;
   - then the owner email.

   Missing settings or unreachable keys fail closed with 500. `withAccessIdentity` hands the verified
   identity on as `ctx.access`. The API's authorization is unchanged. The user approved this design
   (option A), and the steering file and Spec 08 were updated first.
2. **`apps/reflection-feed/src/dispatch.ts`**: the Worker wrapper. Every request is checked before
   anything runs. `/api/*` goes to the shared Hono app with the prefix removed; everything else goes to Next.js.
3. **`apps/reflection-feed/worker.local.ts`**: the local-only entry, which acts as the owner. It refuses any
   non-localhost host and is never referenced by the production config.

## Evidence

- Tests: access token 37 (13 of 13 mutants caught), wrapper 14 (5 of 5 mutants caught).
- Full suite: **848 of 848**, none skipped; coverage 96.29/92.07/98.17/96.15. Lint, typecheck and build are clean.
- **Live:** https://reflection-feed.obayuwanap.workers.dev.
  - Without settings, every path returned 500.
  - With Access on, a signed-out visitor, including one sending a forged token, is redirected to the login.
  - The user confirmed in a browser: signed-in feed with the seeded cards; a private window blocked;
    *Mark reviewed* persisted across a reload.

## Limits

- Only the owner's browser path is verified live. There is no automated live test.
- The page is unstyled and has no save, snooze or import UI. DevRecall and the client package are not started.
- The CI result checker reports app tests as "(outside packages)". They are counted and checked.
- Not pushed. No CI run yet.

**Asked:** approve the Access-token design and the wrapper, or name changes.
