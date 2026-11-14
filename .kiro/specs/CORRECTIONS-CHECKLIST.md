# RecallFeed Corrections Checklist

**Date:** 2026-11-07  
**Status:** ✓ Complete

---

## Correction-to-File-and-Line

### 1. Markdown Content Passing ✓

| File | Lines | Change |
|---|---|---|
| `01-core-domain.md` | 15-30 | Removed `transientContent` from Source type |
| `01-core-domain.md` | 216-236 | Split `importSource()` into `importMarkdown(content, metadata)` + `importNotionSource(sourceId)` |
| `01-core-domain.md` | 145-148 | Added `content?: string` to ConnectorCredentials |
| `03-connectors.md` | 30-55 | Documented content passed via `credentials.content`, not source field |
| `03-connectors.md` | 92-95 | Changed `source.transientContent` to `credentials.content` |
| `04-feed-engine.md` | 25-95 | Rewrote import orchestration with explicit content parameter |

**Evidence:** Content passed through call chain without database storage.

---

### 2. Cloudflare Access Integration ✓

| File | Lines | Change |
|---|---|---|
| `05-authentication.md` | 200-260 | Removed "three unverified approaches" |
| `05-authentication.md` | 215-230 | Documented `ctx.access.getIdentity()` with Hono fallback |
| `05-authentication.md` | 235-285 | Added cookie acquisition flow (10 steps) |
| `05-authentication.md` | 290-320 | Next.js server-side cookie forwarding pattern |
| `05-authentication.md` | 325-340 | `@cloudflare/next-on-pages` adapter requirement |

**Evidence:** Uses documented Cloudflare API, defines frontend hosting clearly.

---

### 3. Placeholder AI Cards Removed ✓

| File | Lines | Change |
|---|---|---|
| `04-feed-engine.md` | 155-165 | Filter AI types from sync card creation |
| `04-feed-engine.md` | 168-185 | Throw error if AI type requested synchronously |
| `06-inngest-workflows.md` | 350-365 | Removed existence checks in enrichment |
| `06-inngest-workflows.md` | 370-395 | Always create AI cards after generation |

**Evidence:** AI cards created only after successful enrichment, not during sync import.

---

### 4. Error Sanitization ✓

| File | Lines | Change |
|---|---|---|
| `06-inngest-workflows.md` | 155-165 | try/catch in `ingestSourceFunction`, log only message+IDs |
| `06-inngest-workflows.md` | 378-385 | try/catch in `enrichNotesFunction`, log only message+noteId |
| `06-inngest-workflows.md` | 200-202 | Added: "never log credentials or note content" |

**Evidence:** Error handlers prevent private content in Inngest logs.

---

### 5. Duplicate Specs Reconciled ✓

| Action | Files |
|---|---|
| **Deleted** | `03-connector-interface.md` |
| **Deleted** | `05-api-contract.md` |
| **Deleted** | `08-reflection-feed-app.md` |
| **Deleted** | `09-dev-recall-app.md` |
| **Updated** | `AUDIT-REPORT.md` lines 88-115 (corrected checkmarks) |

**Evidence:** 12 spec files remain (down from 16). No conflicts.

---

### 6. Handoff System Verified ✓

| File | Status |
|---|---|
| `.kiro/agents/recallfeed.json` | Uses `instructions` field (verified correct) |
| `.kiro/hooks/notify-firstmate-review.json` | PostTaskExec trigger configured |
| `.kiro/hooks/scripts/notify-firstmate.sh` | Selection and retry logic correct |

**Smoke test result:**
```json
{"outcome":"created","saved":true,"announced":true}
```

**Gate 1 test result:**
```json
{"outcome":"created","id":"1794081540-FYJpda","request_id":"recallfeed-20261107-195751-gate1-corrections","saved":true}
```

**Evidence:** Two successful notifications with different request IDs. Hook selects newest unsubmitted request and prevents duplicates.

---

## Summary

| Correction | Lines Changed | Files Modified | Status |
|---|---|---|---|
| 1. Markdown content passing | ~60 | 3 specs | ✓ |
| 2. Access integration | ~85 | 1 spec | ✓ |
| 3. Placeholder AI removal | ~45 | 2 specs | ✓ |
| 4. Error sanitization | ~25 | 1 spec | ✓ |
| 5. Duplicate reconciliation | -4 files | 1 updated | ✓ |
| 6. Handoff verification | manual test | 3 files | ✓ |

**Total:** ~215 lines changed across 6 specifications  
**Files deleted:** 4 superseded specs  
**Review requests:** 2 submitted (smoke test + Gate 1 corrections)

---

**All corrections complete.** Awaiting Firstmate review before proceeding to implementation.
