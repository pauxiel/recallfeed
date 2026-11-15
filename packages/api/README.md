# @recallfeed/api

The RecallFeed HTTP application: a Hono app and Cloudflare Worker entry point. Every deployment runs this
same code. Deployments differ by environment variables only, and nothing here branches on an application
name. Specification: [`.kiro/specs/05-authentication.md`](../../.kiro/specs/05-authentication.md).

## Scope (Gate 2, Phase 2)

Built: `POST /import/markdown`, `GET /feed`, `GET /feed/:id`, `PUT /feed/:id/review` (all six review and
publish actions), authorization, CSRF and cache policy, and the public response filter. Not built, and not
claimed: resurfacing strategies, cursor pagination, the Notion import, Inngest, and AI. `GET /feed` returns one page in a fixed order
(`COALESCE(last_reviewed_at, created_at)`, then `id`), and `?cursor=` is a 400, not ignored.

## Environment

| Variable | Kind | Meaning |
|---|---|---|
| `DATABASE_URL` | secret | Neon connection string. Required. Never logged. |
| `FEED_VISIBILITY` | var | Exactly `public` makes the deployment public. Anything else, including unset, is private. |
| `OWNER_EMAIL` | var or secret | Private mode: the only identity allowed. Compared case-insensitively and exactly. |
| `API_SECRET_KEY` | secret | Public mode: the key a write must send in `X-API-Key`. |
| `SNOOZE_DEFAULT_HOURS` | var, optional | Hours a `snoozed` action hides a card: a whole number from 1 to 8760. Unset means 24. A set but unusable value makes `snoozed` (only) fail with a generic 500. |

## Routes

| Route | Private deployment | Public deployment |
|---|---|---|
| `POST /import/markdown` | Owner (Cloudflare Access identity). Same-origin `Origin` required. | `X-API-Key`. |
| `GET /feed`, `GET /feed/:id` | Owner. | Anonymous. Published cards only, public fields only. |
| `PUT /feed/:id/review` | Owner. Same-origin `Origin` required. | `X-API-Key`. |

`POST /import/markdown` takes `text/markdown` (the body is the content) or `application/json`
(`{ "content": string, "name"?: string }`). It returns `{ sourceId, queued, notesImported, feedItemsCreated }`.
Content is 10 bytes to 100 KB of UTF-8. The `text/markdown` form always uses the default source; use JSON
with `name` to import into a named source. The body is read in bounded chunks and authorization is checked
before any of it is read.

`PUT /feed/:id/review` takes `application/json` of the form `{ "action": "<action>" }` (at most 1 KB) and
returns `{ id, reviewCount, lastReviewedAt, savedAt, snoozedUntil, isPublished }`, nothing more. The actions,
matched exactly and case-sensitively: `reviewed` (adds one to `reviewCount`, sets `lastReviewedAt`), `saved`
(sets `savedAt`), `unsaved` (clears it), `snoozed` (hides the card from every feed list for
`SNOOZE_DEFAULT_HOURS`, but not from `GET /feed/:id`), `published` and `unpublished` (set `isPublished`, the
only thing that makes a card visible to anonymous visitors). Fields other than `action` are ignored. Each
request changes the card and writes one `review_events` row in a single statement, so both happen or neither
does. An unknown action is `400 VALIDATION_REVIEW_ACTION`; an unknown or malformed card ID is
`404 NOT_FOUND_FEED_ITEM`. Repeating an action is allowed and logged again, so a repeated `reviewed` counts
again and the endpoint is not idempotent for that action. There is no separate publish endpoint.

Errors are `{ error, code }`. Notable codes: `AUTH_API_KEY_MISSING` (401), `AUTH_API_KEY_INVALID` (403),
`CSRF_ORIGIN_MISMATCH` and `CSRF_ORIGIN_MISSING` (403), `VALIDATION_SIZE`, `VALIDATION_LIMIT`,
`VALIDATION_CURSOR_UNSUPPORTED`, `VALIDATION_CONTENT_TYPE` (400), and `NOT_FOUND_FEED_ITEM` (404).
A public request gets the same 404 for a missing, malformed, and unpublished ID.

## Behaviors worth knowing

- **Private mode is not browser-only.** A script that writes to a private deployment must send an `Origin`
  header equal to the deployment's own origin. Without one the request is refused as a possible CSRF.
- **Identity cannot be supplied by a request.** The only source is `ctx.access.getIdentity()`. If a private
  deployment has no Access context or no `OWNER_EMAIL`, it fails closed with a generic 500.
- **Cache policy.** Private responses, errors included, carry `Cache-Control: private, no-store`. In public
  mode only non-GET responses are `no-store`.
- **Public redaction is an allow-list**: `id`, `noteId`, `cardType`, `content`, `isAiGenerated`, `createdAt`.
  A column added later stays private until someone adds it deliberately.

## Local development

`wrangler dev` has no Cloudflare Access, so the local configuration runs the public mode. Private mode is
covered by the tests, which supply an identity through the same `ctx.access` interface production reads.

1. Start the disposable database (see `packages/database/README.md`).
2. Create `packages/api/.dev.vars` (git-ignored):

   ```
   DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/recallfeed_test
   API_SECRET_KEY=any-local-value
   ```

3. `pnpm --filter @recallfeed/api dev:local`

`dev:local` enters through `src/dev-entry.ts`, which routes the exact host `db.localtest.me` to the local
proxy. The deployed entry, `src/index.ts`, never does, so a deployed Worker cannot be pointed at a local
proxy by configuration.

```sh
curl -X POST http://127.0.0.1:8787/import/markdown \
  -H 'Content-Type: application/json' -H 'X-API-Key: any-local-value' \
  -d '{"name":"demo","content":"# Title\n\nSome text worth remembering."}'
```

Imported cards are unpublished. There is no publish endpoint yet, so a public `GET /feed` shows a card only
after `is_published` is set in the database.

## Tests

`pnpm --filter @recallfeed/api test` runs inside `workerd`. Authorization, CSRF, and redaction tests need no
database. The import and feed tests run against the disposable PostgreSQL fixture when `TEST_DATABASE_URL`
is set and are skipped, and reported as skipped, when it is not.
