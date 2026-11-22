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

This is **the one path from a clean clone to a feed on your screen**. The root README and `docs/setup.md` link
here instead of repeating it.

**You need** Node 22 and pnpm 10 (`package.json` pins the version; `.nvmrc` names the exact Node), Docker (for
example Colima), and an internet connection the first time, because `db.localtest.me` resolves to `127.0.0.1`
through public DNS.

### Which database each command uses

Two different things share one local PostgreSQL, and the commands below touch different ones.

| | What it is | Commands that use it |
|---|---|---|
| **The shared test fixture** | Two Docker containers: `recallfeed-test-postgres-1` (a disposable PostgreSQL, data in memory) and `recallfeed-test-neon-proxy-1` (a Neon-compatible proxy on port 4444). Their names and port are fixed, so **every checkout of this repository on your machine shares them**. The tests reset the database `recallfeed_test` inside it. | `db:test:up`, `db:test:down`, `test:integration` |
| **The starter's local database** | `recallfeed_starter`, a separate database inside the fixture's PostgreSQL. Only this app reads and writes it, and the tests never touch it. | `create database`, `db:migrate`, `pnpm dev`, `pnpm seed` |

Three rules follow from that:

- **Start the fixture once, and from one checkout.** `db:test:up` run from a *different* checkout recreates the
  containers, which wipes every database in them and can leave them unable to start (Docker cannot mount a path such
  as `/tmp` on macOS). If the two containers are already up, skip the start command: they work from any checkout.
- **Do not run `db:test:down` while anything else uses the fixture.** It discards all of its data, including
  `recallfeed_starter`.
- **This local database is for development only.** A deployment uses its own hosted database. See
  [`docs/setup.md`](../../docs/setup.md).

### Steps

```sh
git clone https://github.com/pauxiel/recallfeed.git && cd recallfeed
pnpm install --frozen-lockfile
```

**1. The shared test fixture.** Check whether it is already running. If this prints two lines starting with
`recallfeed-test`, skip the second command.

```sh
docker ps --format '{{.Names}}: {{.Status}}' | grep recallfeed-test
pnpm --filter @recallfeed/database db:test:up        # only if the line above printed nothing
```

**2. The starter's local database.** First check whether a database called `recallfeed_starter` already exists in
the fixture. The answer decides what you may do with it, now and at cleanup.

```sh
docker exec recallfeed-test-postgres-1 psql -U postgres -Atc "select count(*) from pg_database where datname = 'recallfeed_starter'"
```

- **It prints `0`: the name is unused.** Create the database and its tables. **You created it in this run, so it is yours
  and you may remove it at the end.** Migrate prints `applied  001_initial.sql`.

  ```sh
  docker exec recallfeed-test-postgres-1 psql -U postgres -c "create database recallfeed_starter"
  DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/recallfeed_starter pnpm --filter @recallfeed/database db:migrate
  ```

- **It prints `1`: a database with that name already exists.** Someone made it before this run: you in an earlier
  one, or another project. It may hold data you want, so **it is not yours and you must not remove it.** Pick one:
  - **Reuse it on purpose** (it was yours, from an earlier run). Skip `create database` and run only the `migrate` line
    above: it prints `skipped` if the tables are there. The seed then adds only cards that are missing.
  - **Use a new name instead,** for example `recallfeed_starter_2`. Run the check again with that name in place of
    `recallfeed_starter`, and when it prints `0`, create and migrate it with that name in both commands above. In step 3 you
    will put the same name in `.dev.vars`. That database is yours.

**3. This app's settings.** The example values work locally, and they point at `recallfeed_starter`. If you used a
different name in step 2, edit `DATABASE_URL` in the new `.dev.vars` so it ends with that name.

```sh
cp templates/starter/.dev.vars.example templates/starter/.dev.vars
```

**4. Start the app.** Leave it running. It serves http://127.0.0.1:8790.

```sh
pnpm --filter starter-app dev
```

**5. In a second terminal, load the sample notes.**

```sh
pnpm --filter starter-app seed          # imports 3 notes and publishes their 6 cards
```

**6. Open http://127.0.0.1:8790 in a browser.** You should see 6 cards: the 3 notes as `original` cards, and the
quotation and bold lines as `highlight` cards, ending with "end of feed". `curl http://127.0.0.1:8790/feed` returns the
same cards as JSON. Run the seed again and it creates nothing, because an import reports only the cards it created.

### Clean up (optional)

Stop the app first (Ctrl-C in the terminal running it). Then remove **only what this run created.**

- **Step 2 printed `0` and you created the database:** you may remove that one database.

  ```sh
  docker exec recallfeed-test-postgres-1 psql -U postgres -c "drop database recallfeed_starter"
  ```

  Use the name you created. It fails with "being accessed by other users" if the app or a seed is still connected,
  which is the safe outcome: stop them and run it again. Do not add `with (force)`.
- **Step 2 printed `1` and you reused the database:** leave it. This run did not create it, so this cleanup does not remove it.
  If you want it gone, that is a separate decision, made knowing what is in it.
- **Never use `db:test:down` to clean up.** It discards the whole fixture: databases you did not create, and the test data of
  every other checkout.
- `templates/starter/.dev.vars` is git-ignored and yours to delete.

### If something goes wrong

| You see | Cause and fix |
|---|---|
| `Cannot connect to the Docker daemon` | Docker is not running. Start it (for example `colima start`). |
| `migration failed: Control plane request failed` | The proxy outlived a recreated PostgreSQL. Restart only the proxy: `docker restart recallfeed-test-neon-proxy-1`. |
| `database "recallfeed_starter" already exists` | The check in step 2 was skipped. Follow its `1` branch: reuse the database on purpose, or use a new name. |
| `API_SECRET_KEY is not set` | Step 3 was skipped. |
| The page says "The feed could not be loaded" | The app is not running (step 4), or step 2 did not finish. |
| The page says "No published notes yet" | Run the seed (step 5). |

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
   (`@recallfeed/client`) is a typed way to call the API from one. The starter's page shows card text as plain text, so
   Markdown markers such as `**` appear as typed; `apps/dev-recall/src/content.ts` shows how to turn them into bold,
   code and code blocks without ever building HTML from a note.
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
