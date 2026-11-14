# Gate 1 Blocker Corrections Review Request

**Submitted:** 2026-11-13T02:30:00Z  
**Supervisor Brief:** v1.1  
**Review Cycle:** 6 (blocker corrections)  
**Previous Review:** 2026-11-13T01:05:52Z

---

## Request

Please review the corrected Gate 1 specifications addressing the three P1 blockers and consistency items from review cycle 5.

**Preserved (accepted in cycle 5):**
- Spec 05 consolidation (no optional-owner, no cross-domain, no service-token)
- OWNER_EMAIL mandatory in private ReflectionFeed
- Missing Access context checked before getIdentity()
- Access webhook using hostname/path in domain field
- Exact webhook routing equality
- Enrichment orphan removed, TypeScript parses
- ID-only results, counter scope, pre-AI existence checks, skipped counts
- Independent card-type steps, constraint-backed idempotency
- CPU claim honesty, single-card API contract

**Corrected in cycle 6:**
1. ✅ P1 - Public Worker unsafe configuration path fixed
2. ✅ P1 - OpenNext handler/context initialization corrected  
3. ✅ P1 - Database error classification applied consistently
4. ✅ Bounded consistency items reconciled

---

## Blocker Corrections

### 1. Public Worker Configuration Safety (Spec 05)

**Issue:** DevRecall Worker allowed unauthenticated private access under missing/invalid FEED_VISIBILITY.

**Correction:**
- Added visibility validation before Hono dispatch
- Rejects non-public configuration with 500 error
- Error message shows current value for debugging

**Evidence:**
```typescript
// Route 2: Enforce public-only configuration
const visibility = normalizeVisibility(env.FEED_VISIBILITY);
if (visibility !== "public") {
  return new Response(
    "DevRecall Worker requires FEED_VISIBILITY=public (current: " + (env.FEED_VISIBILITY || "unset") + ")",
    { status: 500 }
  );
}
```

**Verification with synthetic inputs:**

| FEED_VISIBILITY | Result |
|---|---|
| unset | 500 error before Hono dispatch |
| invalid | 500 error before Hono dispatch |
| private | 500 error before Hono dispatch |
| public | Proceeds to Hono, applies correct middleware |

### 2. OpenNext Handler and Context (Spec 05)

**Issue:** Incorrect import, wrong context initialization order, @opennextjs/cloudflare in shared middleware.

**Correction:**
- Uses documented default export: `import worker from "./.open-next/worker.js"`
- Calls `worker.fetch()` which initializes OpenNext context
- Authentication in outer wrapper using current request's `ctx.access`
- Authenticated email passed through extended env to `worker.fetch()`
- Next.js reads `process.env.accessEmail` (inside initialized context)
- Shared middleware reads from env, does NOT import @opennextjs/cloudflare
- Build command: `opennextjs-cloudflare` (not `open-next build --cloudflare`)
- API routes delegate to shared Hono API via internal fetch

**References:**
- [Custom Worker Template Source](https://raw.githubusercontent.com/opennextjs/opennextjs-cloudflare/main/packages/cloudflare/src/cli/templates/worker.ts)
- [OpenNext Custom Worker Guide](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [OpenNext Get Started](https://opennext.js.org/cloudflare/get-started)

**Lifecycle:**
1. Outer wrapper validates `ctx.access.getIdentity()`
2. Extends env with `accessEmail`
3. Calls `worker.fetch(request, extendedEnv, ctx)`
4. Generated handler initializes OpenNext context
5. Next.js components read `process.env.accessEmail`
6. Hono middleware reads from `c.env.accessEmail`

### 3. Database Error Classification (Spec 06)

**Issue:** Transient database lookups became terminal; arbitrary codes logged; external errors rethrown.

**Correction:**
- Centralized `classifyDatabaseError()` function
- Applied to ID fetch, existence checks, note reads, and insertions
- PostgreSQL/Neon codes added: `57P01`, `57P02`, `57P03`, `08006`, `08003`
- Source: @neondatabase/serverless driver + Node.js net module
- Deleted notes: terminal `NOTE_DELETED` status (not transient)
- All logged codes allowlisted via classification function
- Fresh safe errors thrown for retry (never rethrow external object)
- Constraint violations handled separately (not logged as failures)

**Error Sets:**
```typescript
const TRANSIENT_AI_ERRORS = new Set([
  "AI_PROVIDER_UNAVAILABLE", "AI_QUOTA_EXCEEDED", "AI_TIMEOUT"
]);

const TRANSIENT_DATABASE_ERRORS = new Set([
  "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "ECONNRESET",  // Node transport
  "57P01", "57P02", "57P03", "08006", "08003"               // PostgreSQL/Neon
]);
```

**Verification with synthetic inputs:**

| Injected scenario | Outcome |
|---|---|
| ETIMEDOUT during existence check | throws DB_CONNECTION_ERROR → retry |
| ETIMEDOUT during insertion | throws DB_CONNECTION_ERROR → retry |
| 57P03 during note read | throws DB_CONNECTION_ERROR → retry |
| Deleted note | returns failed with NOTE_DELETED → no retry |
| 23505 constraint violation | returns already_exists → success |
| Synthetic unallowlisted code | mapped to DB_ERROR → terminal |

**Privacy verified:** Arbitrary synthetic code never reached logs; only allowlisted classifications logged.

---

## Consistency Corrections

### Webhook Routing
- Changed `url.pathname.startsWith("/api/inngest")` to `url.pathname === "/api/inngest"` (Spec 06, line 655)
- Exact equality matches Spec 05 pattern

### Retry Configuration
- Explicitly configured: `retries: 4` in function config
- Documented: 4 retries after initial attempt = 5 total attempts
- Terminology clarified: "retries" not "attempts" per Inngest docs
- Reference added to current Inngest documentation

### Security (Spec 05)
- Restored CSRF protection requirement: mutation endpoints verify Origin header
- Added Next.js page rendering cache policy: per-request only (not shared)
- Private response headers: `Cache-Control: private, no-store`

### App Specifications
- Spec 08 (ReflectionFeed): Updated to same-origin OpenNext deployment
- Removed: Pages deployment, cross-domain cookie forwarding, separate API host
- Added: Same-origin Worker pattern, extended env identity passing
- Steering: Updated frontend frameworks and authentication sections

---

## File Hashes

```
SHA256 (.kiro/specs/03-connectors.md) = e8101fc3b71e307e2f689b7afb9a6dd0b35113a7cdede1500ec54a885e6dd246
SHA256 (.kiro/specs/05-authentication.md) = fd61365887052982e75d3b1895807e7a33eb07e3b3580cfc6c5099d2b917eeb0
SHA256 (.kiro/specs/06-inngest-workflows.md) = fececa039a50dbac0bb9e1f134a3f2b4915c5daf818861a082acc2d84a31c677
SHA256 (.kiro/specs/08-reflection-feed.md) = c9488a501abb53add23777d8de85e89b99371a5e9d8661e024687ba38bbbe1fc
SHA256 (.kiro/steering/technology-decisions.md) = 227033fac1bc671f7cfbea7f83eac1558180abf06be30934c0468fa1d54c51b4
```

---

## Static Verification Completed

**Spec 05 (Authentication):**
- [x] DevRecall Worker rejects non-public visibility before Hono dispatch
- [x] Worker import matches documented default export pattern
- [x] Worker calls worker.fetch() which initializes OpenNext context
- [x] Authentication happens in outer wrapper using ctx.access
- [x] Shared middleware reads from env, no @opennextjs/cloudflare import
- [x] Build command matches documented tooling
- [x] JSON syntax validation of all Access examples
- [x] Line count: 906 lines (corrected from earlier "~650" estimate)

**Spec 06 (Workflows):**
- [x] Database error classification applied to all operations
- [x] classifyDatabaseError() function uses allowlisted sets
- [x] PostgreSQL/Neon codes documented with source
- [x] Deleted notes treated as terminal (not transient)
- [x] Fresh safe errors thrown (no external object rethrows)
- [x] Webhook routing uses exact equality
- [x] Retry config explicitly documented: retries: 4

**Spec 08 & Steering:**
- [x] Same-origin OpenNext deployment pattern
- [x] No cross-domain cookie forwarding references
- [x] Consistent with Spec 05 authentication

**Deferred to Implementation:**
- [ ] Runtime execution of DevRecall visibility rejection
- [ ] Runtime verification of OpenNext context initialization
- [ ] Deployed Access configuration testing
- [ ] Database driver actual error codes in production

---

## Supersedes

This submission supersedes:
- `.kiro/reviews/requests/20261113-gate1-consolidation.md` (cycle 5, had blockers)

---

## Next Steps

If approved:
- Gate 1 complete at specification level
- User authorization required before beginning implementation
- No implementation work begins without explicit user approval

If changes requested:
- Address specific issues
- Remain in Gate 1

---

**Awaiting supervisor verdict.**

Implementation remains unauthorized regardless of review outcome. User's separate explicit approval required to proceed to implementation phase.
