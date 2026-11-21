# RecallFeed setup

> **Rough notes.** Written during the ReflectionFeed deployment spike (2026-11-20) from the steps that
> actually worked. They will be polished, and DevRecall's steps added, before submission.

## Prerequisites

- Node 22.13 or later, and pnpm 10 (`corepack enable`).
- `pnpm install` at the repository root.
- For local tests: Docker, for the disposable PostgreSQL and Neon-compatible proxy described in
  `packages/database/README.md`.

## Environment variables

| Variable | Where | Used by | Meaning |
|---|---|---|---|
| `DATABASE_URL` | secret | all | Neon connection string. Never committed or logged. |
| `FEED_VISIBILITY` | var | API | `private` (default, fail closed) or `public`. |
| `OWNER_EMAIL` | secret | private mode | The only email allowed in. |
| `API_SECRET_KEY` | secret | public mode | The `X-API-Key` that writes must send. |
| `ACCESS_TEAM_DOMAIN` | secret | ReflectionFeed | `https://<team-name>.cloudflareaccess.com`, with no trailing slash. |
| `ACCESS_AUD` | secret | ReflectionFeed | The AUD tag of the Access application protecting the Worker. |
| `DEFAULT_RESURFACING_STRATEGY` | var | API | `recency` (default) or `importance`. Anything else is a 500 on `GET /feed`. |
| `DEFAULT_CARD_TYPES` | var | API, apps | Card types an import creates, e.g. `original,highlight`. Unset means `original` only. Types without a generator are skipped; an unknown name is a 500. |
| `SNOOZE_DEFAULT_HOURS` | var | API | Whole number 1 to 8760, default 24. |
| `APP_NAME` | var | apps | Display name. |

`OWNER_EMAIL`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are stored as secrets, not committed vars, because they
identify one person's deployment. Until all of a private deployment's settings are present, every request
gets a generic 500.

## Deploy ReflectionFeed (private, Next.js, Cloudflare Access)

Each step below was run for the first deployment.

1. **Neon.** Create a project (Postgres 17; pick the region nearest you). Copy the **direct** connection
   string, without `-pooler` in the host: the migration keeps a session open.
2. **Migrate.** Enter these commands one at a time. If you paste them all at once, `read` swallows the next line:
   ```sh
   read -s "DATABASE_URL?Paste the Neon connection string: "
   export DATABASE_URL
   pnpm --filter @recallfeed/database db:migrate      # expect: applied 001_initial.sql
   ```
3. **Seed (optional).** With `DATABASE_URL` still exported: `pnpm --filter reflection-feed seed`, then `unset DATABASE_URL`.
4. **Cloudflare.** Turn on Zero Trust (free plan) and note the team name. In `apps/reflection-feed`, run
   `pnpm exec wrangler login`, then `pnpm build:worker && pnpm exec wrangler deploy`. The Worker refuses
   everything with a 500 until step 7.
5. **Secrets.** In `apps/reflection-feed`, run each of these and paste the value at the prompt:
   `pnpm exec wrangler secret put OWNER_EMAIL`, then `ACCESS_TEAM_DOMAIN`, then `DATABASE_URL`.
6. **Access.** Dashboard → Workers & Pages → `reflection-feed` → Access → *Protect this Worker behind
   Access* → All traffic → policy *Cloudflare account* (or an email rule for the owner). The default
   session of 24 hours is fine.
7. **AUD tag.** Zero Trust → Access → Applications → the new application → copy *Application Audience (AUD)
   Tag*, then `pnpm exec wrangler secret put ACCESS_AUD`.
8. **Check.** Signed in, the page shows "Signed in as <owner>". A private window stops at the Access login.

**Why the Worker checks the Access token itself:** Cloudflare does not pass `ctx.access` to a Worker with
Static Assets, and OpenNext always uses them. See `.kiro/steering/technology-decisions.md`.

**Do not enable Smart Placement** on this Worker. Users report that it drops the Access context.

## Local preview (ReflectionFeed)

1. Create a local database and migrate it: `DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/<db> pnpm --filter @recallfeed/database db:migrate`.
2. Create `apps/reflection-feed/.dev.vars` (git-ignored) with `DATABASE_URL=...` and `OWNER_EMAIL=...`.
3. Run `pnpm --filter reflection-feed preview:local` and open `http://127.0.0.1:8787`. The local entry acts as
   the owner, for localhost requests only. It is never deployed.

## Tests

`pnpm test:integration`, or what CI runs: `pnpm test:coverage` with `TEST_DATABASE_URL` set. Keep the lid
open during long runs: a closed lid sleeps the Mac and fails database tests.
