# RecallFeed Gate 1 Review Request — Final P1 Fixes (Cycle 7)

**Date:** 2026-11-13  
**Request ID:** `recallfeed-20261113-gate1-final-p1-fixes`  
**Phase:** Gate 1 (Specifications Only)  
**Previous Review:** `.kiro/reviews/2026-11-13T011813Z-gate1.md` (Cycle 6)

---

## Submission Summary

This submission corrects the three remaining P1 findings and bounded consistency issues identified in review cycle 6:

### P1 Fixes

1. **ReflectionFeed identity/routing** (Finding 1):
   - ✅ Removed `process.env.accessEmail` usage from Worker and Next.js examples
   - ✅ Added direct Worker routing: `/api/*` → Hono, others → Next.js via `worker.fetch()`
   - ✅ Updated Next.js integration to use `getCloudflareContext().ctx.access.getIdentity()` (request-local)
   - ✅ Removed HTTP self-call example to frontend `/feed` route
   - ✅ Updated acceptance criteria to prohibit process.env usage and require direct API routing

2. **Uniqueness handling too broad** (Finding 2):
   - ✅ Restored targeted constraint check in prompt insertion: only `feed_items_note_card_type_idx` treated as already_exists
   - ✅ Other constraint violations logged and treated as terminal failures
   - ✅ Summary insertion already had correct targeted check (preserved)

3. **External error object escapes** (Finding 3):
   - ✅ Changed prompt outer catch to `throw new Error(error.message)` (fresh object, not rethrow)
   - ✅ Summary outer catch already had correct fresh error construction (preserved)

### Bounded Consistency Fixes

4. **Spec 08 obsolete examples**:
   - ✅ Removed cookie-forwarding example with `https://reflection-feed-api.yourzone.workers.dev`
   - ✅ Removed Cloudflare Pages deployment requirement
   - ✅ Replaced with correct same-origin Server Action pattern
   - ✅ Updated acceptance criteria to match Spec 05

5. **Retry count contradiction**:
   - ✅ Changed line 775 from "3 retries" to "4 retries" (matches function config)

6. **Initial ID-query error handling**:
   - ✅ Changed to `throw new NonRetriableError("DB_QUERY_FAILED")` for permanent failures
   - ✅ Added `NonRetriableError` import from `inngest`

7. **Build scripts**:
   - ✅ Already correct: separate `build:next` and `build:worker` commands (no change needed)

---

## Files Modified

| File | SHA-256 Hash |
|------|--------------|
| `.kiro/specs/05-authentication.md` | `ac01875b3aebf35c39e09465d034f76bd57993877f46ff9c9568ee25d27a9243` |
| `.kiro/specs/06-inngest-workflows.md` | `819bdad906fd6d077afe6e3cc0900ace31f9dfbfefbd60d96c0ccc51425ef8db` |
| `.kiro/specs/08-reflection-feed.md` | `c3846ffed6ef23df9b5ab59e22ca546de2e5ca98e46d75047468afa319aaa580` |

---

## Preserved Passing Corrections

The following fixes from cycle 5-6 remain unchanged and passing:

- ✅ DevRecall Worker rejects non-public `FEED_VISIBILITY` before Hono dispatch (500 error)
- ✅ OpenNext integration uses default export `worker` from `.open-next/worker.js`
- ✅ Database error classification with PostgreSQL/Neon transient codes
- ✅ Transient DB errors throw fresh safe errors at all operations (lookup, read, insert, ID-fetch)
- ✅ Deleted notes return terminal failure (not retried)
- ✅ Inngest webhook uses exact path equality
- ✅ CSRF and cache policies preserved
- ✅ Technology steering updated to same-origin pattern

---

## Changes Detail

### Spec 05 (.kiro/specs/05-authentication.md)

**Lines 206-212** — ReflectionFeed Worker dispatch:
- **Before:** `const extendedEnv = { ...env, accessEmail: identity.email }; return honoApp.fetch(request, extendedEnv, ctx);`
- **After:** `return honoApp.fetch(request, env, ctx);` (no extended env, identity available via ctx)

**Lines 223-228** — Key Points:
- **Before:** "Authenticated email passed through extended env to Hono middleware"
- **After:** "Hono middleware reads identity from `ctx.access.getIdentity()` (request-local via ctx parameter)"

**Lines 862-876** — Acceptance Criteria:
- **Added:** "Hono middleware reads authenticated email from `ctx.access.getIdentity()` (request-local via ctx parameter)"
- **Added:** "Worker dispatch to Hono passes original `ctx` parameter (not extended env with identity string)"

### Spec 06 (.kiro/specs/06-inngest-workflows.md)

**Line 318** — Added import:
- **Added:** `import { NonRetriableError } from "inngest";`

**Lines 391** — Initial ID-query error handling:
- **Before:** `throw new Error("DB_QUERY_FAILED");`
- **After:** `throw new NonRetriableError("DB_QUERY_FAILED");`

**Lines 627-647** — Prompt insertion error handling:
- **Before:** All 23505 treated as already_exists
- **After:** Only `insertError.constraint === TARGET_CONSTRAINT` treated as already_exists; other violations logged and terminal

**Lines 652-653** — Prompt outer catch:
- **Before:** `throw error;` (external object)
- **After:** `throw new Error(error.message);` (fresh object)

**Line 775** — Retry count documentation:
- **Before:** "3 retries with exponential backoff"
- **After:** "4 retries with exponential backoff (5 total attempts including initial)"

### Spec 08 (.kiro/specs/08-reflection-feed.md)

**Lines 68-143** — Authentication Flow and Admin Features:
- **Before:** Next.js Route Handler with cookie forwarding to `https://reflection-feed-api.yourzone.workers.dev/import/markdown`
- **After:** Server Action calling shared business logic directly via `importMarkdownContent()` function
- **Removed:** `process.env.accessEmail` usage (line 75)
- **Updated:** Identity read via `getCloudflareContext().ctx.access.getIdentity()`

**Lines 189-196** — Acceptance Criteria:
- **Before:** "Next.js app deploys to Cloudflare Pages successfully"
- **After:** "Next.js app deploys as single Worker via `@opennextjs/cloudflare` adapter"
- **Added:** Direct API routing requirements, no HTTP self-calls

---

## Testing Against Supervisor Scenarios

The following synthetic test cases from cycle 6 review should now pass:

### Uniqueness Handling
- ✅ Target constraint `feed_items_note_card_type_idx` → `result: "already_exists"`
- ✅ Unrelated constraint `unrelated_primary_key` → `result: "failed", code: "DB_CONSTRAINT_VIOLATION"`

### External Error Object
- ✅ Provider factory error with allowlisted message → fresh Error with message only (no stack/properties from original)
- ✅ External error object identity NOT preserved

### ReflectionFeed Identity
- ✅ No `process.env.accessEmail` anywhere
- ✅ Worker routes `/api/*` to Hono (direct dispatch, not HTTP)
- ✅ Next.js reads via `getCloudflareContext().ctx.access.getIdentity()` (request-local)

### Initial Query Error
- ✅ Permanent database error → `NonRetriableError` (no retries)

---

## Static Validation

- ✅ All three specification files parse as valid Markdown
- ✅ All TypeScript code examples parse (verified with ts-node --check)
- ✅ `TARGET_CONSTRAINT` constant defined before usage
- ✅ `NonRetriableError` imported before usage
- ✅ No `process.env.accessEmail` references remain
- ✅ No HTTP self-call examples remain

---

## Authorization Boundaries

**Authorized:**
- ✅ Specification corrections per supervisor brief v1.1
- ✅ Review request document creation
- ✅ File hash generation

**NOT Authorized (not performed):**
- ❌ Implementation (no packages/* or apps/* files created/modified)
- ❌ Git commit or push
- ❌ Deployment or testing
- ❌ Phase advancement beyond Gate 1
- ❌ Repository synchronization or publishing

---

## Request

Supervisor review of corrected Gate 1 specifications with verification of:

1. ReflectionFeed Worker dispatches `/api/*` to Hono without process-global identity
2. Next.js integration reads identity via `getCloudflareContext()` (request-local)
3. Prompt insertion checks specific constraint only (not all 23505)
4. Prompt outer catch throws fresh Error (not external object)
5. Initial ID-query throws NonRetriableError for permanent failures
6. Spec 08 uses same-origin Server Action (no cookie forwarding)
7. No contradictions remain between Specs 05, 06, and 08

All work remains specifications-only. Implementation authorization required separately even if review passes.

---

**Submitted:** 2026-11-13  
**Kiro Session:** RecallFeed Gate 1 Corrections (Cycle 7)
