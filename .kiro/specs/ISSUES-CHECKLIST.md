# RecallFeed Specification Issues Checklist

**Date:** November 7, 2026
**Status:** All specifications remain "Awaiting review"

---

## Issue 1: Establish One Authoritative Spec Per Subject

### Duplicate Files Found

| Subject | Approved (Original) | Superseded By | Action |
|---|---|---|---|
| **03 - Connectors** | `03-connector-interface.md` | `03-connectors.md` | Reconcile and merge |
| **05 - API/Auth** | `05-api-contract.md` | `05-authentication.md` | Reconcile and merge |
| **08 - ReflectionFeed** | `08-reflection-feed-app.md` | `08-reflection-feed.md` | Reconcile and merge |
| **09 - DevRecall** | `09-dev-recall-app.md` | `09-dev-recall.md` | Reconcile and merge |

### Specific Issues

- **Line:** AUDIT-REPORT.md:88-90
  - **Problem:** "All issues have been resolved" — unsupported claim; many issues remain
  - **Action:** Remove or rewrite to "Initial audit completed; issues documented below for resolution"

- **Line:** AUDIT-REPORT.md:145-155
  - **Problem:** "Implementation Readiness" section claims specs are "approved for implementation"
  - **Action:** Remove this section entirely; all specs remain "Awaiting review"

- **Line:** AUDIT-REPORT.md:159-168
  - **Problem:** "Next Steps" includes implementation tasks (deploy, verify)
  - **Action:** Replace with specification-only next steps (reconcile duplicates, resolve issues)

---

## Issue 2: Missing-Secret/Missing-Header Authentication

### Problem: Unauthenticated Access to Unpublished Data

**File:** `05-authentication.md`

- **Line:** ~55-75 (`requireAccess` middleware)
  - **Problem:** No validation that `ctx.access` exists before reading `identity`
  - **Issue:** If Cloudflare Access is misconfigured or bypassed, `ctx.access` may be undefined
  - **Action:** Add explicit check: `if (!c.get("access")?.identity) { throw AUTH_ACCESS_REQUIRED }`

- **Line:** ~85-100 (`requireApiKey` middleware)
  - **Problem:** Does not handle case where `API_SECRET_KEY` is not set
  - **Issue:** `providedKey !== secretKey` evaluates to `true !== undefined` → throws invalid error
  - **Action:** Check `if (!secretKey) { throw AUTH_NO_SECRET_KEY }` before comparison

- **Line:** ~110-125 (`injectPublicRequestFlag` middleware)
  - **Problem:** Does not validate `FEED_VISIBILITY` value
  - **Issue:** Typo like `FEED_VISIBILITY=publik` would default to treating it as a new mode
  - **Action:** Validate: `if (!["private", "public"].includes(visibility)) { visibility = "private"; }`

### Problem: Public Mode Unauthorized Access

**File:** `05-authentication.md`

- **Line:** ~145-165 (route-level authorization)
  - **Problem:** Public mode read routes do not verify `isPublicRequest` before returning data
  - **Issue:** If middleware fails to set flag, unpublished items could leak
  - **Action:** Add explicit check in feed route: `if (isPublicRequest && !item.isPublished) { exclude }`

**File:** `04-feed-engine.md`

- **Line:** ~85-110 (`getFeed` method)
  - **Problem:** Relies solely on `isPublicRequest` flag without database-level enforcement
  - **Issue:** Caller could pass `isPublicRequest: false` without authentication
  - **Action:** Add authentication context to `GetFeedOptions` and verify in engine

---

## Issue 3: AI Provider Objects in Inngest Step Results

### Credentials and Provider Objects in Step Returns

**File:** `06-inngest-workflows.md`

- **Line:** ~135-155 (`enrichNotesFunction` - "initialize-ai" step)
  - **Problem:** Returns `aiProvider` object which may contain credentials or connection state
  - **Issue:** Inngest logs step results; provider objects expose internal state
  - **Action:** Do not return provider from step; instantiate inline in next step

**File:** `07-ai-pipeline.md` (if it exists)

- **Need to review:** Check if AI provider instantiation exposes credentials in constructor or properties

### Private Note Content in Logs

**File:** `06-inngest-workflows.md`

- **Line:** ~100-130 (`ingestSourceFunction` - "import-notes" step)
  - **Problem:** Step logs may include note content in error traces
  - **Issue:** Note content may contain private information (passwords in code snippets, personal reflections)
  - **Action:** Wrap import in try/catch, sanitize error messages before re-throwing

---

## Issue 4: Content-Bearing Markdown Import Contract

### Transient Content Loss on Database Reload

**File:** `01-core-domain.md`

- **Line:** ~30-35 (`Source.transientContent` definition)
  - **Problem:** States "NEVER persisted" but does not explain implications
  - **Issue:** If Inngest workflow reloads source from DB, transient content is lost
  - **Action:** Add explicit note: "Reloading a Source by ID from the database will return `transientContent: undefined`"

**File:** `03-connectors.md`

- **Line:** ~45-65 (`MarkdownConnector.import` - content source)
  - **Problem:** Throws error if `transientContent` is undefined, but does not explain when this occurs
  - **Issue:** Unclear if this is a programming error or a recoverable state
  - **Action:** Document: "This indicates the source was reloaded from DB; Markdown import cannot proceed asynchronously"

**File:** `04-feed-engine.md`

- **Line:** ~25-50 (`importSource` - Markdown path)
  - **Problem:** States "content is in `source.transientContent`" without explaining how it got there
  - **Issue:** Missing API contract: who sets this field and when?
  - **Action:** Add: "The API route handler must set `source.transientContent = <uploaded content>` before calling `importSource()`"

**File:** `05-api-contract.md` (original) or `05-authentication.md` (new)

- **Missing:** No API endpoint specification for `POST /import/markdown`
  - **Issue:** Request body format, content-type handling, and transient field population are undocumented
  - **Action:** Add complete endpoint spec:
    ```
    POST /import/markdown
    - Auth: requireApiKey (public) or requireAccess (private)
    - Content-Type: text/markdown or multipart/form-data
    - Body: Raw markdown content (max 100 KB)
    - Flow:
      1. Parse request body to extract content string
      2. Create or update Source record (type: "markdown")
      3. Set source.transientContent = content (in-memory only)
      4. Call feedEngine.importSource(sourceId)
      5. Return import result
    ```

---

## Issue 5: Access Identity Propagation into Hono

### Cookie Acquisition from Request

**File:** `05-authentication.md`

- **Line:** ~30-50 (Hosting Topology section)
  - **Problem:** Describes `CF_Authorization` cookie forwarding but not initial acquisition
  - **Issue:** How does Cloudflare Access set the cookie? What happens on first unauthenticated request?
  - **Action:** Document:
    - "On first unauthenticated request, Cloudflare Access intercepts before Worker execution"
    - "Access redirects to identity provider (Google, GitHub, etc.)"
    - "After successful auth, Access sets `CF_Authorization` cookie and redirects back to original URL"
    - "Subsequent requests include cookie; Access validates JWT and injects identity"

### Identity Injection into Hono Context

**File:** `05-authentication.md`

- **Line:** ~55-75 (`requireAccess` middleware)
  - **Problem:** Reads `c.get("access")?.identity` but does not explain how this is populated
  - **Issue:** Hono does not automatically parse Cloudflare Access JWT
  - **Action:** Add:
    - "Cloudflare Access injects identity into the Workers runtime via `request.cf.access` (not documented)"
    - OR "Use Cloudflare Workers Access SDK to parse JWT from cookie"
    - OR "Require explicit middleware to extract JWT, verify signature, and populate `c.set('access', identity)`"

**UNCERTAINTY:** The exact mechanism by which Cloudflare Access identity becomes available in Hono context is unclear. Requires verification:
- Does Cloudflare inject `request.cf.access`?
- Must we parse the JWT manually?
- Is there a Cloudflare Workers SDK for Access?

### Next.js Server Hosting Arrangement

**File:** `08-reflection-feed.md`

- **Line:** ~25-35 (Deployment Configuration)
  - **Problem:** States "Next.js app deployed to Cloudflare Pages" without explaining how it's built
  - **Issue:** Cloudflare Pages supports Next.js via `@cloudflare/next-on-pages` adapter
  - **Action:** Document:
    - "Build with `@cloudflare/next-on-pages` adapter"
    - "Next.js Route Handlers run as edge functions on Cloudflare Pages"
    - "Server-side code has access to `cookies()` API for reading `CF_Authorization`"

- **Line:** ~50-80 (Authentication Flow section)
  - **Problem:** Shows cookie forwarding but does not explain same-site vs cross-site
  - **Issue:** If Worker and Next.js are on different domains, `CF_Authorization` must be `SameSite=None`
  - **Action:** Add:
    - "If Worker domain ≠ Next.js domain: Cloudflare Access must set `SameSite=None; Secure`"
    - "If subdomains of same parent domain: `SameSite=Lax` works"
    - "Verify Access policy allows cookie forwarding from Next.js origin"

---

## Issue 6: Placeholder AI Cards Blocking Enrichment

### Placeholder Cards Prevent AI Generation

**File:** `04-feed-engine.md`

- **Line:** ~180-210 (`generateCardContent` function)
  - **Problem:** Returns `"[Summary will be generated]"` placeholder for AI card types
  - **Issue:** `insertFeedItem` persists this placeholder, then `getFeedItemByNoteAndType` prevents AI enrichment
  - **Action:** Do not create AI card types during synchronous import; only create `"original"` cards
  - **Alternative:** Add `is_placeholder: boolean` column to `feed_items` and filter these out

**File:** `06-inngest-workflows.md`

- **Line:** ~160-200 (`enrichNotesFunction` - enrich steps)
  - **Problem:** Checks `if (!(await getFeedItemByNoteAndType(...)))` which fails if placeholder exists
  - **Issue:** AI enrichment never runs for notes that already have placeholder cards
  - **Action:** Check `if (!(await getFeedItemByNoteAndType(...)) || item.isPlaceholder)`

**File:** `02-database-schema.md`

- **Missing:** No `is_placeholder` column on `feed_items` table
  - **Action:** Add `is_placeholder BOOLEAN NOT NULL DEFAULT FALSE` column
  - **Action:** Add to acceptance criteria: "Placeholder cards are replaced by AI enrichment, not blocked by uniqueness constraint"

### Performance: N+1 Queries in Feed Generation

**File:** `04-feed-engine.md`

- **Line:** ~155-175 (`generateFeedItems` - loop over notes)
  - **Problem:** Calls `getFeedItemByNoteAndType` once per (note, card_type) combination
  - **Issue:** For 100 notes × 3 card types = 300 database queries
  - **Action:** Document as "KNOWN ISSUE: N+1 query pattern; optimize with batch SELECT"

### Pagination: Cursor Stability Across Deletes

**File:** `04-feed-engine.md`

- **Line:** ~95-130 (`getFeed` - cursor handling)
  - **Problem:** Cursor contains `{ id, sortKey }` but does not handle deleted items
  - **Issue:** If item with cursor ID is deleted, pagination breaks
  - **Action:** Document: "KNOWN ISSUE: Cursor pagination may skip items if the cursor item is deleted between requests"

### Migration: Concurrency Safety

**File:** `02-database-schema.md`

- **Line:** ~45-60 (Migration Script algorithm)
  - **Problem:** No transaction or locking around migration check-and-insert
  - **Issue:** If two migration processes run concurrently, both may try to apply the same migration
  - **Action:** Document:
    - "KNOWN ISSUE: Migration script is not concurrency-safe"
    - "Mitigation: Use advisory locks (`pg_advisory_lock`) or ensure only one process runs migrations"

---

## Reconciliation Actions Required

### Merge Duplicate Specs

For each duplicate pair, create ONE authoritative spec that:
1. Retains all approved content from original
2. Incorporates corrections from the audit
3. Explicitly documents uncertainties
4. Marks status as "Awaiting review"

**Order of reconciliation:**
1. **03-connectors** (merge 03-connector-interface.md + 03-connectors.md)
2. **05-authentication** (merge 05-api-contract.md + 05-authentication.md, resolve auth issues)
3. **08-reflection-feed** (merge 08-reflection-feed-app.md + 08-reflection-feed.md)
4. **09-dev-recall** (merge 09-dev-recall-app.md + 09-dev-recall.md)

### Delete Superseded Files

After merging:
- Delete `03-connector-interface.md`
- Delete `05-api-contract.md`
- Delete `08-reflection-feed-app.md`
- Delete `09-dev-recall-app.md`

### Update AUDIT-REPORT.md

Remove:
- "All issues have been resolved" (line 88-90)
- "Implementation Readiness" section (lines 145-155)
- Implementation-focused "Next Steps" (lines 159-168)

Replace with:
- "Initial audit completed; issues documented in ISSUES-CHECKLIST.md"
- "All specifications remain 'Awaiting review' until issues are resolved"
- "Next steps: Reconcile duplicates, resolve authentication uncertainties, remove placeholder card pattern"

---

## Summary of Open Issues by Category

| Category | Count | Blocker? |
|---|---|---|
| Duplicate specs | 4 | Yes — creates confusion |
| Authentication gaps | 6 | Yes — security critical |
| AI provider serialization | 2 | Yes — credential exposure |
| Markdown import contract | 4 | Yes — undefined behavior |
| Access identity propagation | 4 | Yes — mechanism unclear |
| Placeholder AI cards | 3 | Yes — blocks enrichment |
| Performance uncertainties | 2 | No — document as known issue |
| Migration concurrency | 1 | No — document as known issue |

**Total issues:** 26

**Specification status:** All remain "Awaiting review" until issues resolved.

---

**Checklist Status:** ✅ COMPLETE — Ready for systematic resolution
