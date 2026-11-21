# RecallFeed

**A reusable skeleton for personal knowledge feeds.** Import your notes, turn them into cards, and have them come
back in an order you choose, so what you read stays with you. One shared backend, two very different apps built on
top of it.

Built for the **Kiroween hackathon, Skeleton Crew category**: a framework skeleton that two distinct applications
share, with the `.kiro/` specs, steering and hooks that guided the build kept in the repository.

## Live demos

| App | What it is | Address |
|---|---|---|
| **DevRecall** | A public, read-only feed of programming notes, code snippets and architecture decisions. Anyone can read it. | https://dev-recall.pages.dev |
| **ReflectionFeed** | A private feed for sermon notes, book highlights and personal reflections. Only its owner can sign in, so it cannot be opened without that login. | behind Cloudflare Access |

## What is built, and what is not

| Built and working | Planned, not built yet |
|---|---|
| Markdown import (idempotent: a repeat import changes nothing) | Notion connector |
| Two card types: `original` and `highlight` | `summary` and `reflection_prompt` (need AI), `code_snippet` |
| Two orderings: `recency` and `importance`, with stable cursor pagination | Inngest workflows, AI enrichment |
| Review actions: reviewed, saved and unsaved, snoozed, published and unpublished | Source management endpoints |
| Public and private deployments from the same code | A starter template for a third app |
| A typed client, a public read-only app, and a private app | |

## How it fits together

```
 DevRecall (public)                          ReflectionFeed (private)

 Browser                                     Browser
   |                                           |  Cloudflare Access login
   v                                           v
 React + Vite (Cloudflare Pages)             One Worker (Cloudflare)
   |  @recallfeed/client, no key               |  1. checks the Access token and the owner
   v                                           |  2. runs the Next.js app (OpenNext)
 API Worker (Cloudflare)                       |     and the API app
   |                                           v
   v                                         Neon database B
 Neon database A

 Both run the same packages: core, database, connectors, feed-engine, api
```

Both apps run the **same API app** (`packages/api/src/app.ts`). They differ by configuration and by their front
door: DevRecall's Worker runs the shared entry point directly, and ReflectionFeed adds an Access-token check in front
of the same app, because Cloudflare does not give a Worker with static assets the signed-in identity.

### The packages (`packages/`)

| Package | Purpose |
|---|---|
| `core` | Domain types, interfaces and errors. No dependencies. |
| `database` | Raw SQL for Neon (no ORM), migrations, and the test database. |
| `connectors` | Turns Markdown into notes. |
| `feed-engine` | Import, card generation, orderings, cursor pagination, review actions. |
| `api` | The Hono HTTP app, authorization, CORS, and the Access-token check. |
| `client` | A typed client for the API, for frontends and scripts. |

**The rule that makes it a skeleton:** the packages never import from the apps. Delete either app and nothing under
`packages/` changes. A hook checks this every time a file in `packages/` is saved.

### The apps (`apps/`)

| | **DevRecall** | **ReflectionFeed** |
|---|---|---|
| Visibility | `public`: anyone reads published cards | `private`: only the owner |
| Frontend | React + Vite + Tailwind, on Cloudflare Pages | Next.js (App Router), on Cloudflare Workers |
| Who can write | Whoever holds the API key, from an admin CLI | The signed-in owner |
| Ordering | `recency` | `importance` |
| Database | Its own Neon project | Its own Neon project |
| Look | Dark, terminal style | Plain serif (a design pass is still to come) |
| Sample content | Programming notes, snippets, ADRs | Sermons, book highlights, reflections |

## Security model

- **Fail closed.** An unset or misspelled `FEED_VISIBILITY` means private.
- **Public reads** return published cards only, built from an allow-list of six fields, so a column added later stays
  private until someone adds it on purpose.
- **Private deployments** accept only the owner. The Worker verifies the Cloudflare Access token itself (signature,
  issuer, audience, expiry) and the API trusts only that verified identity. A valid API key does not open them.
- **The API key never reaches a browser.** The client refuses to be created with one in a browser, the API never
  answers a browser's permission check for it, and the deploy steps check the built files for it.
- **Writes** in private mode also need a same-site request, which blocks forged requests from other sites.
- **Known, accepted trade-off:** a public pagination cursor reveals one card's last-seen time per page, and its review
  count under the `importance` order. Cursors are not encrypted.

## Run it

```sh
pnpm install --frozen-lockfile        # Node 22 and pnpm 10 (see package.json)
pnpm lint && pnpm typecheck && pnpm build
```

The database-backed tests need a disposable PostgreSQL behind a Neon-compatible proxy, which runs in Docker:

```sh
pnpm --filter @recallfeed/database db:test:up
pnpm test:integration                  # every package; read the skipped count, it should be 0
pnpm --filter @recallfeed/database db:test:down
```

To try an app locally, see [`apps/dev-recall/README.md`](apps/dev-recall/README.md). To deploy, follow
[`docs/setup.md`](docs/setup.md), which records the steps that were actually run (still rough notes).

## Built with Kiro

The `.kiro/` folder is part of the project, not an afterthought:

- **Specs** (`.kiro/specs/`): nine written before the code, from the domain model to both apps, and updated when a
  decision changed (for example, how ReflectionFeed verifies identity).
- **Steering** (`.kiro/steering/`): the technology decisions, the Skeleton Crew rules, and the project conventions
  that every change is held to.
- **Hooks** (`.kiro/hooks/`): after each save in `packages/`, a boundary check runs against the Skeleton Crew rules.
  Another hook keeps `.kiro/` from being ignored by git.
- **Review requests** (`.kiro/reviews/requests/`): each milestone was written up with its evidence and sent to a
  separate review agent before it moved on.
- **Task records** (`tasks/todo.md`): what was planned, what was verified and how, including the failures.

Every change ran lint, typecheck, build and the full test suite (over 900 tests against a real PostgreSQL), and the
security-critical code was also checked by planting bugs in it to confirm the tests catch them.

## Where to read next

| | |
|---|---|
| Architecture decisions | [`.kiro/steering/technology-decisions.md`](.kiro/steering/technology-decisions.md) |
| The skeleton rules | [`.kiro/steering/skeleton-crew-rules.md`](.kiro/steering/skeleton-crew-rules.md) |
| The specs | [`.kiro/specs/`](.kiro/specs/) |
| Deploying | [`docs/setup.md`](docs/setup.md) |
| Working agreement | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Each package | `packages/*/README.md` |

## License

MIT. See [`LICENSE`](LICENSE).
