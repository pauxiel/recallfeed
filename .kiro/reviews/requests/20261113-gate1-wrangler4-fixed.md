# RecallFeed Gate 1 Review Request — Wrangler 4 Dependency Fixed (Cycle 10)

**Date:** 2026-11-13  
**Request ID:** `recallfeed-20261113-gate1-wrangler4-fixed`  
**Phase:** Gate 1 (Specifications Only)  
**Previous Review:** `.kiro/reviews/2026-11-13T221916Z-gate1.md` (Cycle 9)

---

## Submission Summary

This submission corrects the remaining dependency compatibility mismatch identified in review cycle 9: Wrangler 3 conflicts with OpenNext 1.x peer dependency requirements.

**All passing authentication and workflow examples are preserved unchanged.**

### Dependency Compatibility Fixed

**Problem (from cycle 9 review):**
- Specification declared `@opennextjs/cloudflare: ^1.0.0` with `wrangler: ^3.0.0`
- OpenNext 1.0.0 requires `wrangler: ^4.14.0` (peer dependency)
- OpenNext 1.20.17 requires `wrangler: ^4.148.0` (peer dependency)
- Wrangler 3.x range cannot satisfy required 4.x peer dependency

**Solution applied:**
- ✅ Updated: `@opennextjs/cloudflare: ^1.20.0` (stable 1.x series)
- ✅ Updated: `wrangler: ^4.148.0` (satisfies OpenNext 1.20.x peer dependency)
- ✅ Updated: `next: ^15.5.29` (satisfies OpenNext 1.20.x peer: `>=15.5.29 <16 or >=16.4.5`)
- ✅ Added: Dependency compatibility note documenting peer requirements

---

## Files Modified

| File | SHA-256 Hash |
|------|--------------|
| `.kiro/specs/05-authentication.md` | `39710b4f466dc1f56a741d4a0957ea2ad45b230a39576889bc05692d808868f8` |

**Unchanged files (hashes remain the same):**
- `.kiro/specs/06-inngest-workflows.md` — `13c74916bc39ac8caaa2c6f66baf9bcc04e25dc70737afa0b71d27ba416f3818`
- `.kiro/specs/08-reflection-feed.md` — `adffd2720711dc86af827eedad451cc8903caf4e1240c62344d53d026c08c978`

---

## Preserved Passing Corrections (Cycles 7-9)

The following remains unchanged:

### Authentication (13 checks passed in cycles 8-9)
- ✅ Owner authorization before both Hono and Next.js dispatch
- ✅ Non-owner rejected at Worker boundary
- ✅ Path stripping preserves request data
- ✅ Hono middleware reads `c.executionCtx.access.getIdentity()`
- ✅ Exact `/api/inngest` webhook bypass
- ✅ All wrapper/middleware/Server Action examples

### Workflow (regression checks passed in cycle 8)
- ✅ Target constraint → `already_exists`
- ✅ Unrelated constraints → explicit failures
- ✅ Fresh safe errors (no stack leak)
- ✅ Transient DB failures → safe errors
- ✅ Permanent initial query → NonRetriableError

### OpenNext Configuration (accepted in cycle 9)
- ✅ Command: `opennextjs-cloudflare build`
- ✅ Output: `.open-next/worker.js`
- ✅ Assets: Workers static-assets binding (not KV)
- ✅ Compatibility: `2024-09-23` + `nodejs_compat`
- ✅ Format: `wrangler.jsonc`

---

## Changes Detail

### Spec 05 (.kiro/specs/05-authentication.md)

**Lines 240-264** — Package versions and dependency compatibility:

**Before (cycle 9):**
```json
{
  "dependencies": {
    "@opennextjs/cloudflare": "^1.0.0",
    "next": "^15.0.0"
  },
  "devDependencies": {
    "wrangler": "^3.0.0"
  }
}
```

**After (cycle 10):**
```json
{
  "dependencies": {
    "@opennextjs/cloudflare": "^1.20.0",
    "next": "^15.5.29"
  },
  "devDependencies": {
    "wrangler": "^4.148.0"
  }
}
```

**Added dependency compatibility note:**
```
**Dependency Compatibility:**
- OpenNext 1.20.x requires Wrangler ^4.148.0 (peer dependency)
- OpenNext 1.20.x supports Next.js >=15.5.29 <16 or >=16.4.5
- Selected: Next.js ^15.5.29 to satisfy peer dependency minimum
```

**Rationale:**
1. OpenNext 1.20.17 is the newest stable 1.x release (verified by supervisor in cycle 9)
2. ^1.20.0 range captures current stable series
3. Wrangler ^4.148.0 satisfies OpenNext 1.20.x peer dependency exactly
4. Next.js ^15.5.29 satisfies OpenNext peer minimum (>=15.5.29)
5. All three dependencies are now mutually compatible

---

## Verification Evidence

### Peer Dependency Satisfaction

**OpenNext 1.20.17 peer dependencies (per npm registry):**
- `wrangler: ^4.148.0`
- `next: >=15.5.29 <16 or >=16.4.5`

**Proposed specification versions:**
- `wrangler: ^4.148.0` → Satisfies `^4.148.0` ✓
- `next: ^15.5.29` → Satisfies `>=15.5.29 <16` ✓
- `@opennextjs/cloudflare: ^1.20.0` → Resolves to 1.20.x (compatible) ✓

### Semver Range Analysis

| Dependency | Range | Resolves to | Peer requirement | Compatible? |
|---|---|---|---|---|
| @opennextjs/cloudflare | ^1.20.0 | 1.20.17 (latest 1.x) | — | ✓ |
| wrangler | ^4.148.0 | 4.148.x+ | Required by OpenNext 1.20.x | ✓ |
| next | ^15.5.29 | 15.5.29+ (< 16) | >=15.5.29 <16 | ✓ |

No conflicts. All peer dependencies satisfied.

### What Changed vs Cycle 9

| Dependency | Cycle 9 | Cycle 10 | Reason |
|---|---|---|---|
| @opennextjs/cloudflare | ^1.0.0 | ^1.20.0 | Use stable 1.x series with verified peers |
| wrangler | ^3.0.0 | ^4.148.0 | Satisfy OpenNext 1.20.x peer: ^4.148.0 |
| next | ^15.0.0 | ^15.5.29 | Satisfy OpenNext 1.20.x peer: >=15.5.29 |

---

## What Was NOT Changed

### Preserved Examples (unchanged from cycle 9)

All code examples remain byte-for-byte identical:
- ✅ ReflectionFeed Worker routing (lines 167-223)
- ✅ Owner authorization logic
- ✅ Path stripping implementation
- ✅ Hono middleware `requireOwner`
- ✅ Next.js Server Action example
- ✅ Wrangler configuration structure (lines 265-279)
- ✅ All workflow enrichment code (Spec 06)
- ✅ All DevRecall and acceptance criteria

Only package version numbers changed in the JSON example.

### Out of Scope

- ❌ Installing @opennextjs/cloudflare, wrangler, or next
- ❌ Running `npm install` or any package manager
- ❌ Verifying runtime behavior
- ❌ Building or deploying
- ❌ Creating package.json files
- ❌ Scaffolding applications

This is a documentation-only correction specifying compatible dependency versions.

---

## Static Validation

- ✅ All JSON examples parse (verified with jq)
- ✅ Semver ranges valid: `^1.20.0`, `^4.148.0`, `^15.5.29`
- ✅ Peer dependency analysis: all requirements satisfied
- ✅ Wrangler 4.148.0 released and available (not hypothetical)
- ✅ Next.js 15.5.29 released and available
- ✅ OpenNext 1.20.17 is current stable 1.x

---

## Sources

**Peer dependency verification (per cycle 9 review):**
- https://registry.npmjs.org/@opennextjs/cloudflare/1.0.0
- https://registry.npmjs.org/@opennextjs/cloudflare/1.20.17

**Supervisor findings from cycle 9:**
> Independent inspection of published npm metadata found:
> - OpenNext 1.0.0 requires wrangler ^4.14.0
> - OpenNext 1.20.17 requires wrangler ^4.148.0
> - OpenNext 1.20.17 requires Next.js >=15.5.29 <16 or >=16.4.5

---

## Authorization Boundaries

**Authorized:**
- ✅ Specification corrections per supervisor brief v1.1
- ✅ Dependency version documentation updates
- ✅ Review request document creation
- ✅ File hash generation

**NOT Authorized (not performed):**
- ❌ Implementation (no packages/* or apps/* files created/modified)
- ❌ Git commit or push
- ❌ Dependency installation
- ❌ Build or deployment
- ❌ Phase advancement beyond Gate 1
- ❌ Repository synchronization or publishing

---

## Request

Supervisor review of corrected Gate 1 specifications with verification of:

1. **Wrangler 4 compatibility:** `wrangler: ^4.148.0` satisfies OpenNext 1.20.x peer dependency
2. **Next.js compatibility:** `next: ^15.5.29` satisfies OpenNext 1.20.x peer dependency
3. **OpenNext stable series:** `^1.20.0` captures current stable 1.x with verified peers
4. **No peer conflicts:** All three dependencies mutually compatible
5. **Preserved examples:** All authentication/workflow/configuration code unchanged

All work remains specifications-only. Implementation authorization required separately even if review passes.

---

**Submitted:** 2026-11-13  
**Kiro Session:** RecallFeed Gate 1 Corrections (Cycle 10)
