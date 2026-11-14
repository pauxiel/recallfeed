# RecallFeed Planning Corrections Cycle 2 — Complete

**Date:** 2026-11-14  
**Review File:** `/Users/paulobayuwana/Documents/projects/firstmate/data/recallfeed/reviews/2026-11-14T001156Z-planning.md`  
**Status:** All corrections complete, ready for user review  
**Verdict Requested:** Planning-only approval (not Phase 1 or full Gate 2 authorization)

---

## Summary

Planning artifacts corrected per 2026-11-14 review findings. All 5 required corrections applied:

1. ✅ Phase 1 conflicts resolved (ESLint, TypeScript, Vitest, Git)
2. ✅ Native skill setup completed with discovery evidence
3. ✅ Early path reorganized (feed-engine, Worker entry before POST /import/markdown)
4. ✅ API contracts restored to exact Spec 05 requirements
5. ✅ Execution records vs checkpoints clarified

**No application implementation begun.** Planning-only scope maintained.

---

## Artifacts Corrected

| File | Status | Hash |
|---|---|---|
| `tasks/plan.md` | ✅ Corrected | `e0aee1a900f3b1e61f5e28dae249f62d567ca1d5f6ed5c6b00d89e077f8eff8f` |
| `tasks/todo.md` | ✅ Corrected | `22b0cd7c2773b5eed84ddb70d9a0ead6e68f565b2899c7b18ca7d940401b8b0a` |
| `.kiro/agents/recallfeed.json` | ✅ Corrected | `b338c364c543daab3d19d83f5f29f39a3c4e828e55d26b2fe439a53adc2b573c` |

**Verification command:**
```bash
shasum -a 256 tasks/plan.md tasks/todo.md .kiro/agents/recallfeed.json
```

---

## Planning Review 2 Findings — Resolution Summary

### Finding 1: Phase 1 Conflicts with Agreed Policy

**Issues:**
- Task 2 excluded `*.test.ts` from max-lines
- Task 4 required per-package configs before packages existed
- Task 5 called empty test suite a pass
- Task 1 didn't explicitly commit existing specs or check for secrets

**Resolutions:**
- ✅ Task 2: Removed `*.test.ts` exclusion — max-lines applies to all handwritten JS/TS including tests
- ✅ Task 4: Creates root `tsconfig.json` (not just base), verification uses correct config
- ✅ Task 5: Creates Worker-runtime smoke test (verifies `crypto.randomUUID()` works)
- ✅ Task 1: Added explicit staging of existing `.kiro/` with secrets/private-artifact check

### Finding 2: Native Skill Setup Deferred, Not Completed

**Issue:** Skills remained `.kiro/skills/<name>.md`, not proper `<name>/SKILL.md` structure

**Resolution:**
- ✅ Restructured to `.kiro/skills/planning-and-task-breakdown/SKILL.md` (and others)
- ✅ Created `.kiro/skills/README.md` with attribution (Addy Osmani, MIT, source URL)
- ✅ Verified discovery with `disclose_context` tool (successful load)
- ✅ Created `.kiro/skills/DISCOVERY-EVIDENCE.md` with proof

**Evidence:** See `.kiro/skills/DISCOVERY-EVIDENCE.md`

### Finding 3: Early Path Consumes Work Scheduled Later

**Issues:**
- Task 18 promised original cards but feed-engine only appeared in Tasks 19-20
- Task 18 verification used localhost:8787 but Worker entry was Task 31
- Task 18 didn't explicitly delegate through FeedEngine contract
- PostgreSQL test transport not declared

**Resolutions:**
- ✅ Task 16: feed-engine package with original card generator MOVED into Phase 2 (before Task 19)
- ✅ Task 17: Minimal Worker entry + wrangler.toml created BEFORE Task 19
- ✅ Task 18: Real authorization guards with negative tests BEFORE Task 19
- ✅ Task 19: POST /import/markdown explicitly delegates to `FeedEngine.importMarkdown()` contract
- ✅ Tasks 20-21: GET /feed routes (feed-engine already set up in Task 16)
- ✅ Task 10: Declares concrete PostgreSQL test transport (local PostgreSQL OR Neon HTTP test DB, must document choice)

### Finding 4: API Tasks Change Approved Contracts

**Issues:**
- Task 18 response: `{sourceId, notesCreated, notesUpdated}` (wrong per Spec 05)
- Task 26 introduced PUT /feed/:id/publish (Spec 05 has all actions on /review)
- Tasks 20-21 didn't explicitly require guards or negative tests
- Task 12 implied global contentHash upserts (should be source-scoped)
- Task 31 missing Origin/CSRF checks

**Resolutions:**
- ✅ Task 19: Spec 05 contract: `{sourceId, queued, notesImported, feedItemsCreated}`, 10 byte-100KB validation
- ✅ Task 22: All 6 actions on PUT /feed/:id/review (reviewed, saved, unsaved, snoozed, published, unpublished), invalid-action test
- ✅ Removed separate /publish endpoint (consolidated per Spec 05)
- ✅ Tasks 20-21: Explicitly require requireOwner guard, unauthenticated test, public DTO omissions
- ✅ Task 12: Clarified source-scoped `(source_id, content_hash)` deduplication, re-import test reuses source identity
- ✅ Task 31: Added Origin/CSRF checks for private mutations, Cache-Control: private headers

### Finding 5: Execution Records vs Checkpoints Inconsistent

**Issue:** Todo required review before every task, but plan offered "autonomous all of Gate 2"

**Resolution:**
- ✅ Clarified: Implemented/Verified/Reviewed tracking is per-task evidence collection
- ✅ Human review checkpoints are phase boundaries only (after tasks 7, 21, 24, 28, 31)
- ✅ Within-phase "Reviewed" means independent verification (test suite run, not manual approval per task)
- ✅ Phase advancement always requires human approval
- ✅ Task closing workflow corrected: implement → test → verify → commit (not commit before verification)

---

## Plan.md Key Changes

1. ✅ Updated Phase 1: Tasks 1-7 (Bootstrap & Foundation)
2. ✅ Updated Phase 2: Tasks 8-21 (Early Working Path with feed-engine, Worker entry, auth guards before POST /import/markdown)
3. ✅ Updated Phase 3: Tasks 22-24 (Review & Publish Mutations per Spec 05)
4. ✅ Updated Phase 4: Tasks 25-28 (Expanded Features)
5. ✅ Updated Phase 5: Tasks 29-31 (Source Management & CSRF Protection)
6. ✅ Added master brief reference: "Governed by: User's supervisor master brief and Gate 1 approval boundaries"
7. ✅ Clarified checkpoint review: "Human review at each phase boundary (not task-by-task)"
8. ✅ Updated skill paths to native structure (`.kiro/skills/<name>/SKILL.md`)

---

## Todo.md Complete Rewrite

**Task count:** 31 tasks across 5 phases (was 35 tasks across 6 phases)

**All tasks now include:**
- Explicit Implemented/Verified/Reviewed Status section
- Cross-references to exact spec sections
- PostgreSQL integration requirements (not SQLite)
- Real authorization requirements (not placeholders)
- Approved API contracts from Spec 05
- Proper verification commands and negative tests

**Phase breakdown:**
- Phase 1 (1-7): Bootstrap with proper toolchain setup
- Phase 2 (8-21): Early working path complete at Task 21
- Phase 3 (22-24): Review/publish mutations per Spec 05
- Phase 4 (25-28): Additional strategies and pagination
- Phase 5 (29-31): Source management and security hardening

---

## Agent Instructions Updated

**Key updates:**
- ✅ Corrected task counts: 31 tasks across 5 phases
- ✅ Updated Phase 1: tasks 1-7
- ✅ Listed all 5 phases with correct task ranges
- ✅ Added master brief reference
- ✅ Updated skill paths to native structure
- ✅ Corrected task workflow: verify BEFORE commit
- ✅ Added corrections summary from 2026-11-14 review
- ✅ Clarified checkpoint review boundaries (human approval at phase boundaries)

---

## Native Skill Setup Complete

**Structure:**
```
.kiro/skills/
├── README.md (attribution: Addy Osmani, MIT, source URL)
├── DISCOVERY-EVIDENCE.md (verification proof)
├── planning-and-task-breakdown/
│   └── SKILL.md (with frontmatter)
├── incremental-implementation/
│   └── SKILL.md (with frontmatter)
└── spec-driven-development/
    └── SKILL.md (with frontmatter)
```

**Discovery verified:** `disclose_context` tool successfully loaded `planning-and-task-breakdown` skill.

**Evidence:** See `.kiro/skills/DISCOVERY-EVIDENCE.md`

---

## What Was NOT Done

❌ **No application implementation:**
- No packages scaffolded
- No dependencies installed
- No Git repository initialized (Task 1 not begun)
- No code written
- No tests run
- No builds executed

✅ **Only planning artifacts corrected:**
- `tasks/plan.md` rewritten (5 phases, 31 tasks)
- `tasks/todo.md` completely replaced (all findings addressed)
- `.kiro/agents/recallfeed.json` updated (corrected instructions)
- `.kiro/skills/` restructured to native format (completed during planning-only scope)
- `.kiro/PLANNING-REVIEW-2-CORRECTIONS.md` created (tracking document)
- `.kiro/PLANNING-CYCLE2-COMPLETE.md` created (this file)
- `.kiro/PLANNING-ARTIFACTS-HASHES.txt` created (verification hashes)

---

## Requested User Action

**Review corrected planning artifacts:**

1. Read `tasks/plan.md` — Functional slice strategy with 5 phases, 31 tasks
2. Read `tasks/todo.md` — All 31 tasks with corrected requirements per review findings
3. Verify `.kiro/skills/DISCOVERY-EVIDENCE.md` — Native skill setup complete
4. Review `.kiro/PLANNING-REVIEW-2-CORRECTIONS.md` — Complete correction tracking

**Next step options:**

**Option A:** Approve corrected plan and authorize **Phase 1 only** (tasks 1-7)
- Agent implements Phase 1
- Stops at Phase 1 checkpoint for review
- Phase 2 requires separate approval

**Option B:** Request specific changes to corrected plan

**Option C:** Review plan first, decide on authorization later

**Not authorized by this review:** Neither "Phase 1" nor "all of Gate 2" implementation has been approved yet. This review validates planning corrections only.

---

## Verification Commands

**Verify file hashes:**
```bash
shasum -a 256 tasks/plan.md tasks/todo.md .kiro/agents/recallfeed.json
```

**Expected output:**
```
e0aee1a900f3b1e61f5e28dae249f62d567ca1d5f6ed5c6b00d89e077f8eff8f  tasks/plan.md
22b0cd7c2773b5eed84ddb70d9a0ead6e68f565b2899c7b18ca7d940401b8b0a  tasks/todo.md
b338c364c543daab3d19d83f5f29f39a3c4e828e55d26b2fe439a53adc2b573c  .kiro/agents/recallfeed.json
```

**Verify skill structure:**
```bash
ls -R .kiro/skills/
```

**Expected:** Three `<name>/SKILL.md` directories with README.md and DISCOVERY-EVIDENCE.md

---

## Approved Specifications Unchanged

Gate 1 specifications remain approved and unchanged:

- `.kiro/specs/01-core-domain.md` (approved cycle 10)
- `.kiro/specs/02-database-schema.md` (approved cycle 10)
- `.kiro/specs/03-connectors.md` (approved cycle 10)
- `.kiro/specs/04-feed-engine.md` (approved cycle 10)
- `.kiro/specs/05-authentication.md` (approved cycle 10)
- `.kiro/specs/06-inngest-workflows.md` (approved cycle 10)
- `.kiro/specs/07-ai-pipeline.md` (approved cycle 10)
- `.kiro/specs/08-reflection-feed.md` (approved cycle 10)
- `.kiro/specs/09-dev-recall.md` (approved cycle 10)

**All task requirements reconciled against these approved specs. No invented requirements.**

---

## Governance

**Governed by:** User's supervisor master brief and Gate 1 approval boundaries.

**Authorization boundaries:**
- Planning corrections complete (this document)
- Implementation authorization required before any code written
- Phase-by-phase advancement requires human approval at checkpoints
- Gate advancement requires explicit authorization

---

**Planning corrections cycle 2 complete. Awaiting user review and authorization decision.**

