# Spec 05 — Authentication & Authorization

**Package:** `@recallfeed/api`
**Status:** Awaiting review
**Depends on:** `@recallfeed/core`

---

## Purpose

RecallFeed supports two deployment modes controlled by the `FEED_VISIBILITY` environment variable:

| Mode | Read Access | Write Access |
|---|---|---|
| `private` (default) | Requires Cloudflare Access authentication | Authenticated owner only |
| `public` | Anonymous users can read `isPublished = true` cards | Requires `X-API-Key` header |

All `/api/inngest` endpoints are protected by Inngest SDK signature verification.

---

## Hosting Topology

### ReflectionFeed (Private Mode)

**Deployment:** Next.js application deployed to Cloudflare Workers via `@opennextjs/cloudflare` adapter.

**Single Origin:** Frontend and API share one domain (e.g., `reflection.example.com`).

**Architecture:**
- Next.js pages and server components run inside the Worker
- API routes handled by shared Hono app from `@recallfeed/api`
- Inngest webhook at exact path `/api/inngest` handled by dedicated serve handler
- Cloudflare Access protects all routes except webhook path

**Benefits:**
- No cross-domain cookie forwarding required
- Authenticated identity available throughout request lifecycle
- Single Access application protects entire deployment
- SSR and API routes share authentication context

### DevRecall (Public Mode)

**Deployment:** React + Vite static site (Cloudflare Pages) with separate API Worker.

**Origins:**
- Frontend: `https://devrecall.example.com/` (Cloudflare Pages)
- API: `https://devrecall-api.example.workers.dev/` (Cloudflare Worker)

**Architecture:**
- React frontend makes anonymous API requests for published content
- Protected operations (import, publish, review) require `X-API-Key` header
- API key used from Node.js CLI or trusted server only, never in browser
- No Cloudflare Access protection on public Worker

---

## Cloudflare Access Configuration

### ReflectionFeed (Private Mode)

Cloudflare Access protects the Worker hostname while allowing Inngest webhook callbacks.

**Primary Access Application:**

Protects the entire Worker except the webhook path. Applied to custom domain and all alternate hostnames (workers.dev, preview URLs).

```json
{
  "name": "ReflectionFeed Private",
  "domain": "reflection.example.com",
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Owner Only",
      "decision": "allow",
      "include": [
        { "email": { "email": "owner@example.com" } }
      ]
    }
  ]
}
```

**Webhook Bypass Application:**

Separate Access application for the exact webhook path using documented hostname/path scoping.

```json
{
  "name": "ReflectionFeed Inngest Webhook Bypass",
  "domain": "reflection.example.com/api/inngest",
  "type": "self_hosted",
  "policies": [
    {
      "name": "Bypass for Inngest",
      "decision": "bypass",
      "include": [
        { "everyone": {} }
      ]
    }
  ]
}
```

**Key Requirements:**
- Webhook bypass uses `domain` field with hostname/path together: `"hostname/path"`
- Bypass decision allows Inngest Cloud to reach endpoint without Access authentication
- Inngest SDK signature verification via `INNGEST_SIGNING_KEY` is **mandatory** inside Worker handler
- Each hostname (custom domain, workers.dev, preview URLs) requires separate Access application

**References:**
- [Access Application API](https://developers.cloudflare.com/api/resources/zero_trust/subresources/access/subresources/applications/methods/create/)
- [Cloudflare Access Bypass Policy](https://developers.cloudflare.com/cloudflare-one/policies/access/#bypass)
- [Workers Access Integration](https://developers.cloudflare.com/workers/runtime-apis/bindings/access/)

### DevRecall (Public Mode)

- **No Cloudflare Access** — Worker is publicly accessible
- Protected write operations use `X-API-Key` header validation

---

## Worker Integration

### Environment Visibility Validation

```typescript
function normalizeVisibility(raw: string | undefined): "private" | "public" {
  // Fail closed: missing or invalid values become "private"
  if (!raw || (raw !== "private" && raw !== "public")) {
    return "private";
  }
  return raw;
}
```

**Behavior:**
- `FEED_VISIBILITY=private` → private mode
- `FEED_VISIBILITY=public` → public mode
- Unset, empty, or invalid → private mode (safe default)

### ReflectionFeed Worker (Private Mode with OpenNext)

Uses documented `@opennextjs/cloudflare` adapter with generated default handler and proper request-context initialization.

**File:** `apps/reflection-feed/worker.ts`

```typescript
import worker from "./.open-next/worker.js"; // Generated default export
import { createInngestHandler } from "@recallfeed/api/inngest/serve";
import { honoApp } from "@recallfeed/api/app";
import type { Env } from "./types";

function normalizeVisibility(raw: string | undefined): "private" | "public" {
  if (!raw || (raw !== "private" && raw !== "public")) {
    return "private";
  }
  return raw;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // Route 1: Inngest webhook (separate Access bypass application)
    if (url.pathname === "/api/inngest") {
      const inngestHandler = createInngestHandler(env);
      if (!inngestHandler) {
        return new Response("Inngest not configured", { status: 503 });
      }
      // Inngest SDK validates INNGEST_SIGNING_KEY inside handler
      return inngestHandler(request, env, ctx);
    }
    
    // Route 2: Owner authorization (for all non-webhook requests in private mode)
    const visibility = normalizeVisibility(env.FEED_VISIBILITY);
    
    if (visibility === "private") {
      const ownerEmail = env.OWNER_EMAIL;
      if (!ownerEmail) {
        return new Response("Private mode requires OWNER_EMAIL configuration", { status: 500 });
      }
      
      if (!ctx.access) {
        return new Response("Access authentication required but not configured", { status: 403 });
      }
      
      const identity = await ctx.access.getIdentity();
      if (!identity) {
        return new Response("Unauthenticated", { status: 401 });
      }
      
      if (!identity.email) {
        return new Response("Access identity missing email claim", { status: 403 });
      }
      
      if (identity.email !== ownerEmail) {
        return new Response(
          `Access denied: ${identity.email} is not the deployment owner`,
          { status: 403 }
        );
      }
    }
    
    // Route 3: API routes (/api/* except /api/inngest) go to shared Hono
    // Path mapping: Worker receives /api/feed, Hono expects /feed
    // Create new request with /api prefix stripped
    if (url.pathname.startsWith("/api/") && url.pathname !== "/api/inngest") {
      const strippedPath = url.pathname.replace(/^\/api/, "");
      const apiUrl = new URL(request.url);
      apiUrl.pathname = strippedPath || "/";
      
      const apiRequest = new Request(apiUrl, request);
      return honoApp.fetch(apiRequest, env, ctx);
    }
    
    // Route 4: All other routes (frontend pages) go to Next.js
    // OpenNext handler will initialize context where getCloudflareContext() works
    return worker.fetch(request, env, ctx);
  }
};
```

**Key Points:**
- Uses generated default export `worker` from `.open-next/worker.js`
- Route 1: `/api/inngest` → Inngest handler (bypasses owner check)
- Route 2: Owner authorization for all non-webhook requests in private mode
- Route 3: `/api/*` (except webhook) → Shared Hono app with /api prefix stripped
- Route 4: Everything else → Next.js frontend via `worker.fetch()`
- Owner authentication protects both API and Next.js pages/Server Actions
- /api path mapping: Worker receives `/api/feed`, strips to `/feed` for Hono
- Hono middleware reads identity from request context via `c.executionCtx`
- No process.env.accessEmail usage
- No HTTP self-calls to frontend routes

**Build Configuration:**

```json
{
  "scripts": {
    "build": "next build",
    "build:worker": "opennextjs-cloudflare build",
    "preview": "opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare deploy"
  },
  "dependencies": {
    "@opennextjs/cloudflare": "^1.20.0",
    "next": "^15.5.29"
  },
  "devDependencies": {
    "wrangler": "^4.148.0"
  }
}
```

**Build Process:**
1. `opennextjs-cloudflare build` — Internally invokes `next build` via the `build` script, then processes output to `.open-next/`
2. Custom wrapper imports `.open-next/worker.js` default export
3. Wrangler deploys the custom wrapper with generated handler

**Dependency Compatibility:**
- OpenNext 1.20.x requires Wrangler ^4.148.0 (peer dependency)
- OpenNext 1.20.x supports Next.js >=15.5.29 <16 or >=16.4.5
- Selected: Next.js ^15.5.29 to satisfy peer dependency minimum

**Wrangler Configuration (apps/reflection-feed/wrangler.jsonc):**

```jsonc
{
  "name": "reflection-feed",
  "main": "./worker.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./.open-next/assets",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  }
}
```

**Environment Variables:**
- `FEED_VISIBILITY=private` (set in Cloudflare dashboard or via `wrangler secret put`)
- `OWNER_EMAIL` (secret via `wrangler secret put`)
- `DATABASE_URL` (secret via `wrangler secret put`)
- `INNGEST_EVENT_KEY` (optional secret)
- `INNGEST_SIGNING_KEY` (optional secret)
- `ANTHROPIC_API_KEY` (optional secret)

**References:**
- [OpenNext Cloudflare Get Started](https://opennext.js.org/cloudflare/get-started)
- [OpenNext Cloudflare CLI](https://opennext.js.org/cloudflare/cli)
- [OpenNext Cloudflare Custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [Cloudflare Workers Static Assets Binding](https://developers.cloudflare.com/workers/static-assets/binding/)

### DevRecall Worker (Public Mode with Hono)

**File:** `apps/dev-recall/worker.ts`

```typescript
import { Hono } from "hono";
import { createInngestHandler } from "@recallfeed/api/inngest/serve";
import { requireApiKey, injectPublicRequestFlag } from "@recallfeed/api/middleware/auth";
import { feedRoutes } from "@recallfeed/api/routes/feed";
import { sourceRoutes } from "@recallfeed/api/routes/sources";
import type { Env } from "./types";

function normalizeVisibility(raw: string | undefined): "private" | "public" {
  if (!raw || (raw !== "private" && raw !== "public")) {
    return "private";
  }
  return raw;
}

const app = new Hono<{ Bindings: Env }>();

// Public read routes
app.get("/feed", injectPublicRequestFlag, ...feedRoutes.list);
app.get("/feed/:id", injectPublicRequestFlag, ...feedRoutes.get);

// Protected write routes
app.post("/sources", requireApiKey, ...sourceRoutes.create);
app.post("/sources/:id/import", requireApiKey, ...sourceRoutes.import);
app.post("/import/markdown", requireApiKey, ...feedRoutes.importMarkdown);
app.put("/feed/:id/review", requireApiKey, ...feedRoutes.review);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // Route 1: Inngest webhook
    if (url.pathname === "/api/inngest") {
      const inngestHandler = createInngestHandler(env);
      if (!inngestHandler) {
        return new Response("Inngest not configured", { status: 503 });
      }
      return inngestHandler(request, env, ctx);
    }
    
    // Route 2: Enforce public-only configuration
    const visibility = normalizeVisibility(env.FEED_VISIBILITY);
    if (visibility !== "public") {
      return new Response(
        "DevRecall Worker requires FEED_VISIBILITY=public (current: " + (env.FEED_VISIBILITY || "unset") + ")",
        { status: 500 }
      );
    }
    
    // Route 3: All other routes via Hono
    return app.fetch(request, env, ctx);
  }
};
```

---

## Hono Middleware

### Private Mode Authentication

```typescript
// packages/api/src/middleware/auth.ts
import { Context, Next } from "hono";
import type { Env } from "../types";

// Cloudflare Access identity type
interface Identity {
  email?: string;
  // Additional fields omitted for brevity
}

function normalizeVisibility(raw: string | undefined): "private" | "public" {
  if (!raw || (raw !== "private" && raw !== "public")) {
    return "private";
  }
  return raw;
}

/**
 * Middleware for private mode: validates authenticated owner from request context.
 * Used in ReflectionFeed where Worker pre-validates owner via Access before dispatch.
 * Reads identity from ExecutionContext to verify the owner authorization contract.
 */
export async function requireOwner(c: Context<{ Bindings: Env }>, next: Next) {
  const visibility = normalizeVisibility(c.env.FEED_VISIBILITY);
  
  if (visibility !== "private") {
    return next(); // Not in private mode
  }
  
  // Read identity from request ExecutionContext (passed by Worker)
  const ctx = c.executionCtx as ExecutionContext & { access?: { getIdentity: () => Promise<Identity | null> } };
  
  if (!ctx.access) {
    return c.json(
      { error: "Access context missing", code: "AUTH_REQUIRED" },
      500
    );
  }
  
  const identity = await ctx.access.getIdentity();
  
  if (!identity?.email) {
    return c.json(
      { error: "Authentication required", code: "AUTH_REQUIRED" },
      401
    );
  }
  
  // Owner validation already done by Worker; store for route handlers
  c.set("authenticatedEmail", identity.email);
  return next();
}
```

### Public Mode API Key Validation

```typescript
/**
 * Middleware for public mode write operations: requires X-API-Key header.
 */
export async function requireApiKey(c: Context<{ Bindings: Env }>, next: Next) {
  const visibility = normalizeVisibility(c.env.FEED_VISIBILITY);
  
  if (visibility === "private") {
    // In private mode, owner authentication already handled by Worker
    return next();
  }
  
  // Public mode: validate X-API-Key for write operations
  const secretKey = c.env.API_SECRET_KEY;
  if (!secretKey) {
    return c.json(
      { error: "API key authentication not configured", code: "AUTH_NOT_CONFIGURED" },
      500
    );
  }
  
  const providedKey = c.req.header("X-API-Key");
  if (!providedKey) {
    return c.json(
      { error: "X-API-Key header required", code: "AUTH_API_KEY_MISSING" },
      401
    );
  }
  
  if (providedKey !== secretKey) {
    return c.json(
      { error: "Invalid API key", code: "AUTH_API_KEY_INVALID" },
      403
    );
  }
  
  return next();
}
```

### Public Request Flag Injection

```typescript
/**
 * Middleware for public mode read routes: sets isPublicRequest flag.
 * Database queries use this flag to filter by isPublished=true.
 */
export async function injectPublicRequestFlag(c: Context<{ Bindings: Env }>, next: Next) {
  const visibility = normalizeVisibility(c.env.FEED_VISIBILITY);
  c.set("isPublicRequest", visibility === "public");
  return next();
}
```

---

## Next.js Server-Side Integration (ReflectionFeed Only)

In the same-origin deployment, Next.js server components run inside the initialized OpenNext context and can access request-local Cloudflare context.

### Reading Authentication in Server Components

```typescript
// app/page.tsx (Server Component)
import { getCloudflareContext } from "@opennextjs/cloudflare";

export default async function HomePage() {
  // Inside Next.js scope, read from initialized request context
  const cfContext = getCloudflareContext();
  
  // Access the original ctx.access from the Worker request
  // Note: This is request-local, not process-global
  const identity = await cfContext.ctx.access?.getIdentity();
  const email = identity?.email;
  
  if (!email) {
    return <div>Authentication required</div>;
  }
  
  return (
    <div>
      <h1>Welcome, {email}</h1>
    </div>
  );
}
```

### API Routes

Next.js `/app/api/*` routes are NOT used in ReflectionFeed. API requests are handled by the shared Hono app dispatched directly from the Worker wrapper.

**Route Map:**
- `/` → Next.js page (frontend)
- `/feed` → Next.js page (frontend feed view)
- `/api/feed` → Shared Hono API (JSON)
- `/api/sources` → Shared Hono API (JSON)
- `/api/inngest` → Inngest webhook handler

**Integration Pattern:**
- Worker wrapper validates owner before both Hono and Next.js dispatch (after webhook exception)
- Worker wrapper strips `/api` prefix before dispatching to Hono (receives `/api/feed`, sends `/feed`)
- Hono middleware reads identity from `c.executionCtx.access.getIdentity()` (request-local)
- Next.js pages for UI, Hono for JSON API
- No Next.js API route handlers, no HTTP self-calls

---

## Environment Variables

### ReflectionFeed (Private Mode)

```bash
# Required
FEED_VISIBILITY=private
OWNER_EMAIL=owner@example.com
DATABASE_URL=<secret>

# Optional Inngest
INNGEST_EVENT_KEY=<secret>
INNGEST_SIGNING_KEY=<secret>

# Optional AI
ANTHROPIC_API_KEY=<secret>
# AI_BINDING configured in wrangler.toml
```

### DevRecall (Public Mode)

```bash
# Required
FEED_VISIBILITY=public
API_SECRET_KEY=<secret>
DATABASE_URL=<secret>

# Optional Inngest
INNGEST_EVENT_KEY=<secret>
INNGEST_SIGNING_KEY=<secret>

# Optional AI
ANTHROPIC_API_KEY=<secret>
```

**Key Requirements:**
- `OWNER_EMAIL` is **required** in private mode; missing value returns 500
- `API_SECRET_KEY` is **required** in public mode for write operations
- Missing or invalid `FEED_VISIBILITY` defaults to `"private"` (fail closed)

---

## API Endpoints

### POST /import/markdown

**Purpose:** Import Markdown content and create feed items

**Authentication:**
- Private mode: `requireOwner` middleware
- Public mode: `requireApiKey` middleware

**Request:**
```
POST /import/markdown
Content-Type: text/markdown

[markdown content]
```

Or with metadata:
```
POST /import/markdown
Content-Type: application/json

{
  "content": "# My Note\n\nContent here",
  "name": "Optional source name"
}
```

**Request validation:**
- Min size: 10 bytes
- Max size: 100 KB
- Content-Type: `text/markdown` or `application/json`

**Response (200 OK):**
```json
{
  "sourceId": "uuid",
  "queued": false,
  "notesImported": 5,
  "feedItemsCreated": 5
}
```

**Error responses:**
- 400: Content too large, too small, or invalid format
- 401/403: Authentication failure
- 500: Import failure

---

### GET /feed

**Purpose:** Retrieve paginated feed items

**Authentication:**
- Private mode: `requireOwner` middleware
- Public mode: No authentication (returns published items only)

**Request:**
```
GET /feed?limit=10&cursor=eyJpZCI6Ii4uLiJ9
```

**Query parameters:**
- `limit` (optional): Page size, max 50, default from config
- `cursor` (optional): Opaque pagination cursor from previous response

**Response (200 OK) — Private Mode:**
```json
{
  "items": [
    {
      "id": "uuid",
      "noteId": "uuid",
      "cardType": "original",
      "content": "...",
      "isAiGenerated": false,
      "createdAt": "2026-11-07T12:00:00Z",
      "reviewCount": 3,
      "lastReviewedAt": "2026-11-07T12:00:00Z",
      "savedAt": null,
      "snoozedUntil": null
    }
  ],
  "nextCursor": "eyJpZCI6Ii4uLiJ9"
}
```

**Response (200 OK) — Public Mode:**
```json
{
  "items": [
    {
      "id": "uuid",
      "noteId": "uuid",
      "cardType": "original",
      "content": "...",
      "isAiGenerated": false,
      "createdAt": "2026-11-07T12:00:00Z"
    }
  ],
  "nextCursor": "eyJpZCI6Ii4uLiJ9"
}
```

**Filtering:**
- Private mode: Returns all feed items for authenticated owner
- Public mode: Returns only items where `isPublished = true`
- Both modes: Excludes items where `snoozedUntil > now`

**Public Mode Field Omissions:**
- `reviewCount`, `lastReviewedAt`, `savedAt`, `snoozedUntil` omitted
- `isPublished`, `sourceId`, `updatedAt` omitted

---

### GET /feed/:id

**Purpose:** Retrieve a single feed item by ID

**Authentication:**
- Private mode: `requireOwner` middleware
- Public mode: No authentication (returns published items only)

**Request:**
```
GET /feed/550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK) — Private Mode:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "noteId": "uuid",
  "sourceId": "uuid",
  "cardType": "summary",
  "content": "This is a summary of the note",
  "isAiGenerated": true,
  "isPublished": false,
  "reviewCount": 2,
  "lastReviewedAt": "2026-11-07T11:00:00Z",
  "savedAt": "2026-11-07T10:00:00Z",
  "snoozedUntil": null,
  "createdAt": "2026-11-07T09:00:00Z",
  "updatedAt": "2026-11-07T11:00:00Z"
}
```

**Response (200 OK) — Public Mode:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "noteId": "uuid",
  "cardType": "summary",
  "content": "This is a summary of the note",
  "isAiGenerated": true,
  "createdAt": "2026-11-07T09:00:00Z"
}
```

**Public Mode Filtering:**
- Returns only if `isPublished = true`
- Omits: `sourceId`, `isPublished`, `reviewCount`, `lastReviewedAt`, `savedAt`, `snoozedUntil`, `updatedAt`

**Error Responses:**
- 401: Authentication required (private mode, no identity)
- 403: Access denied (private mode, non-owner)
- 404: Feed item not found or not published (public mode)
- 500: Database error

---

### PUT /feed/:id/review

**Purpose:** Record a review action on a feed item

**Authentication:**
- Private mode: `requireOwner` middleware
- Public mode: `requireApiKey` middleware

**Request:**
```
PUT /feed/550e8400-e29b-41d4-a716-446655440000/review
Content-Type: application/json

{
  "action": "reviewed"
}
```

**Actions:**
- `reviewed`: Increment review count, update last reviewed timestamp
- `saved`: Set saved timestamp
- `unsaved`: Clear saved timestamp
- `snoozed`: Set snooze until timestamp (now + configured hours)
- `published`: Set isPublished = true
- `unpublished`: Set isPublished = false

**Response (200 OK):**
```json
{
  "id": "uuid",
  "reviewCount": 4,
  "lastReviewedAt": "2026-11-07T12:00:00Z",
  "savedAt": null,
  "snoozedUntil": null,
  "isPublished": false
}
```

**Error responses:**
- 400: Invalid action
- 401/403: Authentication failure
- 404: Feed item not found
- 500: Update failure

---

### POST /sources

**Purpose:** Create a new Notion source

**Authentication:**
- Private mode: `requireOwner` middleware
- Public mode: `requireApiKey` middleware

**Request:**
```
POST /sources
Content-Type: application/json

{
  "name": "My Notion Database",
  "type": "notion",
  "config": {
    "databaseId": "notion-database-id"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "My Notion Database",
  "type": "notion",
  "config": {
    "databaseId": "notion-database-id"
  },
  "isActive": true,
  "lastSyncedAt": null,
  "createdAt": "2026-11-07T12:00:00Z",
  "updatedAt": "2026-11-07T12:00:00Z"
}
```

**Error responses:**
- 400: Invalid source type or missing required config
- 401/403: Authentication failure
- 500: Creation failure

---

### POST /sources/:id/import

**Purpose:** Trigger import from a Notion source

**Authentication:**
- Private mode: `requireOwner` middleware
- Public mode: `requireApiKey` middleware

**Request:**
```
POST /sources/550e8400-e29b-41d4-a716-446655440000/import
```

**Response (202 Accepted):**
```json
{
  "sourceId": "uuid",
  "queued": true
}
```

Or (200 OK) if synchronous:
```json
{
  "sourceId": "uuid",
  "queued": false,
  "notesImported": 42,
  "feedItemsCreated": 42
}
```

**Error responses:**
- 401/403: Authentication failure
- 404: Source not found
- 500: Import failure

---

### POST /api/inngest

**Purpose:** Inngest webhook endpoint for async workflows

**Authentication:**
- Inngest SDK signature verification (`INNGEST_SIGNING_KEY`)
- Cloudflare Access bypass required (separate path-scoped application)

**Request:** Inngest SDK-generated webhook payload

**Response:** Per Inngest SDK specification

**Security:** This endpoint must be reachable by Inngest Cloud while other routes remain protected by Access. Use separate path-scoped Access application with bypass decision for exact `/api/inngest` path only.

---

## Public Mode Response Filtering

When `isPublicRequest = true`, the API must filter and sanitize responses:

**Database Query Filtering:**
- Only select rows where `isPublished = true`
- Handled by `getFeedItemCandidates()` and `getFeedItemById()`

**Response Sanitization:**
```typescript
// packages/api/src/middleware/response-filter.ts
import { FeedItem } from "@recallfeed/core";

export function sanitizeFeedItem(item: FeedItem, isPublicRequest: boolean): Partial<FeedItem> {
  if (!isPublicRequest) {
    return item; // Authenticated requests get full data
  }

  // Public requests: omit sensitive fields
  return {
    id: item.id,
    noteId: item.noteId,
    cardType: item.cardType,
    content: item.content,
    isAiGenerated: item.isAiGenerated,
    createdAt: item.createdAt
    // Omit: sourceId, isPublished, reviewCount, lastReviewedAt, savedAt, snoozedUntil, updatedAt
  };
}
```

---

## Acceptance Criteria

### Authentication and Owner Authorization
- [ ] ReflectionFeed uses single-origin deployment (frontend + API same domain)
- [ ] Worker uses documented `@opennextjs/cloudflare` adapter and generated handler
- [ ] Worker routes `/api/inngest` to Inngest handler (bypasses owner check)
- [ ] Worker validates owner authorization before both Hono and Next.js dispatch (after webhook exception)
- [ ] Worker validates `ctx.access` exists before calling `getIdentity()`
- [ ] Worker calls `ctx.access.getIdentity()` (async, returns Promise<Identity | null>)
- [ ] Private mode requires `OWNER_EMAIL` configuration (missing returns 500)
- [ ] Non-owner authenticated users receive 403 before reaching API, pages, or Server Actions
- [ ] Worker strips `/api` prefix before dispatching to Hono (receives `/api/feed`, sends `/feed`)
- [ ] Hono middleware reads identity from `c.executionCtx.access.getIdentity()` (request-local)
- [ ] Next.js components read identity via `getCloudflareContext().ctx.access.getIdentity()` (request-local)
- [ ] Server Actions verify owner identity or rely on Worker pre-validation
- [ ] No process.env.accessEmail usage (not request-local)
- [ ] No HTTP self-calls to frontend routes for API access
- [ ] Worker dispatch to Hono passes original `ctx` parameter via third argument

### Public Access and Publication
- [ ] DevRecall anonymous users read only `isPublished=true` cards
- [ ] DevRecall write operations require `X-API-Key` header
- [ ] API key never appears in browser bundles or storage
- [ ] Admin CLI reads key from local `.env` file

### Inngest Webhook
- [ ] `/api/inngest` exact path reachable by Inngest Cloud despite Access protection
- [ ] Inngest SDK signature verification enabled in production
- [ ] Webhook bypass uses separate Access application with `domain: "hostname/path"`
- [ ] Webhook requests do not require owner authentication
- [ ] Each hostname (custom, workers.dev, preview) requires separate Access configuration

### Security
- [ ] Visibility normalization with fail-closed default (unset/invalid → private)
- [ ] CSRF protection: mutation endpoints verify Origin header matches application domain
- [ ] Private responses include `Cache-Control: private, no-store` headers
- [ ] Next.js page rendering cached per-request only (not shared across users)
- [ ] Error messages don't leak private data, tokens, or stack traces
- [ ] Public responses omit sensitive fields via sanitization

### Shared Boundaries
- [ ] `FEED_VISIBILITY` controls read policy only
- [ ] Protected operations require authentication in both modes
- [ ] No application-name branches in shared packages
- [ ] Both apps reuse identical core and API implementation

---

## Static Validation

**Completed:**
- [x] JSON syntax validation of Access configuration examples
- [x] `domain` field uses documented hostname/path format
- [x] OpenNext integration cites official documentation
- [x] Request-local context pattern documented

**Deferred to Implementation:**
- [ ] Runtime verification of Access context availability
- [ ] Runtime verification of OpenNext identity propagation
- [ ] Runtime verification of webhook reachability
- [ ] Deployed Access configuration testing
