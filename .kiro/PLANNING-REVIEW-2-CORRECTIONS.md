# Planning Review 2 - Corrections Applied

**Date:** 2026-11-14  
**Review File:** `/Users/paulobayuwana/Documents/projects/firstmate/data/recallfeed/reviews/2026-11-14T001156Z-planning.md`  
**Status:** Corrections in progress

## Corrections Completed

### 1. Native Skill Setup (COMPLETE ✅)

**Finding:** Skills remained flat `.kiro/skills/<name>.md`, not proper native structure.

**Resolution:**
- ✅ Moved to `.kiro/skills/<name>/SKILL.md` structure
- ✅ Created `.kiro/skills/README.md` with attribution (Addy Osmani, MIT, source URL)
- ✅ Verified discovery with `disclose_context` tool
- ✅ Created `.kiro/skills/DISCOVERY-EVIDENCE.md` with verification proof

**Evidence:** See `.kiro/skills/DISCOVERY-EVIDENCE.md`

### 2. Plan.md Corrections (COMPLETE ✅)

**Findings addressed:**
- ✅ Updated Phase 1 description: Task 1 now explicitly stages existing specs/planning with secrets check
- ✅ Updated Phase 1 tasks 1-7 list with correct descriptions
- ✅ Moved feed-engine and original card generator into Phase 2 (early path, not later)
- ✅ Reorganized phases to reflect early working path: import → persist → card → feed
- ✅ Updated task counts: Phase 1 (1-7), Phase 2 (8-21), Phase 3 (22-24), Phase 4 (25-28), Phase 5 (29-31)
- ✅ Added master brief reference: "Governed by: User's supervisor master brief and Gate 1 approval boundaries"
- ✅ Clarified checkpoint review: "Human review at each phase boundary (not task-by-task)"
- ✅ Updated skill paths to proper structure (`.kiro/skills/<name>/SKILL.md`)
- ✅ Added reference to skill discovery evidence

**Hash:** `e0aee1a900f3b1e61f5e28dae249f62d567ca1d5f6ed5c6b00d89e077f8eff8f`

### 3. Todo.md Corrections (COMPLETE ✅)

**All critical fixes applied:**

#### Issue 1: Phase 1 conflicts — FIXED ✅

- ✅ Task 1: Added explicit staging of existing `.kiro/` with secrets check
- ✅ Task 2: Removed `*.test.ts` exclusion — max-lines applies to all handwritten JS/TS including tests
- ✅ Task 4: Creates root `tsconfig.json` (not just base), verification command uses correct config
- ✅ Task 5: Creates Worker-runtime smoke test (not "passes on empty")
- ✅ Task 6: Documents already-complete native skill setup with evidence

#### Issue 3: Early path reorganization — FIXED ✅

- ✅ Task 16: feed-engine package with original card generator MOVED into Phase 2 (before Task 19)
- ✅ Task 17: Minimal Worker entry + wrangler.toml MOVED before POST /import/markdown
- ✅ Task 18: Real authorization guards with negative tests BEFORE Task 19
- ✅ Task 19: POST /import/markdown uses FeedEngine.importMarkdown contract (delegates, not duplicates)
- ✅ Tasks 20-21: GET /feed routes (feed-engine setup completed in Task 16)
- ✅ Task 10: Declares concrete PostgreSQL test transport (local PostgreSQL OR Neon HTTP test DB, must document which)

#### Issue 4: API contracts — FIXED ✅

- ✅ Task 19: Spec 05 response contract: `{sourceId, queued, notesImported, feedItemsCreated}`, 10 byte-100KB validation tests
- ✅ Task 22: All 6 review actions on PUT /feed/:id/review (reviewed, saved, unsaved, snoozed, published, unpublished), invalid-action test
- ✅ Removed Task 26 separate /publish endpoint (consolidated into Task 22 per Spec 05)
- ✅ Tasks 20-21: Explicitly require requireOwner guard, unauthenticated test, public DTO field omissions
- ✅ Task 12: Clarified source-scoped `(source_id, content_hash)` deduplication, re-import test reuses source identity
- ✅ Task 31: Added Origin/CSRF checks for private mutations, Cache-Control: private headers

#### Issue 5: Execution records — FIXED ✅

- ✅ Clarified checkpoint boundaries: Human approval at phase boundaries only (after tasks 7, 21, 24, 28, 31)
- ✅ Within-phase "Reviewed" means independent verification (test suite run), not manual approval per task
- ✅ Task closing workflow corrected: implement → test → verify → commit (not commit before verification)
- ✅ All tasks include Status section: Implemented (commit SHA) / Verified (command output) / Reviewed (evidence)

**Hash:** `22b0cd7c2773b5eed84ddb70d9a0ead6e68f565b2899c7b18ca7d940401b8b0a`

### 4. Agent Instructions Updated (COMPLETE ✅)

**Corrections applied:**
- ✅ Updated description: "planning corrections cycle 2 complete"
- ✅ Corrected task counts: 31 tasks across 5 phases
- ✅ Updated Phase 1: tasks 1-7 (was 1-4)
- ✅ Listed all 5 phases with correct task ranges
- ✅ Added master brief reference
- ✅ Updated skill paths to native structure
- ✅ Corrected task workflow: verify BEFORE commit (not after)
- ✅ Added key corrections summary from 2026-11-14 review
- ✅ Clarified checkpoint review boundaries

**Hash:** `b338c364c543daab3d19d83f5f29f39a3c4e828e55d26b2fe439a53adc2b573c`

## Corrections Remaining

**NONE — All corrections complete ✅**

## What Was NOT Done

❌ No application code written  
❌ No dependencies installed  
❌ No Git commits made  
❌ No packages scaffolded  
✅ Only planning artifacts corrected + skill setup completed within planning-only scope

