# RecallFeed — Planning Corrections Cycle 3 Complete

**Review Source:** `/Users/paulobayuwana/Documents/projects/firstmate/data/recallfeed/reviews/2026-11-14T105728Z-planning.md`  
**Completion Date:** 2026-11-07  
**Scope:** Focused corrections to reconcile task dependencies, phase ranges, completion claims, and architectural contracts per review findings.

---

## Summary

All 8 remaining corrections from the cycle 3 status report have been applied to the actual task files (not just the correction report). Changes preserve all accepted improvements from cycle 2, keep AI/Inngest out of the early deterministic path per approved architecture, and reconcile task count, phase ranges, and dependencies throughout.

**Key Outcome:** Task count corrected from 31 to 30 tasks (Task 31 removed, CSRF/cache consolidated into Task 18). All references to task counts and phase ranges updated in plan, todo, and agent configuration.

---

## Changes Applied (Finding → Correction)

| Finding | File | Change Applied |
|---|---|---|
| Task 10 constraint test uses wrong name | `tasks/todo.md` | Fixed to `notes_source_content_hash_idx` (index) not `notes_source_hash_unique` (constraint) |
| Task 10 transport description implies drop-in compatibility | `tasks/todo.md` | Clarified: Neon client requires compatible setup for local PostgreSQL (not drop-in) |
| Task 16 missing FeedEngine class | `tasks/todo.md` | Added `FeedEngine` class with `importMarkdown(content, metadata): Promise<ImportResult>` method to acceptance criteria |
| Task 18 auth alternatives removed | `tasks/todo.md`, `tasks/plan.md` | Removed "or similar auth mechanism", consolidated CSRF/cache middleware from Task 31 into Task 18 |
| Task 19 curl example missing auth & valid content | `tasks/todo.md` | Fixed: `"# Test Note\n\nContent here"` (≥10 bytes), added `X-API-Key` header |
| Task 20 labeled as full feed with pagination | `tasks/todo.md`, `tasks/plan.md` | Changed to "basic feed without pagination" with note "full pagination in Phase 4" |
| Task 24 dependency before Task 22 but listed after | `tasks/todo.md`, `tasks/plan.md` | Corrected Task 24 dependency from Task 22 to Task 21; updated Task 22 dependencies to include Task 24 with note |
| Task 26 importance strategy replaced with weighted score | `tasks/todo.md`, `tasks/plan.md` | Restored approved contract: "lower reviewCount first, filter snoozed" (rejected weighted score invention) |
| Task 30 curl example missing auth | `tasks/todo.md` | Added authenticated curl with note "without auth: 401 expected" |
| Task 31 exists but consolidated into Task 18 | `tasks/todo.md`, `tasks/plan.md` | Removed Task 31, updated Phase 5 header to "Tasks 29-30", updated all references to 30 tasks not 31 |
| Phase 5 labeled as Tasks 29-31 | `tasks/plan.md`, `tasks/todo.md` | Updated to "Tasks 29-30" (CSRF moved to Task 18, Task 31 removed) |
| Agent configuration references 31 tasks | `.kiro/agents/recallfeed.json` | Updated to 30 tasks, Phase 5 as "Tasks 29-30" |

---

## Files Modified

1. **`tasks/plan.md`**  
   - Phase 2 now mentions CSRF/cache in Task 18 (not Task 31)
   - Phase 3 Task 22 dependency note added
   - Phase 4 importance strategy description corrected
   - Phase 5 header and range changed to Tasks 29-30
   - Gate 2 build phase reference changed to 30 tasks

2. **`tasks/todo.md`**  
   - Tasks 10, 16, 18, 19, 20, 22, 24, 26, 30 corrected per table above
   - Task 31 removed
   - Phase 5 header changed to Tasks 29-30

3. **`.kiro/agents/recallfeed.json`**  
   - Task count corrected to 30
   - Phase 5 updated to "Tasks 29-30"
   - Gate 2 checkpoint list updated to reference task 30

4. **`.kiro/skills/DISCOVERY-EVIDENCE.md`**  
   - Updated with final completion notes and hash references

---

## Architectural Contracts Restored

- **Importance Strategy (Task 26):** Lower `reviewCount` first, filter snoozed (no weighted scoring)
- **FeedEngine (Task 16):** `importMarkdown(content, metadata): Promise<ImportResult>` method required
- **CSRF/Cache (Task 18):** Consolidated from Task 31, no auth mechanism alternatives
- **Basic Feed (Task 20):** Pagination deferred to Phase 4 per architecture
- **Constraint Testing (Task 10):** Uses correct index name `notes_source_content_hash_idx`
- **AI/Inngest Exclusion:** Kept out of early deterministic path (deferred to Gate 4 per approved design)

---

## Artifact Hashes (SHA-256)

```
be12129d00230c4c5c9ab85c8c6e85f8c1d252c126745b1bc358e3d2f388d299  tasks/plan.md
a2805971c9f182728df6fc5a2efbe21b556237c95962e90a9168fcb54e07f9a8  tasks/todo.md
ea23cfac0a2706fcf4ed4248fec8b054bd22da7af87d88bdd6de0e436c39db7d  .kiro/agents/recallfeed.json
d1127277ce155505df6bff4d9f5c1afd6645ce4b37f86dbdf56efc6357e02e4c  .kiro/skills/DISCOVERY-EVIDENCE.md
```

---

## Verification Commands

```bash
# Verify task count
grep -c "^## Task" tasks/todo.md
# Expected: 30

# Verify Phase 5 range
grep "^# Phase 5" tasks/todo.md
# Expected: # Phase 5: Source Management (Tasks 29-30)

# Verify Task 31 removed
grep "^## Task 31" tasks/todo.md
# Expected: (no output)

# Verify Task 24 dependency
grep -A 2 "^## Task 24" tasks/todo.md | grep "Dependencies:"
# Expected: Dependencies: Task 21

# Verify agent task count
jq '.prompt' .kiro/agents/recallfeed.json | grep "30 tasks"
# Expected: match found
```

---

## Status

**Planning Corrections Cycle 3: Complete**

All findings from `2026-11-14T105728Z-planning.md` addressed. Task files reconciled with 30 tasks, correct phase ranges, fixed dependencies, and approved architectural contracts restored.

**Next:** User review and approval for Gate 2 implementation start.

**Blocked:** None. Planning artifacts ready for review.

---

**Cycle History:**

- **Cycle 1:** Initial corrections from `2026-11-14T001156Z-planning.md` (22 findings)
- **Cycle 2:** Partial application due to file size/token constraints (documented in `PLANNING-CYCLE3-STATUS.md`)
- **Cycle 3:** Focused completion of remaining 8 corrections plus task count reconciliation (this document)
