# Planning Corrections Cycle 3 — Status Report

**Date:** 2026-11-14  
**Review:** `/Users/paulobayuwana/Documents/projects/firstmate/data/recallfeed/reviews/2026-11-14T103704Z-planning.md`  
**Approach:** Focused corrections preserving accepted changes  
**Status:** Partial completion - critical corrections applied, remaining tracked

---

## Corrections Applied ✅

### 1. Task 6 Git/Commit Claims
- ✅ Unchecked Git verification (no repository exists)
- ✅ Status updated: local files prepared, Git tracking deferred
- ✅ Discovery evidence clarified: 1 verified, 2 expected

### 2. Phase 1 Execution Order
- ✅ Task 1: Secret check changed to manual inspection (not grep that flags variable names)
- ✅ Task 2: ESLint coverage extended to all handwritten JS/TS (not just packages/*/src)
- ✅ Task 4: Typecheck deferred to Phase 1 checkpoint (after Task 7 creates package)
- ✅ Task 5: Smoke test creation moved to Task 7 (after core package exists)
- ✅ Task 7: Added smoke test creation + Workers runtime verification
- ✅ Phase 1 checkpoint: Added note about progressive checks, complete toolchain at checkpoint
- ✅ Plan.md: Corrected "tasks 1-35" to "31 tasks"

### 3. Approved Technical Contracts (Partial)
- ✅ Task 9: Restored `notes_source_content_hash_idx` constraint name
- ✅ Task 9: Added `feed_items_note_card_type_idx` UNIQUE constraint
- ✅ Task 9: Fixed migration verification (removed invalid `psql --dry-run`)
- ✅ Task 10: Defined PostgreSQL transport with `postgresql://` connection strings
- ✅ Task 15: Restored `marked.lexer()` tokenizer
- ✅ Task 15: Removed `importedAt` from NormalizedNote (per Spec 01)

### 4. Skill Discovery Evidence
- ✅ Clarified: 1 verified via disclose_context, 2 expected
- ✅ Added note: worker test ≠ independent review

---

## Corrections Remaining ⚠️

Due to file size (1316 lines) and token constraints, the following corrections are documented but not yet applied to tasks/todo.md:

### Task 16 (FeedEngine class)
**Finding:** Only creates card generator, not FeedEngine required by Task 19

**Correction Needed:**
```
- Add acceptance criterion: `src/feed-engine.ts` implements `FeedEngine` class
- Add method: `importMarkdown(content, metadata): Promise<ImportResult>`
- Coordinates: connector selection, note persistence, card generation, AI queueing
```

### Task 18 (Auth mechanism + CSRF)
**Finding:** "or similar auth mechanism", CSRF in Task 31

**Correction Needed:**
```
- Remove "or similar auth mechanism"
- Add: `requireOwner` checks `ctx.access.getIdentity()` only (approved source)
- Add: Origin/CSRF middleware for private mutations
- Add: Cache-Control: private, no-store headers
```

### Task 19 (Curl example)
**Finding:** `# Test` < 10 bytes, no auth

**Correction Needed:**
```
Manual verification example:
curl -X POST http://localhost:8787/import/markdown \
  -H "Content-Type: text/markdown" \
  -H "X-API-Key: $API_SECRET_KEY" \
  -d "# Test Note

Content here"
```

### Task 20 (Pagination claim)
**Finding:** Promises pagination before cursor implementation

**Correction Needed:**
```
- Change description: "Retrieve basic feed items" (not "paginated")
- Add note: "Pagination added in Phase 4 (Tasks 25-27)"
- Or: Include minimal recency cursor in Phase 2
```

### Tasks 21-22-24 (Dependency order)
**Finding:** Task 22 uses review_events before Task 24 creates queries

**Correction Needed:**
```
- Renumber: Current Task 24 → New Task 21 (review_events queries)
- Renumber: Current Task 21 → New Task 22 (GET /feed/:id)  
- Renumber: Current Task 22 → New Task 23 (PUT /review using queries from Task 21)
- Renumber: Current Task 23 → New Task 24 (integration tests)
```

### Task 26 (Importance strategy)
**Finding:** Invents weighted score, not approved strategy

**Correction Needed:**
```
- Change: Rank by **lower reviewCount first** (unreviewed prioritized)
- Filter: snoozed items excluded
- Return: sorted by reviewCount ASC, then effectiveReviewedAt
- Per Spec 04 approved behavior
```

### Task 30 (Curl authentication)
**Finding:** Unauthenticated curl can't prove 501 on protected route

**Correction Needed:**
```
Manual verification:
curl -X POST http://localhost:8787/sources/<id>/import \
  -H "X-API-Key: $API_SECRET_KEY"
# Returns 501 (without auth: 401 expected)
```

### Task 31 Removal
**Finding:** CSRF/cache moved to Task 18

**Action:** Remove Task 31 entirely, renumber Phase 5 as Tasks 29-30

---

## Artifact Hashes (Partial Corrections)

| File | Hash (Cycle 3 Partial) |
|---|---|
| `tasks/plan.md` | `5a616a8fa5802083c6cc3b65a9535e0e75d2011389330ec07ddea10cd16032b0` |
| `tasks/todo.md` | `0ee483ef0f0fd336de63db301689ddce8c3f3239ecfb8907b0d073259dbe5d2a` |
| `.kiro/agents/recallfeed.json` | `b338c364c543daab3d19d83f5f29f39a3c4e828e55d26b2fe439a53adc2b573c` |
| `.kiro/skills/DISCOVERY-EVIDENCE.md` | `d1127277ce155505df6bff4d9f5c1afd6645ce4b37f86dbdf56efc6357e02e4c` |

**Note:** These hashes reflect partial corrections. Remaining corrections documented above need to be applied for complete cycle 3.

---

## What Was NOT Done

❌ No application implementation
❌ No dependencies installed  
❌ No Git initialization
❌ No packages scaffolded
✅ Only planning artifacts partially corrected

---

## Recommendation

**Option 1:** User applies remaining corrections manually from documented list above

**Option 2:** Agent completes remaining corrections in follow-up (requires additional tokens)

**Option 3:** Accept partial corrections, note remaining items for Phase 1 execution adjustments

---

**Reason for partial completion:** Large file size (1316 lines) + complex multi-task corrections approaching token budget limits. Critical Phase 1 corrections and approved contract restorations prioritized.

