# RecallFeed starter

The smallest app that runs on the shared RecallFeed packages: **a config file, a static page and a seed
script**. It has no custom Worker code and changes nothing under `packages/`. It exists to show that a third app
can be built from the same skeleton as DevRecall and ReflectionFeed.

## What is in it

| File | What it does |
|---|---|
| `wrangler.toml` | Runs the shared API Worker (`packages/api/src/index.ts`) with this app's settings: visibility, ordering and card types. |
| `public/` | The page. `index.html`, `app.js` and `style.css` read `/feed` from the same address and draw it. `_headers` adds a strict Content-Security-Policy. |
| `scripts/seed.ts` | Imports `seed/*.md` through `@recallfeed/client` and publishes the new cards. |
| `wrangler.local.toml` | The same Worker, entered so that it reaches the local test database. For `pnpm dev` only. |

The page and the seed script talk to the API over HTTP, so you can replace `public/` with any frontend and the
backend does not notice.

## Run it

You need Node 22, pnpm 10 and Docker. From the repository root:

```sh
pnpm install --frozen-lockfile

# 1. A local database (a disposable PostgreSQL and a Neon-compatible proxy), and an empty database in it.
pnpm --filter @recallfeed/database db:test:up
docker exec recallfeed-test-postgres-1 psql -U postgres -c "create database recallfeed_starter"

# 2. Its tables.
DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/recallfeed_starter pnpm --filter @recallfeed/database db:migrate

# 3. This app's settings. The example values work locally.
cp templates/starter/.dev.vars.example templates/starter/.dev.vars

# 4. Start the app. Leave it running.
pnpm --filter starter-app dev
```

In a second terminal, load the sample notes and open the page:

```sh
pnpm --filter starter-app seed          # imports 3 notes and publishes their cards
open http://127.0.0.1:8790              # the feed
```

You should see the sample cards, and `curl http://127.0.0.1:8790/feed` returns them as JSON. Run the seed
again and it creates nothing, because an import reports only the cards it created.

## Make it yours

1. **Copy it.** `cp -r templates/starter apps/my-app`. The paths in `wrangler.toml` work from either place, because both
   sit two levels below the repository root. Then change `name` in `package.json` and `wrangler.toml`, and run
   `pnpm install` once so the workspace sees it.
2. **Choose its behavior in `wrangler.toml`:**
   - `FEED_VISIBILITY`: `public` (anyone reads published cards) or `private` (see `apps/reflection-feed` for how the
     owner is checked).
   - `DEFAULT_RESURFACING_STRATEGY`: `recency` or `importance`.
   - `DEFAULT_CARD_TYPES`: which cards an import creates.
3. **Replace the page.** Edit `public/`, or swap it for a React, Vite or Next.js frontend. The `client` package
   (`@recallfeed/client`) is a typed way to call the API from one.
4. **Add your notes** as Markdown in `seed/`, and run `pnpm seed`.

## Deploy it

Follow the DevRecall steps in [`docs/setup.md`](../../docs/setup.md), minus the Pages project: this app's page ships inside
the same Worker. In short: a Neon project, `pnpm --filter @recallfeed/database db:migrate`, `pnpm exec wrangler deploy`,
then `wrangler secret put DATABASE_URL` and `API_SECRET_KEY`, and set `API_URL` to the Worker's address to seed it.

## What the starter leaves out

- **Sign-in for a private feed.** Public is the default here. A private deployment needs Cloudflare Access and the token
  check that `apps/reflection-feed` shows.
- **Card types that need AI** (`summary`, `reflection_prompt`) and `code_snippet`, which do not exist yet.
- **A Notion connector.** Markdown is the only source today.
