# RecallFeed — Project Conventions

This steering document defines the coding standards, naming conventions, file organization patterns, and development practices that apply across all packages and applications in the RecallFeed monorepo. Kiro must follow these conventions in every file it creates or modifies.

---

## Monorepo Structure

RecallFeed is a pnpm workspace monorepo managed with Turborepo.

```
recallfeed/
├── .kiro/           ← Kiro specifications, steering, and hooks (committed to git)
├── apps/
│   ├── reflection-feed/   ← Next.js private demo application
│   └── dev-recall/        ← React + Vite public demo application
├── packages/
│   ├── core/        ← Domain types and interfaces (no runtime dependencies)
│   ├── database/    ← Neon SQL client, queries, and migrations
│   ├── connectors/  ← Notion and Markdown connectors
│   ├── ai/          ← Optional AI provider adapters
│   ├── api/         ← Hono Worker (entry point for both demo deployments)
│   └── client/      ← Typed API client for frontend consumption
├── templates/
│   └── starter/     ← Minimal fork-and-deploy template
├── docs/            ← Setup, architecture, and API reference documentation
├── .github/
│   └── workflows/   ← CI and typecheck pipelines
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

Package names use the `@recallfeed/` scope:
- `@recallfeed/core`
- `@recallfeed/database`
- `@recallfeed/connectors`
- `@recallfeed/ai`
- `@recallfeed/api`
- `@recallfeed/client`

---

## TypeScript

- Use TypeScript strict mode (`"strict": true`) in all packages.
- Prefer explicit return types on exported functions.
- Use `type` for pure type aliases. Use `interface` only when declaration merging is needed.
- Avoid `any`. Use `unknown` with runtime narrowing when a type cannot be known statically.
- Do not use `!` non-null assertions except when the context genuinely guarantees non-null and the reason is documented in a comment.
- Export types from `index.ts` barrel files in each package.
- Target `ES2022` for all packages. Workers runtime supports it fully.

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | `kebab-case.ts` | `feed-engine.ts` |
| Directories | `kebab-case/` | `packages/connectors/` |
| Classes | `PascalCase` | `MarkdownConnector` |
| Interfaces | `PascalCase` prefixed with `I` | `IConnector`, `IResurfacingStrategy` |
| Types | `PascalCase` | `FeedItem`, `ReviewEvent` |
| Functions | `camelCase` | `generateFeedItems` |
| Constants | `SCREAMING_SNAKE_CASE` for module-level constants, `camelCase` for local | `DEFAULT_PAGE_SIZE` |
| Zod schemas | `camelCase` suffixed with `Schema` | `feedItemSchema` |
| Database tables | `snake_case` plural | `feed_items`, `review_events` |
| Database columns | `snake_case` | `created_at`, `source_id` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `FEED_VISIBILITY`, `DATABASE_URL` |

---

## Module Organization

Each package must have:
- `src/index.ts` — the public API barrel. Only symbols exported from here are considered public.
- `package.json` with `"main": "./src/index.ts"` for monorepo consumption (no build step required inside the monorepo during development).

Internal modules must not be imported directly by other packages. Only the barrel export is the stable contract.

---

## Error Handling

- Use explicit typed errors rather than throwing strings.
- Define a `RecallFeedError` base class in `@recallfeed/core` that all domain errors extend.
- Wrap external service calls (Neon, Notion API, Workers AI, Anthropic) in try/catch with structured error logging.
- API handlers must return structured JSON error responses: `{ error: string, code: string }`.
- Never expose internal stack traces, database errors, or credentials in API responses.
- Log errors with structured context: `{ error, source, operation, requestId }`.

---

## SQL Conventions

RecallFeed uses raw `@neondatabase/serverless` SQL — no ORM.

- All queries live in `packages/database/src/queries/`. Never write raw SQL in route handlers or business logic.
- Every query function accepts typed parameters and returns typed results.
- Use parameterized queries exclusively. Never interpolate user input into SQL strings.
- Keep query functions small and single-purpose.
- Migration files live in `packages/database/src/migrations/` and are numbered sequentially: `001_initial.sql`, `002_add_published_state.sql`.
- A `_schema_migrations` table tracks applied migrations. The `migrate.ts` script applies unapplied migrations in order.

---

## Security

- Never log credentials, API keys, tokens, or database URLs.
- Never include secrets in Inngest event payloads. Pass only non-sensitive identifiers (UUIDs, timestamps, flags).
- Never expose `API_SECRET_KEY`, `DATABASE_URL`, `INNGEST_SIGNING_KEY`, or any Wrangler secret in frontend bundles or browser-accessible JavaScript.
- Apply input validation and size limits on all user-controlled inputs before processing.
- Apply rate limiting or enforce reasonable payload size caps at the API boundary.
- All protected routes must validate authentication before executing any business logic.

---

## Testing

- Use Vitest for all unit and integration tests.
- Use `@cloudflare/vitest-plugin` to run tests inside the `workerd` runtime for packages that run in Workers.
- Test file naming: `*.test.ts` co-located with the module being tested, or in a `__tests__/` directory.
- Tests must not require live external services. Mock Neon, Notion API, Inngest, and AI providers.
- CPU-sensitive operations must include informational benchmark tests that log measured CPU time to help identify free-tier risk. These are not hard CI gates.

---

## .kiro Directory

The `.kiro/` directory must:
- Always be committed to the Git repository.
- Never appear in `.gitignore`.
- Contain the authoritative specifications, steering documents, and hooks for this project.
- Be kept up to date as the project evolves.

---

## Documentation

- All exported functions and types in public package APIs must have JSDoc comments.
- `wrangler.toml` files must include inline comments explaining non-obvious configuration values.
- Each `packages/*` directory must contain a brief `README.md` explaining its purpose and public API.
- `docs/setup.md` is the canonical developer onboarding document.

---

## Git

- Never commit secrets, `.env` files, `.dev.vars` files, or any file containing credentials.
- Never add `.kiro/` or any of its subdirectories to `.gitignore`.
- Commit messages use the imperative mood: `Add feed visibility middleware`, not `Added` or `Adding`.
- Branch names: `feat/`, `fix/`, `docs/`, `chore/` prefixes.


---

## Source File Length Policy

RecallFeed enforces a maximum file length to maintain readability and encourage modular design.

### ESLint max-lines Rule

- **Rule:** `max-lines` set to maximum **1,000 physical lines** per handwritten JavaScript/TypeScript source file
- **Counting:** Includes blank lines and comments (do not enable options that exclude them)
- **Exclusions:** Generated output, `node_modules/`, lockfiles (`package-lock.json`, `pnpm-lock.yaml`)
- **Scope:** Applies to handwritten JS/TS source files only, not to Markdown specifications or documentation
- **Enforcement:** Local lint command and CI pipeline from first implementation milestone

### Rationale

The 1,000-line ceiling is a maintainability boundary, not a target. Files should be split by responsibility (parsing, card selection, authorization, persistence) rather than arbitrary line counts. Do not compress formatting or remove documentation to pass the limit.

### Configuration Example

```json
{
  "rules": {
    "max-lines": ["error", {
      "max": 1000,
      "skipBlankLines": false,
      "skipComments": false
    }]
  }
}
```

### Handling Exceptions

If a file legitimately exceeds 1,000 lines:
1. First attempt to split by responsibility (e.g., separate route definitions, middleware, validation)
2. If splitting is not feasible, document the reason in a comment
3. Request explicit reviewed exception rather than disabling the rule

**Implementation:** Configure during authorized Gate 2 work, not before specification approval.
