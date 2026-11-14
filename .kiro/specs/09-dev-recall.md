# Spec 09 — DevRecall (React + Vite Demo)

**Application:** `apps/dev-recall`
**Status:** Awaiting review
**Depends on:** `@recallfeed/api`, `@recallfeed/client`, `@recallfeed/core`

---

## Purpose

DevRecall is a public, shareable technical knowledge feed for developers. It demonstrates RecallFeed in `FEED_VISIBILITY=public` mode with a React + Vite frontend deployed to Cloudflare Pages.

---

## Deployment Configuration

- **Worker name:** `dev-recall-api`
- **Worker domain:** `dev-recall-api.yourzone.workers.dev` (or custom domain)
- **React app:** Deployed to Cloudflare Pages at `dev-recall.yourzone.pages.dev`
- **Database:** Separate Neon PostgreSQL instance (not shared with ReflectionFeed)
- **Authentication:** No Cloudflare Access. Public read, API key for writes.

### Environment Variables (`apps/dev-recall/wrangler.toml`)

```toml
name = "dev-recall-api"
main = "../../packages/api/src/index.ts"
compatibility_date = "2024-01-01"

[vars]
APP_NAME = "DevRecall"
FEED_VISIBILITY = "public"
DEFAULT_CARD_TYPES = "original,summary,code_snippet"
DEFAULT_RESURFACING_STRATEGY = "recency"
DEFAULT_PAGE_SIZE = "20"
SNOOZE_DEFAULT_HOURS = "168"  # 7 days

# Secrets (set via wrangler secret put):
# DATABASE_URL
# API_SECRET_KEY (required for write operations)
# NOTION_API_KEY (optional)
# ANTHROPIC_API_KEY (optional)
# INNGEST_EVENT_KEY (optional)
# INNGEST_SIGNING_KEY (optional)
```

### No Cloudflare Access

The Worker is publicly accessible. Write operations require `X-API-Key` header validation.

---

## Frontend Architecture

### Framework

React 18 + Vite + Tailwind CSS, deployed to Cloudflare Pages.

### Authentication

- **Public read:** The React app makes direct fetch requests to the Worker API without authentication. Only `isPublished = true` feed items are returned.
- **Admin write:** Admin operations (import, publish, manage sources) are **server-side only** and never exposed to the public React app.

### Admin Backend

DevRecall admin operations are handled by a **separate admin CLI tool** or a **protected admin API route** (not part of the public React app).

Two approaches:

#### Option 1: Admin CLI Tool (Recommended)

A Node.js CLI script that reads `API_SECRET_KEY` from a local `.env` file and makes authenticated requests to the Worker API.

```ts
// apps/dev-recall/scripts/admin.ts
import { Command } from "commander";
import dotenv from "dotenv";

dotenv.config();

const API_URL = process.env.WORKER_API_URL;
const API_KEY = process.env.API_SECRET_KEY;

const program = new Command();

program
  .command("import-markdown <file>")
  .action(async (filePath) => {
    const content = await fs.readFile(filePath, "utf-8");

    const response = await fetch(`${API_URL}/import/markdown`, {
      method: "POST",
      headers: {
        "Content-Type": "text/markdown",
        "X-API-Key": API_KEY!
      },
      body: content
    });

    if (!response.ok) {
      console.error("Import failed:", await response.text());
      process.exit(1);
    }

    const result = await response.json();
    console.log("Import successful:", result);
  });

program
  .command("publish <feedItemId>")
  .action(async (feedItemId) => {
    const response = await fetch(`${API_URL}/feed/${feedItemId}/review`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY!
      },
      body: JSON.stringify({ action: "published" })
    });

    if (!response.ok) {
      console.error("Publish failed:", await response.text());
      process.exit(1);
    }

    console.log("Feed item published");
  });

program.parse();
```

**Usage:**
```bash
pnpm admin import-markdown notes/backend-architecture.md
pnpm admin publish feed-item-uuid
```

**Security:** `API_SECRET_KEY` lives in the server-side `.env` file, never in the React app or browser.

#### Option 2: Protected Admin API Route (Next.js-based Admin Panel)

If the admin needs a web UI, create a separate Next.js app (or add a protected admin route) that:
1. Is protected by Cloudflare Access or basic auth.
2. Holds `API_SECRET_KEY` server-side only (Next.js environment variable).
3. Provides a web form for import/publish operations.
4. Forwards `X-API-Key` header in server-side fetch requests to the Worker.

**This approach requires a separate deployment.** The public React app remains unauthenticated.

---

## Public Frontend Features

### Feed View (`src/pages/Feed.tsx`)

- Displays published feed items (`isPublished = true`)
- Infinite scroll pagination via `nextCursor`
- No write actions (Review, Save, Snooze are admin-only)
- Direct fetch to Worker API without authentication

```ts
import { useEffect, useState } from "react";

export function Feed() {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    fetchFeed();
  }, []);

  async function fetchFeed() {
    const url = new URL("https://dev-recall-api.yourzone.workers.dev/feed");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url.toString());
    const data = await response.json();

    setItems((prev) => [...prev, ...data.items]);
    setCursor(data.nextCursor);
  }

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          <h2>{item.content}</h2>
          <p>{item.cardType}</p>
        </div>
      ))}
      {cursor && <button onClick={fetchFeed}>Load More</button>}
    </div>
  );
}
```

### Card Types

- **Original:** Raw code snippet or note
- **Summary:** AI-generated technical summary
- **Code Snippet:** Extracted code block with syntax highlighting

### No Admin UI in Public App

The public React app does not include:
- Markdown import form
- Publish/unpublish buttons
- Source management
- Review/save/snooze actions

These are handled by the admin CLI or a separate admin panel deployment.

---

## Sample Content

DevRecall seeds the database with:
- Programming notes on distributed systems
- Code snippets from real projects
- Architecture decision records (ADRs)
- Learning notes on Rust, TypeScript, Postgres

Sample seed script: `apps/dev-recall/scripts/seed.ts`

---

## Security Model

| Operation | Authentication | Allowed Clients |
|---|---|---|
| GET /feed | None | Anyone (only published items returned) |
| GET /feed/:id | None | Anyone (only if `isPublished = true`) |
| POST /import/markdown | `X-API-Key` header | Admin CLI or protected admin panel |
| POST /sources | `X-API-Key` header | Admin CLI or protected admin panel |
| PUT /feed/:id/review | `X-API-Key` header | Admin CLI or protected admin panel |

**Critical constraint:** `API_SECRET_KEY` must **never** be included in the React app build or exposed in browser-accessible JavaScript.

---

## Response Sanitization

When `isPublicRequest = true` (no `X-API-Key` header or invalid key), the Worker API sanitizes responses:

```ts
// Only these fields are exposed to public requests:
{
  id: string;
  noteId: string;
  cardType: CardType;
  content: string;
  isAiGenerated: boolean;
  createdAt: Date;
}

// Omitted fields:
// - reviewCount
// - lastReviewedAt
// - savedAt
// - snoozedUntil
// - isPublished
// - sourceId (if it could leak sensitive source names)
```

---

## Acceptance Criteria

- [ ] React app deploys to Cloudflare Pages successfully.
- [ ] Unauthenticated GET /feed requests return only `isPublished = true` items.
- [ ] Unauthenticated GET /feed requests return sanitized feed items (no review counts or dates).
- [ ] POST /import/markdown without `X-API-Key` header returns 401.
- [ ] POST /import/markdown with valid `X-API-Key` succeeds.
- [ ] Admin CLI tool reads `API_SECRET_KEY` from `.env` and makes authenticated requests.
- [ ] `API_SECRET_KEY` does not appear in React app build output or browser network requests.
- [ ] Public frontend displays feed items with infinite scroll pagination.
- [ ] No admin UI (import, publish buttons) is present in the public React app.
- [ ] Sample content seeds successfully on first deployment.
