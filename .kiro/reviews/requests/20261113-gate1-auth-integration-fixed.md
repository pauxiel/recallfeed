# RecallFeed Gate 1 Review Request — Authentication Integration Fixed (Cycle 8)

**Date:** 2026-11-13  
**Request ID:** `recallfeed-20261113-gate1-auth-integration-fixed`  
**Phase:** Gate 1 (Specifications Only)  
**Previous Review:** `.kiro/reviews/2026-11-13T103144Z-gate1.md` (Cycle 7)

---

## Submission Summary

This submission corrects the two remaining P1 ReflectionFeed authentication defects and small consistency issues identified in review cycle 7. The passing workflow corrections from cycle 7 are preserved unchanged.

### P1 Fixes

1. **Owner authorization protects all routes** (Finding 1):
   - ✅ Moved owner authorization BEFORE route dispatch (after only the exact webhook exception)
   - ✅ Owner validation now protects both Hono API and Next.js pages/Server Actions
   - ✅ Non-owner authenticated users rejected before reaching any protected handler
   - ✅ Server Action example assumes Worker pre-validation (correct)

2. **Hono middleware consumes request context** (Finding 2):
   - ✅ Updated `requireOwner` middleware to read `c.executionCtx.access.getIdentity()`
   - ✅ Removed stale `(c.env as any).accessEmail` read
   - ✅ Added Identity type definition
   - ✅ Specified `/api` path mapping: Worker strips prefix before Hono dispatch
   - ✅ Updated acceptance criteria to match actual integration
   - ✅ Removed stale extended-env prose from integration pattern

### Small Consistency Corrections

3. **Spec 06 constraint violation statements** (lines 710, 814):
   - ✅ Updated to distinguish target constraint from other 23505 violations
   - ✅ Preserved passing implementation code (no changes)

4. **Spec 08 Route Handler references** (lines 161, 192):
   - ✅ Changed "Route Handlers" to "Server Actions"
   - ✅ Updated acceptance criteria to match Worker pre-validation pattern

5. **OpenNext adapter configuration**:
   - ✅ Added coherent Wrangler configuration example with compatibility_date
   - ✅ Documented build command combining Next.js and adapter builds
   - ✅ Specified custom wrapper as main entry (not generated worker directly)

---

## Files Modified

| File | SHA-256 Hash |
|------|--------------|
| `.kiro/specs/05-authentication.md` | `e074e137162eada20770d8568bc35ef74e1ed2384f4eb24cf0cb05e415eb04b0` |
| `.kiro/specs/06-inngest-workflows.md` | `13c74916bc39ac8caaa2c6f66baf9bcc04e25dc70737afa0b71d27ba416f3818` |
| `.kiro/specs/08-reflection-feed.md` | `72cddef55e3bd4b1bdda81465640178fce0ebaf70d608d732319cbee4621e363` |

---

## Preserved Passing Corrections (Cycle 7)

The following workflow fixes remain unchanged and passing:

- ✅ Target note/card uniqueness conflicts produce `already_exists` in both card types
- ✅ Unrelated unique conflicts produce explicit failures (not false success)
- ✅ Provider-factory errors produce fresh errors (no original object/stack leak)
- ✅ Transient lookup/insertion failures throw safe DB_CONNECTION_ERROR
- ✅ Permanent initial-query failures use NonRetriableError (not ordinary retry)
- ✅ process.env.accessEmail removed from all executable code
- ✅ HTTP self-proxy example removed
- ✅ Spec 08 no longer prescribes separate API hostname or Pages deployment
- ✅ Retry count documentation matches function config (4 retries)

---

## Changes Detail

### Spec 05 (.kiro/specs/05-authentication.md)

**Lines 167-223** — ReflectionFeed Worker routing:
- **Before:** Owner authorization inside `/api/*` route branch only
- **After:** Owner authorization after webhook exception, before both Hono and Next dispatch
- **Added:** Path mapping - strip `/api` prefix before Hono dispatch
- **Route structure:**
  1. `/api/inngest` → Inngest handler (bypasses owner check)
  2. Owner authorization for all non-webhook requests in private mode
  3. `/api/*` (except webhook) → Hono with stripped prefix
  4. Everything else → Next.js

**Lines 325-365** — requireOwner middleware:
- **Before:** Read `(c.env as any).accessEmail`
- **After:** Read `c.executionCtx.access.getIdentity()` (request-local)
- **Added:** Identity type definition
- **Verification:** Owner validation confirmed by Worker (middleware trusts contract)

**Lines 252-283** — Build and deployment configuration:
- **Added:** Wrangler configuration example with compatibility_date, build command, secrets
- **Clarified:** Build process: Next.js → adapter → custom wrapper deployment

**Lines 480-487** — Integration Pattern:
- **Before:** "Worker wrapper authenticates owner via ctx.access.getIdentity() before Hono dispatch"
- **After:** "Worker wrapper validates owner before both Hono and Next.js dispatch"
- **Added:** Path stripping and c.executionCtx middleware details

**Lines 882-897** — Acceptance Criteria:
- **Before:** "Authenticated owner checked in Worker wrapper before API/frontend dispatch"
- **After:** "Worker validates owner authorization before both Hono and Next.js dispatch"
- **Added:** Path stripping requirement, middleware c.executionCtx requirement
- **Added:** Server Actions verify owner or rely on Worker pre-validation

### Spec 06 (.kiro/specs/06-inngest-workflows.md)

**Lines 708-713** — Error Handling Summary:
- **Before:** "Constraint Violations: 23505 → treat as already_exists"
- **After:** "Target Constraint Violations: 23505 with constraint feed_items_note_card_type_idx → already_exists" + "Other Constraint Violations: 23505 with unrelated constraints → terminal failure"

**Lines 812-817** — Acceptance Criteria:
- **Before:** "Constraint violation (code 23505) returns already_exists"
- **After:** "Target constraint violation (constraint feed_items_note_card_type_idx) returns already_exists" + "Unrelated constraint violations return terminal failure"

### Spec 08 (.kiro/specs/08-reflection-feed.md)

**Line 161** — Admin Panel mutations:
- **Before:** "All mutations via server-side Route Handlers"
- **After:** "All mutations via server-side Server Actions"

**Lines 182-196** — Acceptance Criteria:
- **Before:** "Worker wrapper routes /api/* to shared Hono app" + "Markdown import via Route Handler with forwarded authentication"
- **After:** "Worker wrapper validates owner before both Hono and Next.js dispatch" + "Server Actions verify owner or rely on Worker pre-validation" + "Markdown import via Server Action calling shared logic"

---

## Integrated Test Scenarios

The following scenarios verify the components work together, not individually:

### Scenario 1: Valid Owner API Request

**Setup:**
- Request: `GET https://reflection.example.com/api/feed`
- Identity: `owner@example.com` (via ctx.access)
- Configuration: `OWNER_EMAIL=owner@example.com`, `FEED_VISIBILITY=private`

**Expected Flow:**
1. Worker: `/api/inngest` check → false
2. Worker: Owner authorization → `ctx.access.getIdentity()` returns `owner@example.com`
3. Worker: Owner comparison → matches `OWNER_EMAIL` → authorized
4. Worker: Path mapping → strip `/api` → create request with path `/feed`
5. Worker: Dispatch → `honoApp.fetch(apiRequest, env, ctx)`
6. Hono: `requireOwner` middleware → read `c.executionCtx.access.getIdentity()` → returns `owner@example.com`
7. Hono: Middleware → `c.set("authenticatedEmail", "owner@example.com")` → next()
8. Hono: Route handler → execute business logic → return feed

**Expected Result:** 200 OK with feed data

### Scenario 2: Non-Owner Frontend Request

**Setup:**
- Request: `GET https://reflection.example.com/feed`
- Identity: `attacker@example.com` (via ctx.access)
- Configuration: `OWNER_EMAIL=owner@example.com`, `FEED_VISIBILITY=private`

**Expected Flow:**
1. Worker: `/api/inngest` check → false
2. Worker: Owner authorization → `ctx.access.getIdentity()` returns `attacker@example.com`
3. Worker: Owner comparison → does NOT match `OWNER_EMAIL` → rejected
4. Worker: Return 403 immediately (no Next.js dispatch)

**Expected Result:** 403 `Access denied: attacker@example.com is not the deployment owner`

**Critical:** Next.js `worker.fetch()` never called, Server Action never reached

### Scenario 3: Non-Owner Server Action

**Setup:**
- Request: `POST https://reflection.example.com/admin` (Server Action endpoint)
- Identity: `attacker@example.com` (via ctx.access)
- Configuration: `OWNER_EMAIL=owner@example.com`, `FEED_VISIBILITY=private`

**Expected Flow:**
1. Worker: `/api/inngest` check → false
2. Worker: Owner authorization → `ctx.access.getIdentity()` returns `attacker@example.com`
3. Worker: Owner comparison → does NOT match `OWNER_EMAIL` → rejected
4. Worker: Return 403 immediately (no Next.js dispatch)

**Expected Result:** 403 `Access denied: attacker@example.com is not the deployment owner`

**Critical:** importMarkdownAction Server Action never executed, shared business logic never called

### Scenario 4: Missing Owner Configuration

**Setup:**
- Request: `GET https://reflection.example.com/feed`
- Identity: `owner@example.com` (via ctx.access)
- Configuration: `OWNER_EMAIL` missing, `FEED_VISIBILITY=private`

**Expected Flow:**
1. Worker: `/api/inngest` check → false
2. Worker: Owner authorization → `OWNER_EMAIL` check → undefined
3. Worker: Return 500 immediately

**Expected Result:** 500 `Private mode requires OWNER_EMAIL configuration`

**Critical:** Neither API nor frontend reached with misconfiguration

### Scenario 5: Hono Middleware with Valid Owner Context

**Setup:**
- Request: API request already authorized by Worker (from Scenario 1)
- Context: `c.executionCtx.access.getIdentity()` available (passed by Worker)

**Expected Flow:**
1. Middleware: Check visibility → `private`
2. Middleware: Read `c.executionCtx` → access object present
3. Middleware: Call `access.getIdentity()` → returns `{ email: "owner@example.com" }`
4. Middleware: Store → `c.set("authenticatedEmail", "owner@example.com")`
5. Middleware: next()

**Expected Result:** Middleware passes, route handler receives authenticated email

**Critical:** No 401 AUTH_REQUIRED (no stale accessEmail read)

---

## Static Validation

- ✅ All three specification files parse as valid Markdown
- ✅ All TypeScript code examples parse (verified with ts-node --check)
- ✅ `Identity` interface defined before usage in middleware
- ✅ Path stripping logic correct: `/api/feed` → `/feed`
- ✅ Wrangler configuration follows documented format
- ✅ No process.env.accessEmail references in executable code
- ✅ No HTTP self-call examples remain
- ✅ Constraint violation documentation distinguishes target from other violations

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

1. **Owner authorization protects all routes:** Valid owner reaches handlers; non-owner rejected before API, pages, or Server Actions
2. **Hono middleware reads request context:** `c.executionCtx.access.getIdentity()` succeeds with Worker-passed context
3. **Path mapping works:** Worker strips `/api` prefix, Hono receives correct paths
4. **Integrated scenarios pass:** Test wrapper + middleware + Server Action together, not individually
5. **Consistency corrections applied:** Constraint statements, Server Actions terminology, build configuration

All work remains specifications-only. Implementation authorization required separately even if review passes.

---

**Submitted:** 2026-11-13  
**Kiro Session:** RecallFeed Gate 1 Corrections (Cycle 8)
