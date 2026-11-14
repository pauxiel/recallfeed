# RecallFeed — Skeleton Crew Rules

This steering document defines and enforces the boundary discipline required by the Kiroween Hackathon **Skeleton Crew** category. RecallFeed must be a reusable, frontend-agnostic framework skeleton — not a single application. Two distinct demonstration applications must be built from the same shared foundation.

Kiro must verify these rules before completing any implementation task.

---

## The Core Principle

The shared packages (`@recallfeed/core`, `@recallfeed/database`, `@recallfeed/connectors`, `@recallfeed/ai`, `@recallfeed/api`, `@recallfeed/client`) must have **zero knowledge** of `reflection-feed` or `dev-recall`.

Removing either demo application from the repository must not require changing any file in `packages/`.

---

## Dependency Direction

Dependencies flow in one direction only:

```
apps/reflection-feed  →  packages/*
apps/dev-recall       →  packages/*
packages/api          →  packages/core, packages/database, packages/connectors, packages/ai
packages/connectors   →  packages/core
packages/ai           →  packages/core
packages/database     →  packages/core
packages/client       →  packages/core
```

**Forbidden dependency directions:**

- `packages/*` must never import from `apps/*`
- `packages/core` must never import from any other `packages/*`
- `packages/database` must never import from `packages/connectors`, `packages/ai`, or `packages/api`

---

## What Must Be Shared

Both demo applications must reuse, without modification:

1. **The same `@recallfeed/core` domain types** — `Source`, `Note`, `FeedItem`, `ReviewEvent`, `FeedConfig`, and all interface definitions.
2. **The same `@recallfeed/database` schema and migration files** — both applications use identical table definitions with separate Neon database instances.
3. **The same `@recallfeed/api` Worker code** — both deploy the same Hono application and Inngest integration. Application behavior is differentiated by environment variables only.
4. **The same `@recallfeed/connectors`** — Markdown and Notion connectors are shared. Neither app ships its own connector.
5. **The same `@recallfeed/client`** — the typed fetch wrapper is consumed identically by both frontends.

---

## What Must Be Different

To prove versatility, the two applications must have meaningfully distinct:

1. **Frontend framework** — ReflectionFeed uses Next.js App Router; DevRecall uses React + Vite.
2. **Feed visibility** — ReflectionFeed deploys with `FEED_VISIBILITY=private`; DevRecall deploys with `FEED_VISIBILITY=public`.
3. **Default feed configuration** — different default card types, resurfacing strategies, and content categories.
4. **Visual design** — distinct Tailwind theme, typography, and color palette.
5. **Sample content** — ReflectionFeed seeds sermons, book highlights, personal reflections; DevRecall seeds programming notes, code snippets, architecture concepts.
6. **Cloudflare Worker name and Neon database** — each has its own independently deployed Worker and database.

---

## Application Differentiation via Environment Variables

Application-specific behavior is controlled entirely through environment variables on the deployed Worker. No application-specific code lives in `packages/api`.

| Variable | ReflectionFeed | DevRecall |
|---|---|---|
| `FEED_VISIBILITY` | `private` | `public` |
| `APP_NAME` | `ReflectionFeed` | `DevRecall` |
| `DEFAULT_CARD_TYPES` | `original,highlight,reflection_prompt` | `original,summary,code_snippet` |
| `DEFAULT_RESURFACING_STRATEGY` | `importance` | `recency` |

The `packages/api` Worker reads these variables and applies the appropriate behavior. It contains no `if (APP_NAME === "DevRecall")` branching — only generic configuration-driven logic.

---

## How to Prove the Skeleton at Demonstration Time

The judges must be able to verify:

1. **Single source of truth:** `packages/api/src/index.ts` is identical for both deployments. Show the file once, show both `wrangler.toml` files to demonstrate divergence is configuration only.

2. **Two live URLs:** One publicly accessible DevRecall feed and one ReflectionFeed instance demonstrating authenticated access.

3. **Shared schema:** Show that `packages/database/src/migrations/` contains a single set of migration files used by both databases.

4. **Different frontends, same client:** Show that `apps/reflection-feed` and `apps/dev-recall` both import from `@recallfeed/client` but have completely different UI implementations.

5. **Extensibility proof:** The `templates/starter/` directory provides a minimal clone-and-configure template that a new developer can use to create a third application from the same skeleton.

---

## Checklist for Every Implementation Task

Before marking any task complete, verify:

- [ ] No `packages/*` file imports anything from `apps/*`
- [ ] No `packages/core` file imports anything from other `packages/*`
- [ ] Application-specific strings or logic have not been hardcoded into `packages/api`
- [ ] Any new environment variable is documented in `docs/setup.md` and in the relevant `wrangler.toml` comments
- [ ] The change would work correctly for both demo applications without modification to shared packages

---

## .kiro Directory Commitment

The `.kiro/` directory is part of the skeleton, not just documentation. It must:

- Be committed to the repository root.
- Never appear in `.gitignore`.
- Demonstrate meaningful usage of Kiro specifications, steering documents, and hooks as part of the hackathon submission.
- Show the development process: specs written before code, updated as decisions change.
