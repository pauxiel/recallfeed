# DevRecall

The public RecallFeed demo (Spec 09): a read-only feed of programming notes, code snippets and architecture
decisions, in a dark terminal-style theme. Visitors read published cards with no sign-in. Writes happen
only through the admin CLI or the seed script, on your machine.

It runs on the same shared packages as ReflectionFeed. Only the frontend (React + Vite + Tailwind, deployed
to Cloudflare Pages), the visibility (`public`), the default card types and strategy, the theme and the
sample content differ.

## Parts

| Part | What it is |
|---|---|
| `src/` | The React app. It reads the API with `@recallfeed/client`, **never with an API key**, and loads pages as you scroll (with a "Load more" fallback). |
| `wrangler.toml` | The API Worker for this deployment: the shared `packages/api` with DevRecall's variables. |
| `scripts/admin.ts` | The admin CLI: `import`, `review` and `list`, using the API key from your environment. |
| `scripts/seed.ts` | Imports `seed/*.md` straight into the database and publishes those cards. |
| `seed/` | The sample content. |

## Local demo

```sh
# 1. A local database (see packages/database/README.md), then its tables:
DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/<db> pnpm --filter @recallfeed/database db:migrate

# 2. Sample content, published:
DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/<db> pnpm --filter dev-recall seed

# 3. The API: put DATABASE_URL and API_SECRET_KEY in apps/dev-recall/.dev.vars (git-ignored), then
pnpm --filter dev-recall dev:api        # http://127.0.0.1:8788

# 4. The app:
pnpm --filter dev-recall dev            # http://127.0.0.1:5173
```

## Settings

- **Browser app (build time):** `VITE_API_URL`, the API's public address. It is the only variable the app
  reads, and it is not a secret. Unset means the local API above.
- **API Worker:** see `wrangler.toml`. Secrets are `DATABASE_URL` and `API_SECRET_KEY`.
  `CORS_ALLOWED_ORIGINS` must list the Pages address, or the browser blocks the app's reads.
- **Admin CLI:** `API_URL` and `API_SECRET_KEY`, from the environment or a git-ignored `.env` here.

## Security

- No API key reaches the browser: the app never creates a client with one (the client refuses to in a
  browser), and the built bundle contains no secret. Check with
  `grep -r "<your key>" dist` after a build.
- A public card carries six fields: `id`, `noteId`, `cardType`, `content`, `isAiGenerated`, `createdAt`.
- Note text is rendered as text, never as HTML.

## Known limits

- `summary` needs AI and `code_snippet` has no generator yet, so the configured card types produce
  `original` cards only for now.
- **The admin CLI cannot publish a card it just imported.** A public deployment's `GET /feed` lists published
  cards only, even with the API key, and the import response returns no card IDs, so there is no way to learn
  an unpublished card's ID through the API. `seed` publishes through the database instead. See the review
  request for the options.
