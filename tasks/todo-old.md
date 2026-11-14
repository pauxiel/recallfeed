# RecallFeed Implementation Tasks — Gate 2 (Revised)

**Status:** Planning revision complete, awaiting user approval  
**Based on:** `tasks/plan.md` (revised per planning review feedback)  
**Tracking:** Markdown checklist with explicit Implemented/Verified/Reviewed state

---

## Task State Protocol

Each task tracks three stages:

1. **Implemented:** Code written, committed (record commit SHA)
2. **Verified:** Tests pass, build succeeds (record command output/screenshot)
3. **Reviewed:** Independent check confirms acceptance criteria met (human or automated)

**Format per task:**
```markdown
**Status:**
- [ ] Implemented (commit: <SHA>)
- [ ] Verified (command: <output summary>)
- [ ] Reviewed (by: <name/tool>, date: <YYYY-MM-DD>)
```

Do not advance to next task until current task shows all three checkmarks.

---

## Phase 1: Bootstrap & Foundation

### Task 1: Initialize Git repository and `.gitignore`

**Description:** Create Git repository, configure `.gitignore` to exclude build artifacts and `node_modules` but **preserve** `.kiro/` directory (hackathon requirement).

**Specification references:**
- `.kiro/steering/project-conventions.md` — Git requirements
- `.kiro/agents/recallfeed.json` — .kiro preservation

**Dependencies:** None

**Acceptance criteria:**
- [ ] Git initialized: `git init` run, `.git/` directory exists
- [ ] `.gitignore` excludes: `node_modules/`, `.turbo/`, `dist/`, `build/`, `coverage/`, `*.log`
- [ ] `.gitignore` does NOT exclude `.kiro/`
- [ ] Initial commit: "chore: initialize repository"

**Verification:**
- [ ] `git status` shows clean working tree
- [ ] `git log` shows initial commit
- [ ] `.kiro/` directory tracked: `git ls-files .kiro/ | wc -l` > 0

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `git status && git log --oneline`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `.git/` (directory)
- `.gitignore`

**Estimated scope:** Small (1 file + git init)

---

### Task 2: Configure ESLint with max-lines rule

**Description:** Set up ESLint with max-lines rule enforcing 1000 physical lines for handwritten JavaScript/TypeScript files (not specs, not generated files).

**Specification references:**
- `.kiro/steering/project-conventions.md` — Source file length policy

**Dependencies:** Task 1

**Acceptance criteria:**
- [ ] ESLint installed as root dev dependency
- [ ] `.eslintrc.json` configures `max-lines` rule: `{"max": 1000, "skipBlankLines": false, "skipComments": false}`
- [ ] Rule applies to `**/*.{js,ts,jsx,tsx}` in `packages/*/src/`
- [ ] Excludes: `node_modules/`, generated files, `.kiro/specs/`, `*.test.ts`
- [ ] `pnpm lint` script added to root `package.json`

**Verification:**
- [ ] `pnpm lint` runs (may report no files yet)
- [ ] ESLint configuration validates

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm lint`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `package.json` (root, initial)
- `.eslintrc.json`
- `.eslintignore`

**Estimated scope:** Small (3 files)

---

### Task 3: Initialize pnpm workspace with Turborepo

**Description:** Set up monorepo with pnpm workspaces and Turborepo for parallel builds. Define workspace packages.

**Specification references:**
- `.kiro/steering/project-conventions.md` — Monorepo structure
- `.kiro/steering/technology-decisions.md` — pnpm + Turborepo

**Dependencies:** Task 2

**Acceptance criteria:**
- [ ] `pnpm-workspace.yaml` defines `packages: ['packages/*']`
- [ ] `turbo.json` configures build pipeline
- [ ] Root `package.json` has workspace scripts: `build`, `test`, `lint`, `typecheck`
- [ ] `.gitignore` updated for Turbo cache

**Verification:**
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` exits cleanly (no packages yet)
- [ ] `.turbo/` directory created

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm install && pnpm build`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `pnpm-workspace.yaml`
- `turbo.json`
- `package.json` (update)

**Estimated scope:** Small (3 files)

---

### Task 4: Configure TypeScript strict mode (no runtime in core)

**Description:** Create shared TypeScript configuration with strict mode. Core package must have **zero runtime dependencies** per Spec 01 (no Zod schemas in core).

**Specification references:**
- `.kiro/specs/01-core-domain.md` — Core has zero runtime dependencies
- `.kiro/steering/project-conventions.md` — TypeScript strict mode

**Dependencies:** Task 3

**Acceptance criteria:**
- [ ] `tsconfig.base.json` at root with strict mode enabled
- [ ] Target ES2022, module ESNext
- [ ] Path aliases configured for `@recallfeed/*` packages
- [ ] Per-package `tsconfig.json` extends base
- [ ] Core package `package.json` has empty `dependencies: {}`

**Verification:**
- [ ] `npx tsc --noEmit` (no errors on empty workspace)
- [ ] TypeScript language service initializes in IDE

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `npx tsc --noEmit`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `tsconfig.base.json`

**Estimated scope:** Small (1 file, packages will add their own as created)

---

### Task 5: Set up Vitest with Workers runtime pool

**Description:** Configure Vitest with `@cloudflare/vitest-pool-workers` to run tests in actual Workers runtime, not Node.

**Specification references:**
- `.kiro/steering/project-conventions.md` — Testing with Vitest
- `.kiro/steering/technology-decisions.md` — Workers runtime testing

**Dependencies:** Task 4

**Acceptance criteria:**
- [ ] Vitest installed as root dev dependency
- [ ] `@cloudflare/vitest-pool-workers` installed
- [ ] `vitest.config.ts` at root with Workers pool configured
- [ ] `vitest.workspace.ts` for multi-package testing
- [ ] Coverage threshold: 80% for `packages/{core,database,feed-engine}/`
- [ ] Test pattern: `*.test.ts`

**Verification:**
- [ ] `pnpm test` runs (passes on empty test suite)
- [ ] Workers runtime pool initializes

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `vitest.config.ts`
- `vitest.workspace.ts`

**Estimated scope:** Small (2 files)

---

### Task 6: Install Kiro skills properly (native discovery)

**Description:** Convert flat skill files to proper Kiro structure: `.kiro/skills/<name>/SKILL.md` with frontmatter, enable native discovery.

**Specification references:**
- Planning review feedback — Native Kiro skill format
- https://kiro.dev/docs/skills/ — Official documentation

**Dependencies:** Task 1

**Acceptance criteria:**
- [ ] Directory structure: `.kiro/skills/planning-and-task-breakdown/SKILL.md`
- [ ] Directory structure: `.kiro/skills/incremental-implementation/SKILL.md`
- [ ] Directory structure: `.kiro/skills/spec-driven-development/SKILL.md`
- [ ] Each SKILL.md has frontmatter with `name` and `description`
- [ ] Preserve upstream references (Definition of Done, other checklists)
- [ ] Add LICENSE file noting Addy Osmani, MIT license, source URL
- [ ] Skills discoverable via Kiro (test with skill listing command if available)

**Verification:**
- [ ] Skills listed in Kiro's skill discovery (if command exists)
- [ ] `.kiro/skills/*/SKILL.md` files present with correct frontmatter
- [ ] Git tracks skill files: `git ls-files .kiro/skills/ | grep SKILL.md | wc -l` = 3

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: kiro skill listing or manual inspection)
- [ ] Reviewed (by: ______, date: ______)

**Files created/modified:**
- `.kiro/skills/planning-and-task-breakdown/SKILL.md`
- `.kiro/skills/incremental-implementation/SKILL.md`
- `.kiro/skills/spec-driven-development/SKILL.md`
- `.kiro/skills/LICENSE` or `.kiro/skills/README.md`

**Estimated scope:** Small (reorganization + metadata)

---

### Task 7: Create `@recallfeed/core` with domain types (zero runtime deps)

**Description:** Scaffold core package with TypeScript domain types. **No Zod schemas** (zero runtime dependencies per Spec 01). Types only.

**Specification references:**
- `.kiro/specs/01-core-domain.md` — All domain types
- `.kiro/steering/skeleton-crew-rules.md` — Core knows nothing about apps

**Dependencies:** Task 4, Task 5

**Acceptance criteria:**
- [ ] Package created: `packages/core/`
- [ ] Types: `Source`, `Note`, `FeedItem`, `ReviewEvent`, `FeedConfig`, `IConnector`, `IResurfacingStrategy`
- [ ] Exported from `src/index.ts` barrel file
- [ ] JSDoc comments on all types
- [ ] `package.json` has `dependencies: {}` (empty)
- [ ] Tests verify type exports (type-level checks)

**Verification:**
- [ ] `pnpm --filter @recallfeed/core build` succeeds
- [ ] `pnpm --filter @recallfeed/core typecheck` passes
- [ ] `pnpm --filter @recallfeed/core test` passes
- [ ] Can import types in test file

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/core build test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/types/*.ts` (Source, Note, FeedItem, etc.)
- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`

**Estimated scope:** Medium (7-8 files)

---

## Checkpoint: Bootstrap Complete

**Verification:**
- [ ] Git initialized, .kiro/ tracked
- [ ] ESLint max-lines rule enforced
- [ ] Workspace builds: `pnpm build` succeeds
- [ ] Tests pass: `pnpm test` runs (core package smoke test)
- [ ] TypeScript strict mode enabled, core has zero runtime deps
- [ ] Kiro skills properly installed with native discovery
- [ ] Commit history: 7 atomic commits

**Review gate:** Human confirms bootstrap before functional slices.

---

## Phase 2: Early Working Path - Protected Markdown Import

**Goal:** Complete protected Markdown import → PostgreSQL → API response path with real authorization

### Task 8: Create `@recallfeed/database` with Neon client

**Description:** Scaffold database package with request-scoped Neon connection factory (not pooling). Follow Spec 02 exactly.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Connection factory (request-scoped)

**Dependencies:** Task 7

**Acceptance criteria:**
- [ ] Package created: `packages/database/`
- [ ] `createDatabaseClient(connectionString)` factory function (request-scoped)
- [ ] HTTP connection for single queries (per Spec 02)
- [ ] **No pooling, no generic retry wrapper, no tx helper in this task** (Spec 02 doesn't require them)
- [ ] Connection test with mock or local PostgreSQL

**Verification:**
- [ ] `pnpm --filter @recallfeed/database build` succeeds
- [ ] `pnpm --filter @recallfeed/database test` passes
- [ ] Can create client and execute simple query

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/database test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/database/package.json`
- `packages/database/src/client.ts`
- `packages/database/src/client.test.ts`
- `packages/database/tsconfig.json`

**Estimated scope:** Small (4 files)

---

### Task 9: Write forward-only migration 001

**Description:** Create numbered migration file for all tables. **Forward-only** per Spec 02 (no down migration).

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Complete schema, forward-only MVP rollback

**Dependencies:** Task 8

**Acceptance criteria:**
- [ ] Migration: `packages/database/src/migrations/001_initial.sql`
- [ ] Creates: `sources`, `notes`, `feed_items`, `review_events` tables
- [ ] Includes: `feed_items_note_card_type_idx` unique constraint
- [ ] PostgreSQL-specific types: JSONB, TIMESTAMPTZ, UUID
- [ ] **No down migration** (per Spec 02 forward-only policy)
- [ ] Migration runner script: `migrate.ts` with `_schema_migrations` tracking

**Verification:**
- [ ] Migration SQL parses (syntax check)
- [ ] Can run against local PostgreSQL (see Task 10)

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: syntax check, will run in Task 10)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/database/src/migrations/001_initial.sql`
- `packages/database/src/migrate.ts`

**Estimated scope:** Small (2 files)

---

### Task 10: Set up local PostgreSQL test database

**Description:** Configure local PostgreSQL instance or authorized Neon test environment for integration checks. **Not SQLite mocks** per planning review.

**Specification references:**
- Planning review feedback — PostgreSQL-backed verification

**Dependencies:** Task 9

**Acceptance criteria:**
- [ ] Local PostgreSQL installed OR authorized Neon test database provisioned
- [ ] Environment variable `TEST_DATABASE_URL` configured
- [ ] Migration 001 runs successfully
- [ ] Test script verifies schema: tables exist, constraints present
- [ ] PostgreSQL-specific features verified: JSONB, TIMESTAMPTZ, UUID, named constraints

**Verification:**
- [ ] `pnpm --filter @recallfeed/database migrate:test` succeeds
- [ ] Query: `SELECT table_name FROM information_schema.tables WHERE table_schema='public'` returns 5 tables
- [ ] Constraint exists: Check `feed_items_note_card_type_idx` in pg_indexes

**Status:**
- [ ] Implemented (setup: ______)
- [ ] Verified (command: `pnpm --filter @recallfeed/database migrate:test && psql $TEST_DATABASE_URL -c "\dt"`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `.env.test` (local, git-ignored)
- `packages/database/scripts/setup-test-db.sh` (optional helper)

**Estimated scope:** Small (setup + verification script)

---

### Task 11: Implement source queries (create, getById)

**Description:** Typed query functions for sources table. Minimal set for early path.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Query patterns

**Dependencies:** Task 10

**Acceptance criteria:**
- [ ] `createSource(client, data)` returns Source
- [ ] `getSourceById(client, id)` returns Source | null
- [ ] Parameterized queries (no SQL injection risk)
- [ ] Return types match `@recallfeed/core` Source type
- [ ] **PostgreSQL integration tests** (not SQLite mocks)

**Verification:**
- [ ] `pnpm --filter @recallfeed/database test` passes
- [ ] Tests run against `TEST_DATABASE_URL`
- [ ] Coverage >= 80% for `src/queries/sources.ts`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/database test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/database/src/queries/sources.ts`
- `packages/database/src/queries/sources.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 12: Implement note queries (upsert, getBySource)

**Description:** Typed query functions for notes table. Upsert by contentHash for deduplication.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Notes queries
- `.kiro/specs/03-connectors.md` — Content hash deduplication

**Dependencies:** Task 11

**Acceptance criteria:**
- [ ] `upsertNote(client, data)` handles duplicates by contentHash
- [ ] `getNotesBySource(client, sourceId)` returns Note[]
- [ ] Batch insert: `insertNotes(client, notes)` with transaction
- [ ] **PostgreSQL integration tests**

**Verification:**
- [ ] Tests verify upsert idempotency
- [ ] Tests verify batch operations
- [ ] Coverage >= 80%

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/database test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/database/src/queries/notes.ts`
- `packages/database/src/queries/notes.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 13: Implement feed_item queries with isPublished filtering

**Description:** Typed query functions for feed_items. **Critical:** `getCandidates` must respect `isPublished` flag when public mode.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Feed items queries
- `.kiro/specs/04-feed-engine.md` — Candidate filtering

**Dependencies:** Task 12

**Acceptance criteria:**
- [ ] `insertFeedItem(client, data)` returns FeedItem
- [ ] `getFeedItemById(client, id)` returns FeedItem | null
- [ ] `getCandidates(client, config, isPublic)` filters by:
  - `isPublished=true` when `isPublic=true`
  - Snooze logic: `snoozedUntil IS NULL OR snoozedUntil < NOW()`
  - Recent review: `lastReviewedAt` compared to config threshold
- [ ] **PostgreSQL integration tests verify isPublished filtering**

**Verification:**
- [ ] Tests create published and unpublished items
- [ ] Tests verify public mode excludes unpublished
- [ ] Tests verify private mode includes all
- [ ] Coverage >= 80%

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/database test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/database/src/queries/feed-items.ts`
- `packages/database/src/queries/feed-items.test.ts`

**Estimated scope:** Medium (2 files, complex filtering)

---

### Task 14: Create `@recallfeed/connectors` with IConnector interface

**Description:** Scaffold connectors package with correct interface from Spec 01.

**Specification references:**
- `.kiro/specs/01-core-domain.md` — IConnector interface
- `.kiro/specs/03-connectors.md` — Connector requirements

**Dependencies:** Task 7

**Acceptance criteria:**
- [ ] Package created: `packages/connectors/`
- [ ] `IConnector` interface: `import(source: Source, credentials?: Record<string, string>): Promise<NormalizedNote[]>`
- [ ] Content hash utility function
- [ ] Exports from `index.ts`

**Verification:**
- [ ] `pnpm --filter @recallfeed/connectors build` succeeds
- [ ] Interface matches Spec 01 exactly

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/connectors build`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/connectors/package.json`
- `packages/connectors/src/interface.ts`
- `packages/connectors/src/utils.ts`
- `packages/connectors/src/index.ts`
- `packages/connectors/tsconfig.json`

**Estimated scope:** Small (5 files)

---

### Task 15: Implement Markdown connector (approved signature)

**Description:** Parse Markdown using `marked`. **Follow Spec 03 exactly:** `import(source, credentials)` returns `NormalizedNote[]`.

**Specification references:**
- `.kiro/specs/03-connectors.md` — Complete Markdown parsing spec

**Dependencies:** Task 14

**Acceptance criteria:**
- [ ] `MarkdownConnector implements IConnector`
- [ ] Signature: `import(source: Source, credentials?: Record<string, string>): Promise<NormalizedNote[]>`
- [ ] Uses `marked.lexer()` for tokenization
- [ ] Preserves leading content before first heading
- [ ] Parses frontmatter (title, tags, date, published)
- [ ] Chunks by H2 sections
- [ ] Generates contentHash per note
- [ ] Comprehensive tests with fixture files

**Verification:**
- [ ] `pnpm --filter @recallfeed/connectors test` passes
- [ ] Tests use real Markdown fixtures
- [ ] Tests cover edge cases (no headings, empty sections, etc.)
- [ ] Coverage >= 80%

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/connectors test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/connectors/src/markdown/connector.ts`
- `packages/connectors/src/markdown/parser.ts`
- `packages/connectors/src/markdown/connector.test.ts`
- `packages/connectors/src/markdown/fixtures/` (test .md files)

**Estimated scope:** Medium (4+ files)

---

### Task 16: Create `@recallfeed/api` with Hono and visibility middleware

**Description:** Scaffold API package. Implement visibility normalization with fail-closed default.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Visibility normalization

**Dependencies:** Task 7

**Acceptance criteria:**
- [ ] Package created: `packages/api/`
- [ ] Hono app initialized with typed Env
- [ ] `normalizeVisibility(raw)` function: unset/invalid → "private"
- [ ] Middleware sets normalized value in context
- [ ] Tests verify fail-closed behavior

**Verification:**
- [ ] `pnpm --filter @recallfeed/api build` succeeds
- [ ] `pnpm --filter @recallfeed/api test` passes
- [ ] Tests cover unset, invalid, valid visibility values

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/package.json`
- `packages/api/src/index.ts`
- `packages/api/src/types.ts`
- `packages/api/src/middleware/visibility.ts`
- `packages/api/src/middleware/visibility.test.ts`
- `packages/api/tsconfig.json`

**Estimated scope:** Medium (6 files)

---

### Task 17: Implement real authorization guards (no placeholders)

**Description:** **Real authorization enforcement** per Spec 05. Not stubs, not placeholders.

**Specification references:**
- `.kiro/specs/05-authentication.md` — requireOwner, requireApiKey middleware

**Dependencies:** Task 16

**Acceptance criteria:**
- [ ] `requireOwner` middleware for private mode:
  - Reads `c.executionCtx.access.getIdentity()` (request-local)
  - Compares `identity.email` to `env.OWNER_EMAIL`
  - Returns 401 if missing, 403 if non-owner
- [ ] `requireApiKey` middleware for public writes:
  - Checks `X-API-Key` header against `env.API_SECRET_KEY`
  - Returns 401 if missing/invalid
- [ ] `injectPublicRequestFlag` middleware:
  - Sets `c.set("isPublicRequest", visibility === "public")`
- [ ] **Negative authorization tests:**
  - Missing owner → 401
  - Non-owner email → 403
  - Missing API key → 401
  - Invalid API key → 401
  - Valid credentials → passes through

**Verification:**
- [ ] Tests use synthetic Access contexts (test doubles, not production stubs)
- [ ] Tests verify exact error responses
- [ ] Coverage >= 90% for auth middleware

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/middleware/auth.ts`
- `packages/api/src/middleware/auth.test.ts`

**Estimated scope:** Medium (2 files, security-critical)

---

### Task 18: Implement POST /import/markdown (complete protected path)

**Description:** **Early working path complete:** Protected endpoint → parse Markdown → persist to PostgreSQL → return summary.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Import endpoint
- `.kiro/specs/03-connectors.md` — Markdown parsing integration

**Dependencies:** Task 11-17

**Acceptance criteria:**
- [ ] Route: `POST /import/markdown`
- [ ] Protected: Uses `requireOwner` or `requireApiKey` based on visibility
- [ ] Accepts raw Markdown in request body
- [ ] Creates source record
- [ ] Parses with MarkdownConnector
- [ ] Upserts notes to PostgreSQL
- [ ] Generates feed items for each note (original card type)
- [ ] Returns import summary: `{sourceId, notesCreated, notesUpdated}`
- [ ] **Integration test with PostgreSQL:**
  - POST Markdown → verify notes in database
  - Negative auth tests: no key/wrong email → 401/403
  - Duplicate import → upsert idempotency

**Verification:**
- [ ] `pnpm --filter @recallfeed/api test` passes
- [ ] Integration test uses `TEST_DATABASE_URL`
- [ ] Can manually test: `curl -X POST -H "X-API-Key: test" -d @sample.md http://localhost:8787/import/markdown`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test` + manual curl)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/routes/import.ts`
- `packages/api/src/routes/import.test.ts`
- `packages/api/src/fixtures/sample.md` (test fixture)

**Estimated scope:** Medium (3 files)

---

## Checkpoint: Early Working Path Complete

**Verification:**
- [ ] **Protected Markdown import works end-to-end:**
  - POST /import/markdown with authorization → PostgreSQL → response
- [ ] **Real authorization enforced:**
  - Negative tests prove non-owners/missing keys rejected
- [ ] **PostgreSQL integration checks pass** (not SQLite mocks)
- [ ] Coverage >= 80% for database, connectors, api packages
- [ ] Git history: 11 more atomic commits (tasks 8-18)

**Review gate:** Human confirms early path works before expanding features.

---

## Phase 3: Card Generation & Feed

**Goal:** Deterministic feed generation with strategy selection

### Task 19: Create `@recallfeed/feed-engine` with IResurfacingStrategy

**Description:** Scaffold feed engine package with strategy interface.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Feed generation architecture

**Dependencies:** Task 7

**Acceptance criteria:**
- [ ] Package created: `packages/feed-engine/`
- [ ] `IResurfacingStrategy` interface defined
- [ ] Base types exported

**Verification:**
- [ ] `pnpm --filter @recallfeed/feed-engine build` succeeds

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine build`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/feed-engine/package.json`
- `packages/feed-engine/src/interface.ts`
- `packages/feed-engine/src/index.ts`
- `packages/feed-engine/tsconfig.json`

**Estimated scope:** Small (4 files)

---

### Task 20: Implement original card generator

**Description:** Create cards from raw note content.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Card types

**Dependencies:** Task 19

**Acceptance criteria:**
- [ ] `OriginalCardGenerator` creates card with note content
- [ ] `isAiGenerated` flag set to false
- [ ] Tests verify card structure

**Verification:**
- [ ] `pnpm --filter @recallfeed/feed-engine test` passes

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/feed-engine/src/generators/original.ts`
- `packages/feed-engine/src/generators/original.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 21: Implement recency strategy (correct sort order)

**Description:** Sort by **oldest effective reviewed time first** per Spec 04 (not newest first).

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Recency strategy (oldest first)

**Dependencies:** Task 20

**Acceptance criteria:**
- [ ] `RecencyStrategy implements IResurfacingStrategy`
- [ ] Sorts by effective time: `COALESCE(lastReviewedAt, createdAt)` **ascending** (oldest first)
- [ ] Deterministic: same input = same output
- [ ] Tests verify oldest items surface first

**Verification:**
- [ ] Tests verify sort order with various review states

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/feed-engine/src/strategies/recency.ts`
- `packages/feed-engine/src/strategies/recency.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 22: Implement pagination (strategy-dependent cursor)

**Description:** Cursor-based pagination using **strategy-dependent sortKey + id** per Spec 04 (not hardcoded lastReviewedAt).

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Pagination with strategy-dependent cursor

**Dependencies:** Task 21

**Acceptance criteria:**
- [ ] `paginateFeed(items, pageSize, cursor, strategy)` returns items + nextCursor
- [ ] Cursor encodes: `{sortKey: <strategy-specific>, id: <uuid>}`
- [ ] Recency strategy: sortKey = effectiveReviewedAt
- [ ] Importance strategy (future): sortKey = reviewCount
- [ ] Cursor decoding handles invalid input gracefully
- [ ] Tests verify no skipped/duplicate items

**Verification:**
- [ ] Tests verify pagination boundaries
- [ ] Tests with various strategies and page sizes

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/feed-engine/src/pagination.ts`
- `packages/feed-engine/src/pagination.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 23: Implement GET /feed with filtering

**Description:** Feed listing endpoint with strategy selection and isPublished filtering.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Feed endpoints
- `.kiro/specs/04-feed-engine.md` — Feed generation

**Dependencies:** Task 13, Task 17, Task 22

**Acceptance criteria:**
- [ ] Route: `GET /feed`
- [ ] Query params: `strategy` (default: recency), `pageSize` (default: 10), `cursor`
- [ ] Applies `injectPublicRequestFlag` middleware
- [ ] Fetches candidates with `isPublished` filter based on visibility
- [ ] Applies selected strategy
- [ ] Returns paginated feed with `nextCursor`
- [ ] **PostgreSQL integration tests:**
  - Public mode excludes unpublished items
  - Private mode shows all items
  - Pagination works across pages

**Verification:**
- [ ] `pnpm --filter @recallfeed/api test` passes
- [ ] Integration tests use `TEST_DATABASE_URL`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/routes/feed.ts`
- `packages/api/src/routes/feed.test.ts`

**Estimated scope:** Medium (2 files)

---

### Task 24: Implement GET /feed/:id with authorization

**Description:** Single feed item retrieval with authorization and published checks.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Feed item endpoint

**Dependencies:** Task 23

**Acceptance criteria:**
- [ ] Route: `GET /feed/:id`
- [ ] Returns single feed item
- [ ] Public mode: returns 404 if `isPublished=false`
- [ ] Private mode: returns all items
- [ ] 404 if item not found
- [ ] Tests verify published filtering

**Verification:**
- [ ] Tests verify 404 for unpublished in public mode
- [ ] Tests verify item returned in private mode

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- (Update `packages/api/src/routes/feed.ts` and `.test.ts`)

**Estimated scope:** Small (modify existing files)

---

## Checkpoint: Feed Generation Complete

**Verification:**
- [ ] GET /feed returns paginated, filtered feed
- [ ] Strategy selection works (recency)
- [ ] isPublished filtering verified with PostgreSQL
- [ ] Pagination tested across multiple pages
- [ ] Git history: 6 more commits (tasks 19-24)

**Review gate:** Human confirms feed works before mutations.

---

## Phase 4: Review & Publish Mutations

**Goal:** State management for review and publish actions

### Task 25: Implement PUT /feed/:id/review

**Description:** Record review event, update review count and timestamp.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Review endpoint
- `.kiro/specs/04-feed-engine.md` — Review state

**Dependencies:** Task 24

**Acceptance criteria:**
- [ ] Route: `PUT /feed/:id/review`
- [ ] Protected: requires authentication
- [ ] Increments `reviewCount`
- [ ] Updates `lastReviewedAt` to NOW()
- [ ] Creates `review_events` record
- [ ] Returns updated feed item
- [ ] Tests verify state transitions

**Verification:**
- [ ] Tests verify count increments
- [ ] Tests verify timestamp updates
- [ ] PostgreSQL integration test

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/routes/review.ts`
- `packages/api/src/routes/review.test.ts`
- (Update database queries for review mutation)

**Estimated scope:** Small (2-3 files)

---

### Task 26: Implement PUT /feed/:id/publish

**Description:** Toggle published state for items.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Publish endpoint

**Dependencies:** Task 25

**Acceptance criteria:**
- [ ] Route: `PUT /feed/:id/publish`
- [ ] Protected: requires authentication
- [ ] Request body: `{published: boolean}`
- [ ] Updates `isPublished` flag
- [ ] Returns updated feed item
- [ ] Tests verify state transitions

**Verification:**
- [ ] Tests verify publish/unpublish
- [ ] Tests verify auth required

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/routes/publish.ts`
- `packages/api/src/routes/publish.test.ts`
- (Update database queries)

**Estimated scope:** Small (2-3 files)

---

### Task 27: Integration tests for state management

**Description:** End-to-end tests for review and publish workflows.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Complete mutation contracts

**Dependencies:** Task 26

**Acceptance criteria:**
- [ ] Test workflow: create item → review → verify count/timestamp
- [ ] Test workflow: create item → publish → verify in feed → unpublish → verify hidden (public mode)
- [ ] Test workflow: multiple reviews → verify count increments
- [ ] PostgreSQL integration tests

**Verification:**
- [ ] All state transition tests pass

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/routes/integration-mutations.test.ts`

**Estimated scope:** Small (1 file)

---

## Checkpoint: Mutations Complete

**Verification:**
- [ ] Review and publish mutations work
- [ ] State transitions verified with PostgreSQL
- [ ] Auth enforced on mutations
- [ ] Git history: 3 more commits (tasks 25-27)

**Review gate:** Human confirms mutations before expanded features.

---

## Phase 5: Expanded Features

**Goal:** Additional strategies, card types, and source management

### Task 28: Implement importance resurfacing strategy

**Description:** Sort by review count ascending (under-reviewed items first).

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Importance strategy

**Dependencies:** Task 21

**Acceptance criteria:**
- [ ] `ImportanceStrategy implements IResurfacingStrategy`
- [ ] Sorts by `reviewCount` ascending, then `createdAt` descending
- [ ] Tests verify under-reviewed items surface first

**Verification:**
- [ ] Tests with varying review counts

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/feed-engine/src/strategies/importance.ts`
- `packages/feed-engine/src/strategies/importance.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 29: Implement highlight card generator

**Description:** Extract quotes or code blocks as cards.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Card types

**Dependencies:** Task 20

**Acceptance criteria:**
- [ ] `HighlightCardGenerator` extracts blockquotes or code blocks
- [ ] `isAiGenerated` flag set to false
- [ ] Tests verify extraction logic

**Verification:**
- [ ] Tests with sample notes containing highlights

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/feed-engine/src/generators/highlight.ts`
- `packages/feed-engine/src/generators/highlight.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 30: Add source management routes

**Description:** Create and import sources programmatically.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Source endpoints

**Dependencies:** Task 18

**Acceptance criteria:**
- [ ] Route: `POST /sources` (create source)
- [ ] Route: `POST /sources/:id/import` (trigger import)
- [ ] Protected: requires authentication
- [ ] Validates source type (markdown)
- [ ] Returns source ID and status
- [ ] Tests verify creation and import triggering

**Verification:**
- [ ] Integration tests with PostgreSQL

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test`)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/routes/sources.ts`
- `packages/api/src/routes/sources.test.ts`

**Estimated scope:** Small (2 files)

---

### Task 31: Create minimal Worker entry point

**Description:** Basic Worker that dispatches to Hono. **Defer full DevRecall/ReflectionFeed wrappers to Gate 3.**

**Specification references:**
- `.kiro/specs/05-authentication.md` — Worker structure (minimal version)

**Dependencies:** Task 16

**Acceptance criteria:**
- [ ] Worker exports default handler
- [ ] Dispatches all requests to Hono app
- [ ] Basic Env type with required bindings
- [ ] **No app-specific logic** (DevRecall visibility checks deferred to Gate 3)
- [ ] Can run locally with `wrangler dev`
- [ ] Tests verify handler exports

**Verification:**
- [ ] `pnpm --filter @recallfeed/api test` passes
- [ ] `wrangler dev` starts (manual check, no deployment)

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test` + `wrangler dev` check)
- [ ] Reviewed (by: ______, date: ______)

**Files created:**
- `packages/api/src/worker.ts`
- `packages/api/wrangler.jsonc` (minimal config)

**Estimated scope:** Small (2 files)

---

## Final Checkpoint: Gate 2 Foundation Complete

**Verification:**
- [ ] All 31 tasks completed with Implemented/Verified/Reviewed checkmarks
- [ ] All tests pass: `pnpm test` (80%+ coverage for core packages)
- [ ] All builds succeed: `pnpm build`
- [ ] PostgreSQL integration checks pass (not SQLite mocks)
- [ ] Real authorization enforced (negative tests pass)
- [ ] Early protected path works: POST /import/markdown → GET /feed
- [ ] Review and publish mutations work
- [ ] Kiro skills properly installed with discovery evidence
- [ ] Git history: 31 atomic commits
- [ ] ESLint max-lines rule enforced
- [ ] Each task shows commit SHA, verification output, review confirmation

**Review gate:** Submit Gate 2 completion request with evidence and hashes.

---

## Out of Scope (Deferred to Later Gates)

**Gate 3 — Demo Applications:**
- ReflectionFeed Worker wrapper (Next.js integration, Cloudflare Access)
- DevRecall Worker wrapper (public visibility validation)
- Frontend applications

**Gate 4 — Optional Features:**
- Notion connector
- AI enrichment pipeline
- Inngest workflows
- Reflection prompt generation

---

## Notes

**Task state tracking:**
- **Implemented:** Code exists, committed (record commit SHA)
- **Verified:** Tests/builds pass (record command output)
- **Reviewed:** Independent check confirms criteria met

**Commands after each task:**
```bash
# Implementation
git add -A && git commit -m "feat: <task description>"

# Verification
pnpm --filter <package> build
pnpm --filter <package> test
pnpm typecheck

# Record in tasks/todo.md
# Update task status with commit SHA and verification summary
```

**Stopping conditions:**
- Task verification fails → fix before continuing
- Authorization test fails → critical, stop immediately
- PostgreSQL integration broken → stop, diagnose
- Uncertainty about approved spec → stop, ask user

**Never:**
- Skip verification stage
- Mark "Reviewed" without independent check
- Proceed to next task with failing tests
- Deploy without user approval
