# Spec 08 — ReflectionFeed (Next.js Demo)

**Application:** `apps/reflection-feed`
**Status:** Awaiting review. Authentication design and versions updated 2026-11-20 (deployment spike).
**Depends on:** `@recallfeed/api`, `@recallfeed/feed-engine`, `@recallfeed/database`, `@recallfeed/core` (`@recallfeed/client` is for browser or external callers; server code calls the shared packages directly)

---

## Purpose

ReflectionFeed is a private, authenticated personal knowledge feed for spiritual reflection. It demonstrates RecallFeed in `FEED_VISIBILITY=private` mode with Cloudflare Access authentication and a Next.js App Router frontend.

---

## Deployment Configuration

**Architecture:** Same-origin deployment using `@opennextjs/cloudflare` adapter.

- **Single domain:** `reflection.example.com` (serves both frontend and API)
- **Deployment:** Next.js application deployed as Cloudflare Worker via OpenNext
- **Database:** Separate Neon PostgreSQL instance (not shared with DevRecall)
- **Authentication:** Cloudflare Access with single-user policy (owner's email)

### Wrangler Configuration (`apps/reflection-feed/wrangler.jsonc`)

```jsonc
{
  "name": "reflection-feed",
  "main": "./worker.ts",
  "compatibility_date": "2026-10-01",
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

### Environment Variables

**Configured via Cloudflare dashboard or `wrangler secret put`:**

```bash
# Required
FEED_VISIBILITY=private
OWNER_EMAIL=you@example.com
ACCESS_TEAM_DOMAIN=https://<your-team-name>.cloudflareaccess.com
ACCESS_AUD=<the Access application's AUD tag>
DATABASE_URL=<secret>

# Optional
NOTION_API_KEY=<secret>
ANTHROPIC_API_KEY=<secret>
INNGEST_EVENT_KEY=<secret>
INNGEST_SIGNING_KEY=<secret>
```

### Cloudflare Access Policy

1. **Main Application:**
   - **Domain:** `reflection.example.com`
   - **Policy:** One Login + Email is `you@example.com`
   - **Scope:** Entire hostname (frontend and API)

2. **Inngest Webhook Bypass:**
   - **Domain:** `reflection.example.com/api/inngest`
   - **Policy:** Bypass + Everyone
   - **Note:** Separate Access application scoped to exact webhook path

---

## Frontend Architecture

### Framework

Next.js 16 with App Router (16.4.5 or later, the range `@opennextjs/cloudflare` 1.20 supports), deployed via `@opennextjs/cloudflare` adapter as a single Worker.

### Authentication Flow

1. User visits `reflection.example.com`.
2. Cloudflare Access intercepts, redirects to identity provider.
3. After authentication, Access sets `CF_Authorization` cookie and adds a signed `Cf-Access-Jwt-Assertion` header to every request it lets through.
4. The Worker wrapper verifies that header (signature against `<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, `iss`, `aud` = `ACCESS_AUD`, `exp`, `nbf`) and checks the email equals `OWNER_EMAIL`. A missing or invalid token is 401; a valid token for another email is 403; missing configuration is a generic 500. All of this happens before any dispatch.
5. Worker routes `/api/*` (except `/api/inngest`) to shared Hono app, with the `/api` prefix removed.
6. Worker routes all other paths to Next.js via generated `worker.fetch()`.
7. Both receive an execution context whose `access.getIdentity()` returns the verified identity, so the shared API's authorization and Next.js (`getCloudflareContext().ctx.access.getIdentity()`) read it the same way, per request.

**Why the token is verified in code (2026-11-20):** OpenNext deploys with Static Assets, and Cloudflare's documentation states that `ctx.access` is not passed to a Worker with Static Assets. See the technology decisions steering document.

**Same-Origin Benefits:**
- No cross-domain cookie forwarding required
- Single Access application protects entire deployment
- Direct in-process API dispatch (no HTTP self-calls)
- Authenticated context available throughout request lifecycle

### Client-Side vs Server-Side

- **Read operations (GET /feed):** Next.js server components fetch from shared API via direct function calls (no HTTP).
- **Write operations (POST /import/markdown, PUT /feed/:id/review):** Next.js server actions call shared business logic directly.
- **JSON API (GET /api/feed):** Served by shared Hono app at `/api/*` paths for external/programmatic access.

**No browser-held API keys.** All operations authenticated via Cloudflare Access owner validation in Worker wrapper.

---

## Admin Features

ReflectionFeed includes admin functionality for:
- Importing Markdown files
- Publishing/unpublishing feed items
- Managing sources

**Authentication for admin operations:**
- All admin operations run server-side (Server Components or Server Actions).
- Identity read via `getCloudflareContext().ctx.access.getIdentity()` inside Next.js scope.
- Owner validation performed in Worker wrapper before dispatch.
- No `X-API-Key` required (owner authenticated via Access).

**No `X-API-Key` in browser JavaScript.** The frontend never holds or transmits `API_SECRET_KEY`.

### Example: Markdown Import Server Action

```ts
// app/admin/actions.ts
"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@recallfeed/database";
import { FeedEngine } from "@recallfeed/feed-engine";

export async function importMarkdownAction(formData: FormData) {
  // The Worker wrapper has already verified the Access token and the owner;
  // this re-check fails closed if the action is ever reached another way.
  const cfContext = getCloudflareContext();
  const identity = await cfContext.ctx.access?.getIdentity();
  
  if (!identity?.email) {
    throw new Error("Unauthorized");
  }
  
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No file provided");
  }
  
  const content = await file.text();
  
  // Call shared business logic directly (no HTTP)
  const engine = new FeedEngine(createDb(cfContext.env.DATABASE_URL));
  return engine.importMarkdown(content, { name: file.name });
}
```

---

## UI Components

### Feed View (`app/feed/page.tsx`)

- Displays feed items in card format
- Supports pagination via `nextCursor`
- Actions: Review, Save, Snooze
- All data fetched server-side

### Admin Panel (`app/admin/page.tsx`)

- Markdown file upload form
- Source management (add Notion database)
- Publish/unpublish feed items
- All mutations via server-side Server Actions

### Card Types

- **Original:** Raw note content
- **Highlight:** Extracted quote or code block
- **Reflection Prompt:** AI-generated question for spiritual reflection

---

## Sample Content

ReflectionFeed seeds the database with:
- Sermon notes from sample services
- Book highlights from spiritual reading
- Personal reflection journal entries

Sample seed script: `apps/reflection-feed/scripts/seed.ts`

---

## Acceptance Criteria

- [ ] Next.js app deploys as single Worker via `@opennextjs/cloudflare` adapter.
- [ ] Worker wrapper verifies the `Cf-Access-Jwt-Assertion` token (signature, `iss`, `aud`, `exp`, `nbf`) and checks the owner before both Hono and Next.js dispatch (after webhook exception). Missing configuration fails closed.
- [ ] Worker wrapper strips `/api` prefix before dispatching to Hono.
- [ ] Unauthenticated requests receive 401 or redirect to Access login.
- [ ] Authenticated non-owner requests receive 403 before reaching pages or Server Actions.
- [ ] Next.js components read identity via `getCloudflareContext().ctx.access.getIdentity()` (request-local).
- [ ] Server Actions verify owner identity or rely on Worker pre-validation.
- [ ] No process.env.accessEmail usage.
- [ ] No HTTP self-calls to frontend routes for API access.
- [ ] Markdown import works via Server Action calling shared business logic directly.
- [ ] No `API_SECRET_KEY` or `X-API-Key` appears in browser JavaScript or network requests.
- [ ] All write operations are authenticated via Cloudflare Access only.
- [ ] Feed items display correctly with Review, Save, and Snooze actions.
- [ ] Admin panel allows publishing/unpublishing feed items.
- [ ] Sample content seeds successfully on first deployment.
