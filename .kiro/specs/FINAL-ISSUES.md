# RecallFeed Final Issue-to-File-and-Line Checklist

**Date:** November 7, 2026
**All specifications:** Awaiting review

---

## 1. Duplicate Specification Files (BLOCKER)

| Spec # | Approved Original | Superseding Draft | Status | Action |
|---|---|---|---|---|
| **03** | `03-connector-interface.md` (12:08) | `03-connectors.md` (12:27) | ❌ Conflicting | Merge, delete old |
| **05** | `05-api-contract.md` (12:10) | `05-authentication.md` (12:29) | ❌ Conflicting | Merge, delete old |
| **08** | `08-reflection-feed-app.md` (12:11) | `08-reflection-feed.md` (12:30) | ❌ Conflicting | Merge, delete old |
| **09** | `09-dev-recall-app.md` (12:12) | `09-dev-recall.md` (12:31) | ❌ Conflicting | Merge, delete old |

**Action required:** Create single authoritative spec for each, retaining approved content + corrections. Delete superseded files.

---

## 2. Authentication: Missing-Secret and Invalid-Header Cases

### File: `05-authentication.md` (Lines updated, verification needed)

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~55-85 | `requireAccess`: missing check for undefined `ctx.access` | ✅ Fixed | Added explicit `if (!accessContext)` check |
| ~90-115 | `requireApiKey`: comparison when `API_SECRET_KEY` undefined | ✅ Fixed | Added `if (!secretKey)` guard before comparison |
| ~120-135 | `injectPublicRequestFlag`: invalid `FEED_VISIBILITY` values | ✅ Fixed | Added validation, defaults to "private" |
| ~180-200 | Feed route: no double-check of `isPublished` | ✅ Fixed | Added explicit filter before sanitization |

### File: `04-feed-engine.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~85-110 | `getFeed`: trusts `isPublicRequest` without auth context verification | ⚠️ Partially fixed | Database query filters by `isPublished`, but engine doesn't validate caller's auth |

**Remaining uncertainty:** Should `GetFeedOptions` include an authenticated identity context, or rely solely on `isPublicRequest` flag + route middleware?

---

## 3. AI Provider Objects and Credentials in Inngest Step Results

### File: `06-inngest-workflows.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~135-155 | `enrichNotesFunction`: "initialize-ai" step returned provider object | ✅ Fixed | Provider instantiated inline per-step, not serialized |
| ~100-130 | `ingestSourceFunction`: no error sanitization for note content | ✅ Fixed | Added try/catch with sanitized error logging |
| ~160-200 | `enrichNotesFunction`: no error sanitization | ✅ Fixed | Added try/catch, no note content in logs |

**Verification needed:** Check if `getAIProvider()` function itself returns objects with embedded credentials. If so, document that provider instances must not be serialized.

---

## 4. Content-Bearing Markdown Import Contract

### 4a. Core Domain Type

**File:** `01-core-domain.md`

| Line | Issue | Status | Notes |
|---|---|---|---|
| ~15-30 | `Source.transientContent` field missing | ✅ Fixed | Added with documentation on lifecycle |
| ~2 | Status: "Approved" | ✅ Fixed | Changed to "Awaiting review" |

### 4b. Connector Contract

**File:** `03-connectors.md` (newer version)

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~45-65 | `MarkdownConnector.import`: throws error if `transientContent` undefined | ⚠️ Documented | Error message states connector requirement, but doesn't explain when this occurs |
| ~30-50 | Content source explanation incomplete | ⚠️ Needs expansion | Should document: "API layer must set this field before import; reloading from DB loses it" |

**File:** `03-connector-interface.md` (original approved version)

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~60-74 | Describes `source.config.content` (transient field) | ❌ Superseded | Newer spec uses `source.transientContent` instead |

**Action required:** Merge both 03 files, clarify that transientContent is the authoritative pattern.

### 4c. Feed Engine Import Flow

**File:** `04-feed-engine.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~25-50 | `importSource` Markdown path: states "content is in transientContent" without explaining how | ⚠️ Incomplete | Should reference API contract that sets it |
| ~35-45 | Markdown synchronous-only execution documented | ✅ Fixed | Clear statement added |

### 4d. API Endpoint Specification (MISSING)

**File:** `05-api-contract.md` (original)

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| Entire file | Contains API endpoint specs | ❌ Needs merge | Must be merged with `05-authentication.md` |

**File:** `05-authentication.md` (newer)

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| Missing | No `POST /import/markdown` endpoint spec | ❌ Missing | Must document request body, content-type, transientContent population, flow |

**Required documentation for POST /import/markdown:**

```markdown
### POST /import/markdown

**Authentication:**
- Private mode: `requireAccess`
- Public mode: `requireApiKey`

**Request:**
- Content-Type: `text/markdown` or `multipart/form-data`
- Body: Raw markdown content (max 100 KB)

**Flow:**
1. Parse request body to extract content string
2. Validate content size (10 bytes min, 100 KB max)
3. Create or update Source record with type: "markdown"
4. Set `source.transientContent = content` (in-memory only, not persisted)
5. Call `feedEngine.importSource(source.id)`
6. Return `{ queued: false, notesImported: N, feedItemsCreated: M }`

**Error responses:**
- 400: Content too large or too small
- 401/403: Authentication failure
- 500: Import failure

**Critical:** `transientContent` is never persisted to database. Reloading source by ID will not recover this content. Markdown import cannot proceed asynchronously via Inngest.
```

---

## 5. Access Identity Propagation into Hono (UNCERTAINTY)

### File: `05-authentication.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~200-280 | "How Cloudflare Access Works in Workers" | ⚠️ Documented uncertainty | Three possible approaches listed, NONE VERIFIED |
| ~55-85 | `requireAccess` reads `c.get("access")` | ⚠️ Mechanism unclear | How does identity get into Hono context? |

**CRITICAL UNCERTAINTY:** The spec now documents three hypothetical approaches but does not identify which one Cloudflare actually supports:

1. **Approach 1:** `request.cf.access` injection (unverified)
2. **Approach 2:** Manual JWT parsing from `CF_Authorization` cookie
3. **Approach 3:** Cloudflare Workers Access SDK (unknown if exists)

**Action required before implementation:** Verify actual Cloudflare Access + Workers integration mechanism via:
- Cloudflare Workers Access documentation
- Test deployment
- Cloudflare developer support

### File: `08-reflection-feed.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~50-80 | Authentication flow: cookie forwarding from Next.js | ⚠️ Documented | Explains cookie forwarding but not initial acquisition |
| ~25-35 | Deployment: "Next.js app deployed to Pages" | ⚠️ Incomplete | Should document `@cloudflare/next-on-pages` adapter requirement |

**Missing documentation:**
- How Access sets `CF_Authorization` cookie initially (redirect flow)
- `SameSite=None; Secure` requirement for cross-domain
- Next.js build adapter configuration

---

## 6. Placeholder AI Cards Blocking Enrichment

### File: `04-feed-engine.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~180-210 | `generateCardContent`: returns placeholder strings for AI types | ❌ BLOCKER | Creates feed items with `"[Summary will be generated]"`, prevents enrichment |
| ~155-175 | `generateFeedItems`: N+1 query pattern | ⚠️ Performance issue | Documented below |

**Problem:** Synchronous import calls `generateFeedItems`, which creates feed items for all enabled card types including AI types. For AI types, it inserts placeholder text. Later, `enrichNotesFunction` checks if feed item exists (`getFeedItemByNoteAndType`) and skips enrichment if found.

**Solutions:**

**Option A (Recommended):** Do not create AI card types during synchronous import. Only create "original" (and extractive types like "highlight", "code_snippet"). AI types are created only by enrichment workflow.

**Option B:** Add `is_placeholder BOOLEAN` column to `feed_items`. Placeholder cards are created synchronously, but enrichment checks `if (!exists || is_placeholder)` and replaces them.

**Action required:** Choose option A or B, update specs accordingly.

### File: `02-database-schema.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~65-85 | `feed_items` table definition | ⚠️ Missing column | If Option B chosen, add `is_placeholder BOOLEAN NOT NULL DEFAULT FALSE` |
| ~90-95 | Unique constraint on `(note_id, card_type)` | ✅ Added | Prevents duplicates |

### File: `06-inngest-workflows.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~160-200 | `enrichNotesFunction`: checks `if (!getFeedItemByNoteAndType)` | ⚠️ Blocks on placeholder | If Option B chosen, change to `if (!exists \|\| item.isPlaceholder)` |

---

## 7. Performance and Migration Uncertainties (Document, Don't Block)

### File: `04-feed-engine.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~155-175 | `generateFeedItems`: loops over notes, calls DB per (note, cardType) | ⚠️ N+1 queries | For 100 notes × 3 types = 300 queries |
| ~95-130 | `getFeed`: cursor pagination with `{ id, sortKey }` | ⚠️ Cursor instability | If cursor item deleted, pagination breaks |

**Action:** Add "Known Issues" section to spec documenting these as accepted technical debt for MVP.

### File: `02-database-schema.md`

| Line Range | Issue | Status | Notes |
|---|---|---|---|
| ~45-60 | Migration script algorithm | ⚠️ No concurrency safety | Two processes could apply same migration |

**Action:** Document:
```markdown
**KNOWN ISSUE:** Migration script is not concurrency-safe. Use advisory locks (`pg_advisory_lock`) or ensure only one process runs migrations at a time.
```

---

## Summary: Actions Required Before "Reviewed" Status

| # | Action | Files | Blocker? |
|---|---|---|---|---|
| 1 | Merge duplicate specs into single authoritative versions | 03, 05, 08, 09 | ✅ Yes |
| 2 | Add POST /import/markdown endpoint spec with transientContent flow | 05 | ✅ Yes |
| 3 | Document Access identity propagation uncertainty; mark for verification | 05, 08 | ✅ Yes |
| 4 | Choose placeholder card solution (Option A or B) and update specs | 02, 04, 06 | ✅ Yes |
| 5 | Add "Known Issues" sections for performance and migration | 02, 04 | ⚠️ No (document) |
| 6 | Verify all "Approved" specs changed to "Awaiting review" | All | ⚠️ No (hygiene) |

**Files requiring merge (4):**
- `03-connector-interface.md` + `03-connectors.md` → `03-connectors.md`
- `05-api-contract.md` + `05-authentication.md` → `05-api-authentication.md`
- `08-reflection-feed-app.md` + `08-reflection-feed.md` → `08-reflection-feed.md`
- `09-dev-recall-app.md` + `09-dev-recall.md` → `09-dev-recall.md`

**Specs needing status update (remaining "Approved"):**
- `02-database-schema.md`
- `03-connector-interface.md` (will be deleted after merge)
- `05-api-contract.md` (will be deleted after merge)
- `07-ai-pipeline.md`
- `08-reflection-feed-app.md` (will be deleted after merge)
- `09-dev-recall-app.md` (will be deleted after merge)

---

**Checklist Status:** ✅ COMPLETE

**Implementation Status:** ❌ BLOCKED — Specifications remain "Awaiting review"
