# RecallFeed — Technology Decisions

This steering document records the verified technology choices, their rationale, and the constraints they impose on implementation. All decisions are final unless this document is explicitly updated.

---

## Runtime: Cloudflare Workers

RecallFeed's API layer runs as a Cloudflare Worker.

**Constraints enforced by the Workers runtime:**

| Limit | Free tier | Paid tier |
|---|---|---|
| CPU time per HTTP request | 10 ms | 30 s (configurable to 5 min) |
| CPU time per Cron Trigger | 10 ms | 30 s |
| Requests | 100,000/day | Unlimited |
| Subrequests per request | 50 | 10,000 |
| Memory | 128 MB | 128 MB |

CPU time measures active execution only, not I/O wait. A Neon database query that takes 200 ms wall clock consumes near-zero CPU time. This distinction is critical for free-tier compatibility.

**Implications for RecallFeed:**

- AI enrichment must always be asynchronous. Synchronous AI calls during a request will exceed the 10 ms CPU limit on the free tier.
- Markdown parsing must be lightweight, and the input is bounded: files larger than 100 KB are rejected. The bound limits the work per request but does not prove the free-tier 10 ms CPU limit is met. Local measurements (not Cloudflare billed CPU) put parsing and hashing 100 KB at roughly 4–8 ms elapsed and a whole local import request at roughly 5–11 ms of `workerd` process CPU, so the free tier is a real risk that only a deployed measurement can settle. See the Spec 03 checklist for the figures and their limits.
- Inngest workflows run on Inngest Cloud infrastructure, not inside the Worker. Only `inngest.send()` runs inside the Worker, which is a single HTTP subrequest consuming < 1 ms CPU.
- However, the Inngest serve handler at `/api/inngest` executes step functions inside the Worker when Inngest Cloud calls back. Those step executions are subject to Worker CPU limits.

**No filesystem access.** Markdown must be submitted via multipart upload or raw request body. GitHub repository imports are out of scope for the MVP.

---

## HTTP Framework: Hono

Hono is the HTTP framework for the Cloudflare Worker. It is purpose-built for edge runtimes with a minimal footprint.

The Worker entry point uses path-based routing to dispatch to Hono or the Inngest serve handler:

```ts
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/inngest")) {
      return inngestHandler(request, env, ctx);
    }
    return honoApp.fetch(request, env, ctx);
  }
};
```

The Inngest handler is kept outside Hono to avoid Hono middleware (including authentication middleware) running on Inngest callback requests. Inngest's own signing key validation protects the `/api/inngest` endpoint independently.

---

## Database: Neon PostgreSQL + Raw SQL

RecallFeed uses `@neondatabase/serverless` directly with tagged template literals. No ORM.

**Rationale:** The schema is small and well-defined. Raw SQL keeps the codebase legible for developers without ORM knowledge. Type safety is achieved through typed query wrapper functions in `packages/database/src/queries/`.

**Migration system:** Numbered `.sql` files in `packages/database/src/migrations/`. A `migrate.ts` script applies unapplied migrations using a `_schema_migrations` tracking table. Developers run `pnpm db:migrate` before local development and after pulling new migration files.

**Connection:** The Neon serverless driver uses HTTP for single queries and WebSocket for transactions. Both work inside Cloudflare Workers without `node_compat`.

---

## Workflow Orchestration: Inngest (optional)

Inngest SDK version: **`inngest@^4.26.2`** (v4, GA as of March 2026).

Inngest is optional. The Worker detects whether `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are configured. If absent, the synchronous processing path runs instead. No error is thrown.

**Environment binding injection — verified pattern (Inngest SDK v4):**

The Inngest SDK v4 creates a fresh middleware instance per request. Instance state is therefore request-scoped and concurrency-safe. This replaces the module-level `store.env` singleton used in older codebases.

```ts
class WorkersBindingsMiddleware extends Middleware.BaseMiddleware {
  id = "workers-bindings";
  private env!: Env;

  async wrapRequest({ next, requestArgs }: Middleware.WrapRequestArgs) {
    // requestArgs[1] is the Workers env — per-instance, safe
    this.env = requestArgs[1] as Env;
    return await next();
  }

  transformFunctionInput(args: Middleware.TransformFunctionInputArgs) {
    return { ...args, ctx: { ...args.ctx, env: this.env } };
  }
}
```

**Secrets must never appear in Inngest event payloads.** Event payloads are stored in Inngest Cloud's event log. Only non-sensitive identifiers and metadata belong in event data. Credentials are always read from `env` inside the function handler via the middleware above.

**Cron Trigger exception:** The Worker's `scheduled()` handler cannot use middleware-injected env because it runs outside an HTTP request. The `scheduled()` handler fires `inngest.send()` with only non-sensitive data. The triggered function reads credentials from `env` via middleware when Inngest Cloud calls the Worker's HTTP endpoint.

**Checkpointing:** Enabled by default in v4. Multiple steps execute within a single Worker request before checkpointing back to Inngest. This reduces round-trips but means a single Inngest callback can consume more Worker CPU than a single step. Design steps to be CPU-light individually.

**Local development:** The Inngest Dev Server is optional. Set `INNGEST_DEV=1` or `isDev: true` on the client to use it. For local development without Inngest, the synchronous fallback path handles small imports and feed generation.

---

## Deployment: Wrangler

Each application deploys its own independent Cloudflare Worker using Wrangler directly. SST is not used.

Each demo app has its own `wrangler.toml` that configures the Worker name, environment variables, and bindings. Secrets are stored via `wrangler secret put`. Local development uses `.dev.vars` (git-ignored).

---

## Authentication: Cloudflare Access + API Key

**Two authentication mechanisms:**

1. **Cloudflare Access** — for human browser access to private deployments. Configured at the Worker level in the Cloudflare dashboard or via the Access API. Provides `ctx.access.getIdentity()` inside the Worker with no JWT parsing code required. Free for up to 50 users.

2. **Static API Key (`X-API-Key` header)** — for programmatic/server-to-server access and protected write operations in public deployments. The key is stored as a Wrangler secret (`API_SECRET_KEY`). Never exposed in browser JavaScript.

**Inngest + Cloudflare Access coexistence:** When Cloudflare Access is enabled at the Worker level, it blocks all inbound requests — including Inngest Cloud callbacks. The solution is a **separate path-based Access application** scoped to exact path `/api/inngest` with a `Bypass + Everyone` policy. This allows Inngest Cloud to reach the endpoint while the rest of the Worker remains protected. Inngest's signing key validation (`INNGEST_SIGNING_KEY`) still runs inside the handler, providing cryptographic proof of origin.

**ReflectionFeed same-origin deployment:** Next.js application deployed via `@opennextjs/cloudflare` adapter as a single Worker. Frontend and API share the same domain (e.g., `reflection.example.com`). No cross-domain cookie forwarding required. Worker wrapper validates owner via `ctx.access.getIdentity()` before dispatching to OpenNext handler.

---

## Feed Visibility: `FEED_VISIBILITY` Environment Variable

This environment variable controls the authorization policy applied by the Worker.

| Value | Behavior |
|---|---|
| `private` (default) | All routes require authentication. Cloudflare Access recommended. |
| `public` | Anonymous read of published cards allowed. Writes require `X-API-Key`. |

A `is_published` boolean column on `feed_items` gates public read visibility. Setting `is_published = false` hides a card from anonymous visitors regardless of `FEED_VISIBILITY`. The feed engine never exposes raw source notes, import history, or credentials in any mode.

---

## AI Providers (optional)

Two adapters implementing a common `IAIProvider` interface:

1. **Cloudflare Workers AI** — uses the `AI` binding in `wrangler.toml`. No external API key needed. Available only inside the Worker.
2. **Anthropic Claude** — uses `ANTHROPIC_API_KEY` Wrangler secret. Optional.

AI enrichment always runs asynchronously via an Inngest step. It is never invoked synchronously during a feed request. Original notes are always preserved and remain accessible without AI processing.

---

## Frontend Frameworks

- **ReflectionFeed:** Next.js App Router + Tailwind CSS. Deployed via `@opennextjs/cloudflare` adapter as a single Worker (same-origin deployment).
- **DevRecall:** React + Vite + Tailwind CSS. Deployed to Cloudflare Pages (separate from API Worker).

Both consume `@recallfeed/client` for typed API access.

---

## Dependency Policy

- Pin all dependencies to exact or `^` minor-compatible versions. Avoid `*` and `latest` in package.json.
- Prefer packages with active maintenance and Cloudflare Workers compatibility.
- Minimize `packages/core` dependencies to zero at runtime — it must be a pure TypeScript package.
- Do not introduce new infrastructure services (queues, caches, storage) without updating this document and the relevant specifications.


---

## Repository Organization and Distribution

### Authoritative Monorepo

The **RecallFeed monorepo** at `~/Documents/projects/recallfeed` is the authoritative development and submission repository. It contains:

- Both demonstration applications under `apps/` (ReflectionFeed and DevRecall)
- All shared packages under `packages/`
- Committed `.kiro/` artifacts (specifications, steering, hooks)
- Workspace configuration (pnpm, Turborepo)

All development, testing, and iteration occur in this monorepo. This is the repository submitted for the Kiroween Hackathon.

### Two Applications, One Repository

The Skeleton Crew challenge requires two distinct applications backed by a shared foundation. This does not require separate GitHub repositories. The monorepo structure with `apps/reflection-feed/` and `apps/dev-recall/` satisfies this requirement:

- Separate folders
- Independent deployments (separate Workers, separate Neon databases)
- Different useful behavior (private vs public visibility, Next.js vs React+Vite)
- Same shared backend packages

###Standalone Application Repositories (Optional)

After completing the monorepo and demonstrating two working deployments, standalone application repositories may be created as an **optional distribution path**, not an MVP requirement.

If offered, each standalone repo:
- Consumes a specific version of shared RecallFeed packages (e.g., `@recallfeed/core@1.0.0`)
- Is an exported release, not a competing editable copy
- Must be demonstrated to work independently before claiming it as a standalone starter
- Remains authoritative in the monorepo; standalone repos are synchronized exports, not bidirectional mirrors

**No repository synchronization automation is required or authorized without separate approval and demonstrated need.**

### .kiro Artifacts

Cleaned, authoritative specifications and useful steering documents/hooks belong in the committed `.kiro/` directory at the repository root. This is a hackathon submission requirement. `.kiro/` must never be excluded via `.gitignore`.

**Note:** This policy documents the requirement that specifications will be committed; it does not authorize committing or publishing work in progress. Commit and publish operations require separate user authorization.
