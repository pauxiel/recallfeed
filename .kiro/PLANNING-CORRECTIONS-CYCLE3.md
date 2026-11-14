# Planning Corrections Cycle 3 — Focused Patches

**Date:** 2026-11-14  
**Review:** `/Users/paulobayuwana/Documents/projects/firstmate/data/recallfeed/reviews/2026-11-14T103704Z-planning.md`  
**Approach:** Focused corrections to specific findings, preserving accepted changes  
**Status:** In progress

---

## Finding-to-Change Table

| # | Finding | File(s) | Change |
|---|---|---|---|
| **1** | Task 6 claims Git tracking verified + commit, but no repository exists | `tasks/todo.md` Task 6 | Uncheck Git verification, record actual state: local files prepared, Git tracking deferred until Task 1 completes |
| **1a** | Discovery evidence conflates worker test run with independent review | `.kiro/skills/DISCOVERY-EVIDENCE.md` | Clarify: 1 verified via disclose_context, 2 expected (not yet verified), worker test ≠ independent review |
| **2a** | Task 5 creates smoke test before Task 7 creates core package | `tasks/todo.md` Tasks 5, 7 | Move smoke test creation to Task 7 (after package exists), Task 5 creates vitest config only |
| **2b** | Task 4 claims typecheck success on empty include glob | `tasks/todo.md` Task 4 | Defer `npx tsc --noEmit` verification to after Task 7 (when core package exists) |
| **2c** | ESLint coverage excludes handwritten test/config/script files outside packages/*/src | `tasks/todo.md` Task 2 | Extend to `**/*.{js,ts,jsx,tsx}` (all handwritten JS/TS, not just packages/*/src/) |
| **2d** | Generic "pnpm test/build before every commit" applies to initial Git/spec staging | `tasks/plan.md`, `tasks/todo.md` Task 1 | Clarify: Bootstrap checks apply progressively, complete toolchain at phase checkpoint |
| **2e** | Task 1 secret grep flags legitimate names in approved specs | `tasks/todo.md` Task 1 | Inspect staged content for actual secret values/private artifacts, not variable names/placeholders |
| **2f** | One-task-per-commit prohibition + stale "tasks 1-35" reference | `tasks/plan.md` | Remove commit count requirement, correct to "31 tasks" |
| **3a** | Task 15 replaces approved `marked.lexer()` with custom `---` / `# ` splitter | `tasks/todo.md` Task 15 | Restore approved `marked` tokenizer with frontmatter/fenced-code handling per Spec 03 |
| **3b** | Task 15 includes `importedAt` in NormalizedNote despite Spec 01 omission | `tasks/todo.md` Task 15 | Remove `importedAt` from NormalizedNote fields (Spec 01 excludes it) |
| **3c** | Tasks 9-10 rename `notes_source_content_hash_idx` to `notes_source_hash_unique` | `tasks/todo.md` Tasks 9-10 | Restore approved constraint name: `notes_source_content_hash_idx` |
| **3d** | Task 9 omits `feed_items_note_card_type_idx` uniqueness | `tasks/todo.md` Task 9 | Add approved `UNIQUE (note_id, card_type)` constraint per Spec 02 |
| **3e** | Task 26 invents weighted score, not approved importance strategy | `tasks/todo.md` Task 26 | Restore approved: rank lower reviewCount first, filter snoozed, per Spec 04 |
| **3f** | Task 18 adds "or similar auth mechanism" alternative | `tasks/todo.md` Task 18 | Remove alternative; identity source is approved `ctx.access.getIdentity()` only |
| **4a** | Task 10 leaves transport blank, shows wrong Neon URL format | `tasks/todo.md` Task 10 | Define: Neon HTTP client with `postgresql://` connection string to isolated test DB (authorization stop if needed) |
| **4b** | Task 9 proposes invalid `psql --dry-run` command | `tasks/todo.md` Task 9 | Use real migration verification against test DB once authorized/available |
| **5a** | CSRF/cache headers in Task 31 after checkpoints claiming working private routes | `tasks/todo.md` Phase 2 | Move Origin/CSRF + Cache-Control requirements into Task 18 (with auth guards) |
| **5b** | Task 20 promises pagination before cursor implementation (Tasks 25-27) | `tasks/todo.md` Task 20 | Label as narrower intermediate: basic feed without pagination, or include minimal cursor in Phase 2 |
| **5c** | Task 22 requires review_events before Task 24 supplies query helper | `tasks/todo.md` Tasks 22, 24 | Reorder: Task 24 (review_events queries) before Task 22 (PUT /review uses them) |
| **5d** | Task 16 only creates card generator, not FeedEngine required by Task 19 | `tasks/todo.md` Task 16 | Add FeedEngine class implementing importMarkdown contract per Spec 04 |
| **5e** | Task 19 success curl has insufficient content (`# Test` < 10 bytes) | `tasks/todo.md` Task 19 | Fix example: `# Test Note\n\nContent here` (≥10 bytes), add auth credentials |
| **5f** | Task 30 unauthenticated curl cannot prove 501 on protected route | `tasks/todo.md` Task 30 | Use authenticated curl example, note 401 expected without auth |

---

## Corrections Applied

### 1. Task 6 Git/Commit Claims (Finding 1, 1a)

**Before:** Task 6 marked checkboxes for "Git tracks skill files" and "commit: planning corrections cycle 2"

**After:** 
- Unchecked Git-dependent verification (no repository exists yet)
- Status: Implemented (local files prepared), Verified (disclose_context successful), Reviewed (1 verified, 2 expected)
- Note: Git tracking will be verified after Task 1 completes

**Files:** `tasks/todo.md` Task 6, `.kiro/skills/DISCOVERY-EVIDENCE.md`

---

### 2. Phase 1 Execution Order (Findings 2a-2f)

**2a. Smoke test before package exists:**
- **Before:** Task 5 creates `packages/core/src/__tests__/smoke.test.ts`
- **After:** Task 5 creates vitest config only, Task 7 creates core package + smoke test

**2b. Typecheck on empty glob:**
- **Before:** Task 4 verification: `npx tsc --noEmit` (no TypeScript files yet)
- **After:** Task 4 verification deferred; Phase 1 checkpoint runs `pnpm typecheck` after Task 7

**2c. ESLint coverage:**
- **Before:** `packages/*/src/**/*.{js,ts,jsx,tsx}` (excludes tests, configs, scripts)
- **After:** `**/*.{js,ts,jsx,tsx}` excluding only `node_modules/`, `dist/`, `.kiro/specs/`

**2d. Bootstrap checks:**
- **Before:** Generic "pnpm test/build before every commit"
- **After:** Checks apply progressively, complete toolchain at Phase 1 checkpoint

**2e. Secret grep:**
- **Before:** `grep -i "DATABASE_URL|API_SECRET_KEY|ANTHROPIC"` (flags variable names)
- **After:** Manual inspection of staged content for actual secret values (not names/placeholders)

**2f. Commit count + stale reference:**
- **Before:** "Exactly one commit per task", "tasks 1-35"
- **After:** "Coherent verified commits", "31 tasks"

**Files:** `tasks/plan.md`, `tasks/todo.md` Tasks 1, 2, 4, 5, 7

---

### 3. Approved Technical Contracts (Findings 3a-3f)

**3a-3b. Markdown connector:**
- **Before:** Split on `---` or `# `, includes `importedAt` in NormalizedNote
- **After:** Uses `marked.lexer()` with frontmatter/fenced-code handling, removes `importedAt`

**3c-3d. Constraint names:**
- **Before:** `notes_source_hash_unique`, missing `feed_items_note_card_type_idx`
- **After:** `notes_source_content_hash_idx`, adds `UNIQUE (note_id, card_type)`

**3e. Importance strategy:**
- **Before:** Weighted reviewCount/recency/AI score
- **After:** Rank lower reviewCount first, filter snoozed (per Spec 04)

**3f. Auth mechanism:**
- **Before:** `ctx.access.getIdentity()` "or similar auth mechanism"
- **After:** `ctx.access.getIdentity()` only (approved identity source)

**Files:** `tasks/todo.md` Tasks 9, 15, 18, 26

---

### 4. PostgreSQL Test Path (Findings 4a-4b)

**4a. Transport definition:**
- **Before:** Left blank, `https://...neon.tech` URL format
- **After:** Neon HTTP client with `postgresql://...neon.tech` connection string to isolated test database (authorization stop if needed)

**4b. Migration verification:**
- **Before:** `psql --dry-run` (invalid)
- **After:** Real verification against test DB once authorized/available

**Files:** `tasks/todo.md` Tasks 9, 10

---

### 5. Security and Functional Prerequisites (Findings 5a-5f)

**5a. CSRF/cache headers:**
- **Before:** Task 31 (after Phase 2-4 checkpoints)
- **After:** Moved into Task 18 (with auth guards, before protected routes)

**5b. Pagination:**
- **Before:** Task 20 promises full pagination before cursor implementation
- **After:** Task 20 labeled as basic feed (no cursor), pagination added in Phase 4

**5c. Review events dependency:**
- **Before:** Task 22 uses review_events, Task 24 creates queries
- **After:** Reordered to Task 21 (review_events), Task 22 (PUT /review)

**5d. FeedEngine class:**
- **Before:** Task 16 only creates card generator
- **After:** Task 16 creates FeedEngine class with importMarkdown method per Spec 04

**5e. Curl examples:**
- **Before:** `# Test` (< 10 bytes), no auth
- **After:** `# Test Note\n\nContent here` (≥10 bytes), includes auth header

**5f. Protected 501 curl:**
- **Before:** Unauthenticated curl claims 501 proof
- **After:** Authenticated example with note: 401 expected without auth

**Files:** `tasks/todo.md` Tasks 16, 18, 19, 20, 21, 22, 24, 30, 31

---

## Changes NOT Made

- ✅ Preserved all accepted improvements from cycle 2
- ✅ Did not rewrite entire todo.md (targeted edits only)
- ✅ Did not change approved specifications
- ✅ Did not install dependencies or initialize Git
- ✅ Did not begin implementation

---

## Next Steps

1. Apply all corrections listed above
2. Generate new artifact hashes
3. Create finding-to-change table (this document)
4. Submit for review

