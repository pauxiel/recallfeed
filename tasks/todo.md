# RecallFeed Implementation Tasks — Gate 2 (Corrected)

**Status:** Phase 1 (Tasks 1-7) implemented and self-verified 2026-11-14; stopped at the Phase 1 checkpoint awaiting independent Firstmate review. Phases 2-5 are not authorized. See "Phase 1 Execution Record" below the Phase 1 checkpoint.  
**Based on:** `tasks/plan.md` (corrected per 2026-11-14 planning review)  
**Tracking:** Markdown checklist with explicit Implemented/Verified/Reviewed state

---

## Task State Protocol

Each task tracks three stages:

1. **Implemented:** Code written, committed (record commit SHA)
2. **Verified:** Tests pass, build succeeds (record command output)
3. **Reviewed:** Independent verification confirms acceptance criteria met (automated test suite or human check)

**Format per task:**
```markdown
**Status:**
- [ ] Implemented (commit: <SHA>)
- [ ] Verified (command: <output summary>)
- [ ] Reviewed (evidence: <test output or reviewer confirmation>)
```

**Checkpoint boundaries:** Human approval required at phase boundaries (after tasks 7, 21, 24, 28, 30). Within a phase, "Reviewed" means independent verification (test suite run, not manual approval for every task).

**Do not advance to next phase until human reviews phase checkpoint.**

---

## Phase 1: Bootstrap & Foundation (Tasks 1-7)

> **Execution note (2026-11-14):** The per-task "Acceptance criteria" and "Verification" checkboxes below are the original plan text and were not ticked one by one. The authoritative record is each task's Status block plus the "Phase 1 Execution Record" after the Phase 1 checkpoint, which also lists where execution deviated from the original wording and why.

### Task 1: Initialize Git, stage existing specs, verify no secrets

**Description:** Create Git repository, configure `.gitignore`, stage existing `.kiro/` specs and planning artifacts. **Verify no secrets or private data** before staging.

**Specification references:**
- `.kiro/steering/project-conventions.md` — Git requirements
- Review 2026-11-14: Explicit commit of existing approved material

**Dependencies:** None

**Acceptance criteria:**
- [ ] Git initialized: `git init` run, `.git/` directory exists
- [ ] `.gitignore` excludes: `node_modules/`, `.turbo/`, `dist/`, `build/`, `coverage/`, `*.log`, `.dev.vars`, `.env*`
- [ ] `.gitignore` does NOT exclude `.kiro/`
- [ ] **Secrets check:** Manually inspect staged content for actual secret values or private artifacts (not variable names/placeholders in documentation)
- [ ] Stage existing `.kiro/` content: specs, steering, skills, planning artifacts
- [ ] Initial commit: "chore: initialize repository with approved Gate 1 artifacts"

**Verification:**
- [ ] `git status` shows clean working tree
- [ ] `git log` shows initial commit with `.kiro/` files
- [ ] `.kiro/` directory tracked: `git ls-files .kiro/ | wc -l` > 0
- [ ] **Secrets inspection:** Manually verify no actual secret values (connection strings, API keys, tokens) staged; variable names and placeholders in specs are legitimate

**Status:**
- [x] Implemented (commit: `9d09c0b`, `chore: initialize repository with approved Gate 1 artifacts`, 68 files, branch `main`)
- [x] Verified (2026-11-14, `git status` → "nothing to commit, working tree clean"; `git ls-files .kiro/ | wc -l` → 56; `git check-ignore -v .kiro/specs/01-core-domain.md` → exit 1, not ignored. Secrets inspection: regex scan of all 67 pre-existing files for AWS/GitHub/OpenAI/Anthropic/Notion/Slack token shapes, PEM private keys, JWTs, credentialed connection URLs, and literal values assigned to `DATABASE_URL`/`*_KEY`/`TOKEN`/`PASSWORD` → 0 matches; read `.kiro/hooks/scripts/notify-firstmate.sh` in full → no credentials, but it contains the local absolute path `/Users/paulobayuwana/Documents/projects/firstmate`. `.gitignore` additions: `build/`, `coverage/`, `.env.*` with `!.env.example`.)
- [ ] Reviewed (awaiting independent Firstmate review; self-verification only)

**Execution notes:** `tasks/todo-old.md`, `tasks/todo-backup-cycle3.md`, `.kiro/agents/recallfeed.json.bak`, and `.kiro/specs/06-inngest-workflows.md.bak` were committed as found. They are superseded clutter; removing them needs a separate decision.

**Files created:**
- `.git/` (directory)
- `.gitignore`

**Estimated scope:** Small

---

### Task 2: Configure ESLint with max-lines for all handwritten JS/TS

**Description:** Set up ESLint with max-lines rule enforcing 1000 physical lines for **all handwritten JavaScript/TypeScript files including tests** (not specs, not generated files, not dependencies).

**Specification references:**
- `.kiro/steering/project-conventions.md` — Source file length policy (1000 lines, count blanks/comments)
- Review 2026-11-14: Include tests in max-lines, not exclude them

**Dependencies:** Task 1

**Acceptance criteria:**
- [ ] ESLint installed as root dev dependency (exact or `^` version, compatible with Node >=22)
- [ ] `.eslintrc.json` configures `max-lines` rule: `{"max": 1000, "skipBlankLines": false, "skipComments": false}`
- [ ] Rule applies to **all handwritten JS/TS:** `**/*.{js,ts,jsx,tsx}` (includes packages, tests, configs, scripts, future apps)
- [ ] Excludes: `node_modules/`, `dist/`, `build/`, `.kiro/specs/`, generated files only
- [ ] `pnpm lint` script added to root `package.json`

**Verification:**
- [ ] `pnpm lint` runs without errors (no files yet, linter initializes)
- [ ] ESLint configuration validates: `npx eslint --print-config packages/core/src/index.ts` (after Task 7)

**Status:**
- [x] Implemented (commit: `cd16dfb`, `chore: add pnpm workspace, Turborepo, and ESLint max-lines toolchain`)
- [x] Verified (2026-11-14, Node 22.23.3: `pnpm lint` → exit 0. ESLint lints 9 files: `eslint.config.mjs`, root `vitest.config.ts`, `packages/core/vitest.config.ts`, and 6 core `.ts` files including both tests. `eslint --print-config` resolves `max-lines` to `[2, {max:1000, skipBlankLines:false, skipComments:false}]` for `packages/core/src/index.ts`, a `*.test.ts` file, and a config file. Negative control: temporary files of 1000 lines passed; 1001-line `.ts`, `.test.ts`, and `.config.mjs` files each failed with `File has too many lines (1001). Maximum allowed is 1000`; control files deleted.)
- [ ] Reviewed (awaiting independent Firstmate review; self-verification only)

**Deviations from the original task text (installed ESLint 10.15.0 supports flat config only):** `eslint.config.mjs` replaces `.eslintrc.json`; its `ignores` list replaces `.eslintignore`. `.kiro/specs/` needs no exclusion because ESLint only lints JS/TS files. Added dev dependencies: `@eslint/js`, `typescript-eslint`, `globals`.

**Files created:**
- `package.json` (root, initial)
- `.eslintrc.json`
- `.eslintignore`

**Estimated scope:** Small

---

### Task 3: Initialize pnpm workspace with Turborepo

**Description:** Set up monorepo with pnpm workspaces and Turborepo for parallel builds. Define workspace packages.

**Specification references:**
- `.kiro/steering/project-conventions.md` — Monorepo structure
- `.kiro/steering/technology-decisions.md` — pnpm + Turborepo

**Dependencies:** Task 2

**Acceptance criteria:**
- [ ] pnpm installed (or verify existing installation compatible with Node >=22)
- [ ] `pnpm-workspace.yaml` defines `packages: ['packages/*']`
- [ ] `turbo.json` configures build pipeline with `build`, `test`, `lint`, `typecheck` tasks
- [ ] Root `package.json` has workspace scripts pointing to `turbo run <task>`
- [ ] `.gitignore` updated for Turbo cache: `.turbo/`

**Verification:**
- [ ] `pnpm install` succeeds (installs root dev deps only, no packages yet)
- [ ] `pnpm build` exits cleanly (no packages yet, no failures)
- [ ] `.turbo/` directory created after first `pnpm build`

**Status:**
- [x] Implemented (commit: `cd16dfb` for the workspace, Turborepo, and lockfile; `d7b323e` adjusted `turbo.json` outputs and the core package joined the workspace)
- [x] Verified (2026-11-14: `pnpm install` → exit 0; with zero packages `pnpm build` → "Running build in 0 packages", exit 0, `.turbo/` created; after Task 7 `pnpm build` → 1 package, `tsc -p tsconfig.build.json`, exit 0, `packages/core/dist/` contains 8 files. A fresh copy of the tracked files plus the new files, installed with `pnpm install --frozen-lockfile`, printed no "ignored build scripts" warning and passed all 10 tests, so the `onlyBuiltDependencies` allowlist (`esbuild`, `workerd`) works without manual `pnpm rebuild`.)
- [ ] Reviewed (awaiting independent Firstmate review; self-verification only)

**Deviations:** The machine default is Node 20.20.2 but the toolchain requires Node >=22 (Vitest 5 and Wrangler 4.162 declare `>=22.12.0`; the Workers plugin depends on Wrangler 4.162 and Miniflare 5, which declare `>=22`). All commands ran with the already-installed nvm Node 22.23.3. Added `.nvmrc` (`22`) and root `engines.node` `>=22.12.0`. `pnpm lint` runs `eslint .` at the root so it also covers root config files; `turbo.json` still defines a `lint` task and core has a `lint` script. `typecheck` runs the root `tsc --noEmit` and then `turbo run typecheck`.

**Files created:**
- `pnpm-workspace.yaml`
- `turbo.json`
- `package.json` (update with workspace scripts)

**Estimated scope:** Small

---

### Task 4: Configure TypeScript strict mode and root tsconfig

**Description:** Create **root `tsconfig.json`** and shared `tsconfig.base.json` with strict mode. Core package will have zero runtime dependencies per Spec 01 (no Zod schemas in core).

**Specification references:**
- `.kiro/specs/01-core-domain.md` — Core has zero runtime dependencies
- `.kiro/steering/project-conventions.md` — TypeScript strict mode
- Review 2026-11-14: Create root tsconfig.json for `tsc --noEmit`, check per-package configs after packages exist

**Dependencies:** Task 3

**Acceptance criteria:**
- [ ] `tsconfig.base.json` at root with strict mode enabled, target ES2022, module ESNext
- [ ] **`tsconfig.json` at root** that extends base and includes `packages/*/src/**/*.ts` for workspace-wide typecheck
- [ ] Path aliases configured for `@recallfeed/*` packages in base config
- [ ] Per-package `tsconfig.json` will be created when packages are scaffolded (Tasks 7+), extending base

**Verification:**
- [ ] Root config files created and parseable
- [ ] TypeScript language service initializes
- [ ] **Typecheck deferred:** `npx tsc --noEmit` will be run at Phase 1 checkpoint after Task 7 creates core package (empty glob check is not meaningful)

**Status:**
- [x] Implemented (commit: `d7b323e`, `feat: add TypeScript, Workers-runtime Vitest, and @recallfeed/core package`)
- [x] Verified (2026-11-14: `pnpm typecheck` → exit 0 (root `tsc --noEmit -p tsconfig.json`, then `turbo run typecheck` running `tsc -p tsconfig.json && tsc -p tsconfig.test.json` in core). It first failed once with `TS2339: Property 'crypto' does not exist on type 'typeof globalThis'` in `smoke.test.ts`; fixed in the test and rerun clean. Negative control: appending `crypto.randomUUID()` to `packages/core/src/errors.ts` made `tsc -p tsconfig.json` fail with `TS2304: Cannot find name 'crypto'` (exit 2), proving `"types": []` keeps runtime globals out of core source; the edit was reverted and the file diffed identical to its backup.)
- [ ] Reviewed (awaiting independent Firstmate review; self-verification only)

**Deviations:** TypeScript is `~5.9.3`, not the registry's `latest` 7.0.2, because installed `typescript-eslint@8.72.2` declares `typescript >=4.8.4 <6.1.0`. `tsconfig.base.json` adds `verbatimModuleSyntax`, `isolatedModules`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`. Core uses three tsconfigs (`tsconfig.json` source with no ambient types, `tsconfig.test.json` with Workers types, `tsconfig.build.json` for emit).

**Files created:**
- `tsconfig.base.json`
- `tsconfig.json` (root, for workspace-wide checks)

**Estimated scope:** Small

---

### Task 5: Set up Vitest with Workers runtime pool and smoke test

**Description:** Configure Vitest with `@cloudflare/vitest-pool-workers` to run tests in actual Workers runtime. **Smoke test will be created in Task 7** after core package exists.

**Specification references:**
- `.kiro/steering/project-conventions.md` — Testing with Vitest
- `.kiro/steering/technology-decisions.md` — Workers runtime testing, Node >=22 requirement
- Review 2026-11-14T103704Z: Smoke test creation requires package to exist first

**Dependencies:** Task 4

**Acceptance criteria:**
- [ ] Vitest installed as root dev dependency (exact or `^`, compatible with Node >=22)
- [ ] `@cloudflare/vitest-pool-workers` installed (compatible version with Vitest + Wrangler 4.148.0)
- [ ] `vitest.config.ts` at root with Workers pool configured
- [ ] `vitest.workspace.ts` for multi-package testing
- [ ] Coverage threshold: 80% for `packages/{core,database,feed-engine}/`
- [ ] Test pattern: `**/*.test.ts`
- [ ] **Note:** Smoke test will be created in Task 7 (after core package scaffolded)

**Verification:**
- [ ] Vitest config files created and parseable
- [ ] Dependencies installed successfully
- [ ] **Smoke test execution deferred to Task 7** (package must exist first)

**Status:**
- [x] Implemented (commit: `d7b323e`; dependencies installed in `cd16dfb`)
- [x] Verified (2026-11-14: `pnpm test` → exit 0, `vitest run` v4.1.12 in the Workers runtime, 2 files / 10 tests passed. Smoke test checks `navigator.userAgent === "Cloudflare-Workers"`, global `crypto.randomUUID()` output matches the RFC 4122 v4 pattern and is unique, and `WebSocketPair`/`HTMLRewriter` exist. Negative control: the same smoke test run under plain Node (no Workers plugin) failed 2 of 3 (`expected 'Node.js/22' to be 'Cloudflare-Workers'`, `WebSocketPair` undefined); control config deleted. `pnpm test:coverage` → istanbul, 100% statements/branches/functions/lines on `errors.ts`, above the 80% threshold.)
- [ ] Reviewed (awaiting independent Firstmate review; self-verification only)

**Deviations:** `@cloudflare/vitest-pool-workers@0.23.0` is deprecated and renamed `@cloudflare/vitest-plugin`, so the plugin `1.8.2` is installed (it pins Wrangler `4.162.0` and Miniflare `5.20261113.0-beta`, running workerd `1.20261113.1`). The todo's "Wrangler 4.148.0" is not installed at the root; Task 17 should decide the Wrangler pin. Vitest 4 replaced `vitest.workspace.ts` with `test.projects`, so the root `vitest.config.ts` uses `projects: ["packages/*"]` and each package owns a `vitest.config.ts` calling `cloudflareTest()`. The first smoke test asserted that `process.versions.node` is absent; that was wrong because workerd supplies its own `process` global, so it was replaced with the `WebSocketPair`/`HTMLRewriter` check. Vitest is `^4.1.12` (not 5.x) because the plugin's peer range accepts both and `@vitest/coverage-istanbul` is matched at 4.1.12.

**Files created:**
- `vitest.config.ts`
- `vitest.workspace.ts`

**Note:** Smoke test will be created in Task 7 after core package exists

**Estimated scope:** Small

---

### Task 6: Verify Kiro skills installation (already complete)

**Description:** Document and verify that Kiro skills are properly installed in native format (`.kiro/skills/<name>/SKILL.md`) with discovery evidence. **This was completed during planning corrections.**

**Specification references:**
- Planning review 2026-11-14: Native Kiro skill format with discovery evidence
- `.kiro/skills/DISCOVERY-EVIDENCE.md` — Verification proof

**Dependencies:** Task 1

**Acceptance criteria:**
- [x] Directory structure: `.kiro/skills/planning-and-task-breakdown/SKILL.md` ✅
- [x] Directory structure: `.kiro/skills/incremental-implementation/SKILL.md` ✅
- [x] Directory structure: `.kiro/skills/spec-driven-development/SKILL.md` ✅
- [x] Each SKILL.md has frontmatter with `name` and `description` ✅
- [x] `.kiro/skills/README.md` documents attribution (Addy Osmani, MIT, source URL) ✅
- [x] Discovery verified via `disclose_context` tool ✅
- [x] Evidence documented in `.kiro/skills/DISCOVERY-EVIDENCE.md` ✅

**Verification:**
- [x] Skills are discoverable: `disclose_context` returned `planning-and-task-breakdown` content earlier; in the 2026-11-14 execution session all three skills appear in the session's available-skill list (observed, not individually activated)
- [x] Git tracks skill files: `git ls-files .kiro/skills` lists 5 files (the 3 `SKILL.md` files, `README.md`, `DISCOVERY-EVIDENCE.md`), committed in `9d09c0b`

**Status:**
- [x] Implemented (local files prepared during planning corrections)
- [x] Verified (`disclose_context` successful for planning-and-task-breakdown)
- [x] Reviewed (1 verified via tool, 2 expected; see `.kiro/skills/DISCOVERY-EVIDENCE.md`)

**Note:** Git-dependent verification will be completed after Task 1 creates repository. Discovery evidence distinguishes verified (1 via tool) from expected (2 not yet independently verified).

**Files verified:**
- `.kiro/skills/planning-and-task-breakdown/SKILL.md`
- `.kiro/skills/incremental-implementation/SKILL.md`
- `.kiro/skills/spec-driven-development/SKILL.md`
- `.kiro/skills/README.md`
- `.kiro/skills/DISCOVERY-EVIDENCE.md`

**Estimated scope:** Small (verification only, already complete)

---

### Task 7: Create `@recallfeed/core` with domain types (zero runtime deps, no Zod)

**Description:** Scaffold core package with TypeScript domain types only. **No Zod schemas, no runtime dependencies** per Spec 01. Types exported from barrel file. **Includes Worker-runtime smoke test** to verify Vitest setup from Task 5.

**Specification references:**
- `.kiro/specs/01-core-domain.md` — All domain types, zero runtime dependencies requirement
- `.kiro/steering/skeleton-crew-rules.md` — Core knows nothing about apps
- Review 2026-11-14T103704Z: Smoke test created after package exists

**Dependencies:** Task 4, Task 5

**Acceptance criteria:**
- [ ] `packages/core/` directory created
- [ ] `packages/core/package.json` with `"name": "@recallfeed/core"`, `"dependencies": {}` (empty)
- [ ] `packages/core/tsconfig.json` extends root base
- [ ] Types defined per Spec 01: `Source`, `Note`, `FeedItem`, `ReviewEvent`, `FeedConfig`, `ReviewAction`
- [ ] Interfaces defined: `IConnector`, `IResurfacingStrategy`, `IFeedEngine`
- [ ] All types exported from `packages/core/src/index.ts`
- [ ] **No Zod**, no runtime validation libraries
- [ ] **Smoke test:** `packages/core/src/__tests__/smoke.test.ts` verifies Workers runtime (`globalThis.crypto.randomUUID()` works)
- [ ] JSDoc comments on all exported types

**Verification:**
- [ ] `pnpm --filter @recallfeed/core build` succeeds (or `tsc` if no build script yet)
- [ ] **`pnpm test` runs and smoke test passes** in Workers runtime (nonzero test evidence)
- [ ] `pnpm typecheck` includes core package, no errors
- [ ] `packages/core/package.json` shows `"dependencies": {}`

**Status:**
- [x] Implemented (commit: `d7b323e`)
- [x] Verified (2026-11-14: `pnpm test` → 10 tests passed in the Workers runtime (3 smoke, 7 error-hierarchy); `pnpm --filter @recallfeed/core build` via `pnpm build` → exit 0; `pnpm typecheck` → exit 0 including core; `pnpm lint` → exit 0; `packages/core/package.json` has `"dependencies": {}` and no peer or dev dependencies; emitted `dist/index.js` contains only relative re-exports; Skeleton Crew grep over `packages/` found no `apps/` import, no sibling `@recallfeed/*` import, and no `ReflectionFeed`/`DevRecall` string.)
- [ ] Reviewed (awaiting independent Firstmate review; self-verification only)

**Deviations (the todo's list is narrower than approved Spec 01, which governs):** The package also exports `IAIProvider` (Spec 01 defines four interfaces, the todo listed three), the supporting types (`NormalizedNote`, `ConnectorCredentials`, `ConnectorValidationResult`, `AIOptions`, `GetFeedOptions`, `FeedPage`, `ImportResult`, `ResurfacingStrategyName`, `NoteMetadata`, `SourceType`, `CardType`), and `RecallFeedError` with its five subclasses, because Spec 01 requires them. Files follow Spec 01's layout (`types.ts`, `interfaces.ts`, `errors.ts`, `index.ts`, plus a package `README.md`) instead of the todo's `types/` and `interfaces/` directories. Added `src/__tests__/errors.test.ts` (7 tests) so the only runtime code, the error classes, is exercised and the 80% coverage threshold is meaningful. Added `tsconfig.test.json` and `tsconfig.build.json`.

**Files created:**
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`
- `packages/core/src/types/` (domain types)
- `packages/core/src/interfaces/` (IConnector, IResurfacingStrategy, IFeedEngine)
- `packages/core/src/__tests__/smoke.test.ts` (Worker-runtime smoke test)

**Estimated scope:** Small

---

**PHASE 1 CHECKPOINT:** Bootstrap complete with working toolchain verified. Stop for human review before proceeding to Phase 2.

**Checkpoint criteria** (self-verified 2026-11-14 on Node 22.23.3; none independently reviewed yet):
- [x] Git initialized with approved specs committed, no actual secrets staged (manual inspection performed)
- [x] ESLint enforces 1000-line max on all handwritten JS/TS (including tests, configs, scripts, future apps)
- [x] pnpm + Turborepo configured, `pnpm build` succeeds
- [x] TypeScript strict mode enabled with root tsconfig.json, **`pnpm typecheck` passes** (after Task 7 creates core package)
- [x] Vitest configured with Workers runtime pool, **`pnpm test` passes with smoke test** (after Task 7 creates test)
- [x] Kiro skills properly installed with discovery evidence (1 verified via tool, 2 observed in the session skill list)
- [x] Core package has zero runtime dependencies verified

**Note:** Bootstrap checks apply progressively through Phase 1. Complete toolchain verification (`pnpm test && pnpm build && pnpm typecheck`) occurs at this checkpoint after Task 7. Task 1 commits do not require test/build (tools don't exist yet).

---

## Phase 1 Execution Record

Executed 2026-11-14 under the user's Phase 1-only authorization and the Firstmate review `2026-11-14T144008Z-planning.md`. Everything below was run in this session; nothing is carried over as expected output.

**Active model:** `claude-sonnet-5.5`, as stated by the session context at the start of execution. The on-disk `.kiro/agents/recallfeed.json` still says `"model": "claude-sonnet-4.5"`; it was not edited, since no authority was given to change it.

**Runtime:** Node 22.23.3 (nvm, already installed) for every command; the machine default is Node 20.20.2, which the toolchain does not support (see Task 3). pnpm 10.18.3.

**Commits (local only, branch `main`, nothing pushed, no remote configured):**

| Commit | Tasks | Message |
|---|---|---|
| `9d09c0b` | 1 | `chore: initialize repository with approved Gate 1 artifacts` |
| `cd16dfb` | 2, 3 | `chore: add pnpm workspace, Turborepo, and ESLint max-lines toolchain` |
| `d7b323e` | 4, 5, 7 | `feat: add TypeScript, Workers-runtime Vitest, and @recallfeed/core package` |

The commit that records this evidence is the next one on `main`; its SHA is in the review request.

**Installed versions (from the lockfile resolution):** `typescript 5.9.3`, `eslint 10.15.0`, `@eslint/js 10.0.1`, `typescript-eslint 8.72.2`, `globals 17.14.0`, `turbo 2.11.11`, `vitest 4.1.12`, `@vitest/coverage-istanbul 4.1.12`, `@cloudflare/vitest-plugin 1.8.2`, `@cloudflare/workers-types 5.20261114.1`; transitive runtime `workerd 1.20261113.1`, `miniflare 5.20261113.0-beta`, `wrangler 4.162.0`. Note the Miniflare dependency is a beta build pulled in by the plugin.

**Final command results (Node 22.23.3, working tree at `d7b323e`):**

| Command | Result |
|---|---|
| `pnpm lint` | exit 0; 9 files linted, 0 errors, 0 warnings |
| `pnpm build` | exit 0; `tsc -p tsconfig.build.json`; 8 files in `packages/core/dist/` |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0; Workers runtime; 2 files, 10 tests passed (3 smoke, 7 errors) |
| `pnpm test:coverage` | exit 0; istanbul; `errors.ts` 100% statements/branches/functions/lines |
| `pnpm install --frozen-lockfile` in a fresh copy | exit 0; no ignored-build-scripts warning; 10 tests passed |

**Corrections to earlier evidence:** The cycle 3 completion report (`PLANNING-CYCLE3-COMPLETE.md`) gave `grep -c "^## Task" tasks/todo.md` with expected output 30. Run for real it prints 2, because task headings are level three. The correct command, `grep -c '^### Task' tasks/todo.md`, prints 30 (run 2026-11-14). That report is also dated 2026-11-07 although it cites 2026-11-14 reviews. It was not edited; this record supersedes it.

**Record reconciliations made in this pass (review item 5, narrow):** `tasks/plan.md` no longer says "Implement multiple tasks in one commit"; the two checkpoint lists in this file now read "7, 21, 24, 28, 30". The remaining references to Task 31 in this file are historical notes about its consolidation into Task 18.

**Deliberately not changed (later-phase corrections from the review, to settle before those phases are authorized):** Task 10 database transport; Task 27 cursor and its reference to a removed importance score; the basic-feed versus full Spec 05 contract distinction; the Phase 3 execution order and the "checkpoint after task 24" phrasing. Task 17 also needs a Wrangler version decision, since `4.148.0` is not what the installed plugin pins.

**Review state:** Implemented and Verified for Tasks 1-5 and 7; Task 6 re-verified with Git tracking. No task is marked Reviewed: running my own tests is verification, not independent review.

---

## Phase 2: Early Working Path - Protected Markdown Import (Tasks 8-21)

### Task 8: Create `@recallfeed/database` with Neon client

**Description:** Scaffold database package with `@neondatabase/serverless` client. **Request-scoped connection factory** (HTTP connection, no pooling, no generic retry wrapper per Spec 02).

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Neon HTTP client, request-scoped factory
- `.kiro/steering/technology-decisions.md` — No ORM, raw SQL
- Review 2026-11-14: Request-scoped factory per Spec 02, not pooling

**Dependencies:** Task 7

**Acceptance criteria:**
- [ ] `packages/database/` directory created
- [ ] `packages/database/package.json` with `@neondatabase/serverless` dependency
- [ ] `packages/database/tsconfig.json` extends root base
- [ ] `src/client.ts` exports `createDatabaseClient(databaseUrl: string)` function (request-scoped, returns HTTP client)
- [ ] No connection pooling, no generic retry wrapper, no transaction helper (per Spec 02 MVP)
- [ ] Types for Env binding: `DATABASE_URL` string

**Verification:**
- [ ] `pnpm --filter @recallfeed/database build` succeeds
- [ ] Import succeeds: `import { createDatabaseClient } from '@recallfeed/database'`
- [ ] No `dependencies` include pooling or ORM libraries

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/database build`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/database/package.json`
- `packages/database/tsconfig.json`
- `packages/database/src/client.ts`
- `packages/database/src/index.ts`

**Estimated scope:** Small

---

### Task 9: Write forward-only migration 001

**Description:** Create initial schema migration per Spec 02. **Forward-only** (no down migration per Spec 02 MVP rollback policy).

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Full schema, forward-only migrations
- Review 2026-11-14: Forward-only per Spec 02 MVP

**Dependencies:** Task 8

**Acceptance criteria:**
- [ ] `packages/database/src/migrations/001_initial.sql` created
- [ ] Tables: `sources`, `notes`, `feed_items`, `review_events`, `_schema_migrations`
- [ ] Named constraints per Spec 02: `notes_source_content_hash_idx` on `(source_id, content_hash)`, `feed_items_note_card_type_idx` UNIQUE on `(note_id, card_type)`
- [ ] PostgreSQL-specific types: `TIMESTAMPTZ`, `UUID`, `JSONB`
- [ ] **No down migration** (forward-only per Spec 02)
- [ ] `packages/database/src/migrate.ts` script applies unapplied migrations using `_schema_migrations` tracking

**Verification:**
- [ ] Migration SQL syntax validated (real verification against test DB once available in Task 10)
- [ ] Tracking table exists in migration: `grep "_schema_migrations" 001_initial.sql`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: SQL syntax check)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/database/src/migrations/001_initial.sql`
- `packages/database/src/migrate.ts`

**Estimated scope:** Small

---

### Task 10: Set up PostgreSQL test database transport

**Description:** Configure integration test database. **Declare concrete transport:** Either local PostgreSQL with `psql` OR Neon HTTP test database (document which). Neon HTTP client ≠ local PostgreSQL client without explicit configuration.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — Neon HTTP client
- Review 2026-11-14: Declare concrete PostgreSQL test transport

**Dependencies:** Task 9

**Acceptance criteria:**
- [ ] **Choose and document transport:**
  - Option A: `@neondatabase/serverless` client → local PostgreSQL via `postgresql://localhost:5432/recallfeed_test` (requires PostgreSQL server + Neon client's HTTP mode works locally)
  - Option B: `@neondatabase/serverless` client → authorized Neon test database via `postgresql://...neon.tech` (**authorization stop if cloud provisioning needed**)
- [ ] **Note:** Neon's `neon(connectionString)` client uses HTTP internally; Option A requires local PostgreSQL + compatible setup, not just changing the URL scheme
- [ ] `.env.test.example` created with `TEST_DATABASE_URL` placeholder
- [ ] Test setup script: `packages/database/src/__tests__/setup.ts` runs migration on test DB
- [ ] Vitest config includes test setup file
- [ ] Verify PostgreSQL-specific features work: JSONB, TIMESTAMPTZ, UUID, named constraints

**Verification:**
- [ ] `TEST_DATABASE_URL=<test_url> pnpm --filter @recallfeed/database test` runs migration successfully
- [ ] PostgreSQL connection verified: Query returns PostgreSQL version
- [ ] Named constraint test: Violate `notes_source_content_hash_idx`, verify error includes constraint name

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `TEST_DATABASE_URL=... pnpm test` with PostgreSQL verification)
- [ ] Reviewed (evidence: ______)

**Transport chosen:** _______ (Option A or B — authorization stop if cloud database provisioning needed)

**Files created:**
- `.env.test.example`
- `packages/database/src/__tests__/setup.ts`
- `packages/database/src/__tests__/smoke.test.ts` (PostgreSQL feature verification)

**Estimated scope:** Small

---

### Task 11: Implement source queries (upsert, getById)

**Description:** Write query functions for `sources` table with types. Upsert by name, get by ID.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — sources table schema
- `.kiro/steering/project-conventions.md` — Queries in separate files, typed

**Dependencies:** Task 10

**Acceptance criteria:**
- [ ] `packages/database/src/queries/sources.ts` created
- [ ] `upsertSource(client, data)` function with typed params and return
- [ ] `getSourceById(client, id)` function
- [ ] Tests in `packages/database/src/queries/__tests__/sources.test.ts`
- [ ] PostgreSQL integration tests use `TEST_DATABASE_URL`

**Verification:**
- [ ] `TEST_DATABASE_URL=... pnpm --filter @recallfeed/database test` passes source query tests
- [ ] Upsert idempotency verified: Insert same name twice, returns same `id`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `TEST_DATABASE_URL=... pnpm test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/database/src/queries/sources.ts`
- `packages/database/src/queries/__tests__/sources.test.ts`

**Estimated scope:** Small

---

### Task 12: Implement note queries (upsert by source-scoped contentHash)

**Description:** Write query functions for `notes` table. **Source-scoped deduplication:** `(source_id, content_hash)` unique constraint per Spec 02. Immutable imported content.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — notes table, source-scoped contentHash
- Review 2026-11-14: Clarify source-scoped re-import test reuses source identity

**Dependencies:** Task 11

**Acceptance criteria:**
- [ ] `packages/database/src/queries/notes.ts` created
- [ ] `upsertNote(client, note)` upserts by `(source_id, content_hash)` — updates metadata, **not content**
- [ ] `getNotesBySourceId(client, sourceId)` function
- [ ] Tests verify **source-scoped deduplication:** Same contentHash in different sources creates 2 notes
- [ ] Tests verify **re-import idempotency:** Import same content to same source twice, updates `imported_at` not content
- [ ] Test explicitly defines reused source identity (not "create new source every time")

**Verification:**
- [ ] `TEST_DATABASE_URL=... pnpm --filter @recallfeed/database test` passes note query tests
- [ ] Source-scoped test passes: Same hash, different sources → 2 rows
- [ ] Re-import test passes: Same source, same hash → 1 row, updated timestamp

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `TEST_DATABASE_URL=... pnpm test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/database/src/queries/notes.ts`
- `packages/database/src/queries/__tests__/notes.test.ts`

**Estimated scope:** Small

---

### Task 13: Implement feed_item queries (insert, getCandidates with isPublished filter)

**Description:** Write query functions for `feed_items` table. Get candidates with `isPublished` filtering for public mode.

**Specification references:**
- `.kiro/specs/02-database-schema.md` — feed_items table
- `.kiro/specs/04-feed-engine.md` — Candidate filtering

**Dependencies:** Task 12

**Acceptance criteria:**
- [ ] `packages/database/src/queries/feed-items.ts` created
- [ ] `insertFeedItem(client, item)` function
- [ ] `getFeedItemCandidates(client, options)` with filters:
  - `cardTypes` array filter
  - `onlyPublished` boolean (if true, `WHERE is_published = true`)
  - `excludeSnoozed` boolean (if true, `WHERE snoozed_until IS NULL OR snoozed_until <= NOW()`)
  - Pagination: `afterId`, `afterSortKey`, `limit`
- [ ] Tests verify `isPublished` filtering works correctly

**Verification:**
- [ ] `TEST_DATABASE_URL=... pnpm --filter @recallfeed/database test` passes feed_item query tests
- [ ] `onlyPublished=true` test returns only `is_published=true` rows

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `TEST_DATABASE_URL=... pnpm test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/database/src/queries/feed-items.ts`
- `packages/database/src/queries/__tests__/feed-items.test.ts`

**Estimated scope:** Medium

---

### Task 14: Create `@recallfeed/connectors` with IConnector interface

**Description:** Scaffold connectors package with `IConnector` interface matching **approved Spec 01/03 signature:** `import(source, credentials)`.

**Specification references:**
- `.kiro/specs/01-core-domain.md` — IConnector interface definition
- `.kiro/specs/03-connectors.md` — Markdown connector
- Review 2026-11-14: IConnector matches Spec 01/03 exact signature

**Dependencies:** Task 7

**Acceptance criteria:**
- [ ] `packages/connectors/` directory created
- [ ] `packages/connectors/package.json` depends on `@recallfeed/core`
- [ ] `src/registry.ts` exports `connectorRegistry: Map<string, IConnector>`
- [ ] IConnector interface already defined in `@recallfeed/core` per Spec 01
- [ ] Signature: `import(source: Source, credentials: ConnectorCredentials): Promise<NormalizedNote[]>`

**Verification:**
- [ ] `pnpm --filter @recallfeed/connectors build` succeeds
- [ ] Import succeeds: `import { connectorRegistry } from '@recallfeed/connectors'`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/connectors build`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/connectors/package.json`
- `packages/connectors/tsconfig.json`
- `packages/connectors/src/registry.ts`
- `packages/connectors/src/index.ts`

**Estimated scope:** Small

---

### Task 15: Implement Markdown connector (import per Spec 03 signature)

**Description:** Implement Markdown connector that parses `text/markdown` content and returns `NormalizedNote[]`. Uses **approved signature:** `import(source, credentials)` where `credentials.content` contains markdown text.

**Specification references:**
- `.kiro/specs/03-connectors.md` — Markdown parsing rules
- `.kiro/specs/01-core-domain.md` — IConnector signature
- Review 2026-11-14: Use approved signature, credentials contains content

**Dependencies:** Task 14

**Acceptance criteria:**
- [ ] `packages/connectors/src/markdown.ts` implements IConnector
- [ ] `import(source, credentials)` signature where `credentials: { content: string }`
- [ ] **Parsing:** Uses `marked.lexer()` tokenizer with frontmatter extraction and fenced-code block handling per Spec 03
- [ ] Returns `NormalizedNote[]` with `sourceId`, `content`, `contentHash`, `sourceUrl` (no `importedAt` per Spec 01)
- [ ] `content_hash` generated via SHA-256 of content
- [ ] Register in `connectorRegistry`: `connectorRegistry.set("markdown", new MarkdownConnector())`
- [ ] Tests parse sample markdown with frontmatter and code blocks

**Verification:**
- [ ] `pnpm --filter @recallfeed/connectors test` passes markdown connector tests
- [ ] Parsing test: `"# Note 1\n\nContent\n\n---\n\n# Note 2"` → 2 NormalizedNote objects

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/connectors test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/connectors/src/markdown.ts`
- `packages/connectors/src/__tests__/markdown.test.ts`

**Estimated scope:** Medium

---

### Task 16: Create `@recallfeed/feed-engine` with FeedEngine class and original generator

**Description:** Scaffold feed-engine package with `FeedEngine` class implementing `importMarkdown` method per Spec 04, plus original card generator. **Moved into early path** — needed before POST /import/markdown in Task 19.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — FeedEngine class, importMarkdown method, card generation
- Review 2026-11-14T105728Z: Add FeedEngine class (not just generator)

**Dependencies:** Task 13

**Acceptance criteria:**
- [ ] `packages/feed-engine/` directory created
- [ ] `packages/feed-engine/package.json` depends on `@recallfeed/core`, `@recallfeed/database`, `@recallfeed/connectors`
- [ ] **`src/feed-engine.ts` implements `FeedEngine` class with:**
  - `importMarkdown(content: string, metadata: {name: string}): Promise<ImportResult>` method per Spec 04
  - Coordinates: connector selection, note upsert, card generation (no AI queueing in deterministic baseline)
- [ ] `src/generators/original.ts` implements original card generator (1:1 note → feed_item)
- [ ] `src/card-generator.ts` exports `generateFeedItems(client, sourceId, cardTypes)` function
- [ ] For MVP: Only `cardType: "original"`, defer other types to later tasks

**Verification:**
- [ ] `pnpm --filter @recallfeed/feed-engine build` succeeds
- [ ] `pnpm --filter @recallfeed/feed-engine test` passes (unit tests for FeedEngine.importMarkdown and original generator)

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine build && test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/feed-engine/package.json`
- `packages/feed-engine/tsconfig.json`
- `packages/feed-engine/src/feed-engine.ts` (FeedEngine class)
- `packages/feed-engine/src/generators/original.ts`
- `packages/feed-engine/src/card-generator.ts`
- `packages/feed-engine/src/__tests__/feed-engine.test.ts`
- `packages/feed-engine/src/__tests__/original.test.ts`

**Estimated scope:** Medium

---

### Task 17: Create `@recallfeed/api` with Hono, minimal Worker entry, wrangler.toml

**Description:** Scaffold API package with Hono app, visibility middleware, and **minimal Worker entry point with wrangler.toml** for local dev server. Needed for Task 19 localhost:8787 verification.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Visibility middleware
- `.kiro/steering/technology-decisions.md` — Hono, Wrangler 4.148.0
- Review 2026-11-14: Move Worker entry before POST /import/markdown verification

**Dependencies:** Task 16

**Acceptance criteria:**
- [ ] `packages/api/` directory created
- [ ] `packages/api/package.json` depends on `hono`, `@recallfeed/core`, `@recallfeed/database`, `@recallfeed/connectors`, `@recallfeed/feed-engine`
- [ ] `src/index.ts` Worker entry point: `export default { fetch(request, env, ctx) { return app.fetch(request, env, ctx); } }`
- [ ] `src/app.ts` Hono application with visibility middleware (reads `FEED_VISIBILITY` env var, defaults to `"private"`)
- [ ] `wrangler.toml` configured: `name = "recallfeed-api"`, `main = "src/index.ts"`, `compatibility_date`, `node_compat = false`
- [ ] `wrangler.toml` bindings: `[vars]` for `FEED_VISIBILITY` (not secrets yet)
- [ ] Middleware exports: `getVisibilityMode(env)` → "private" | "public"

**Verification:**
- [ ] `pnpm --filter @recallfeed/api build` succeeds (or `wrangler deploy --dry-run`)
- [ ] `wrangler dev` starts local server (no routes yet, returns 404)

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `wrangler dev` starts on localhost:8787)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/package.json`
- `packages/api/tsconfig.json`
- `packages/api/wrangler.toml`
- `packages/api/src/index.ts` (Worker entry)
- `packages/api/src/app.ts` (Hono app)
- `packages/api/src/middleware/visibility.ts`

**Estimated scope:** Medium

---

### Task 18: Implement real authorization guards (requireOwner, requireApiKey)

**Description:** Implement **real authorization middleware** with **negative tests** plus **Origin/CSRF protection and Cache-Control headers** for private routes. **No placeholders, no stubs** — actual enforcement before Task 19.

**Specification references:**
- `.kiro/specs/05-authentication.md` — Authorization middleware contracts, CSRF requirements
- Review 2026-11-14T105728Z: Remove auth alternatives, add CSRF/cache (moved from Task 31)

**Dependencies:** Task 17

**Acceptance criteria:**
- [ ] `packages/api/src/middleware/auth.ts` created
- [ ] `requireOwner(c, next)` middleware:
  - Private mode: Checks `ctx.access.getIdentity()` (Cloudflare Access, approved identity source)
  - Returns 401 if no identity, 403 if identity but not owner (compare to `OWNER_EMAIL` env var)
- [ ] `requireApiKey(c, next)` middleware:
  - Checks `X-API-Key` header against `API_SECRET_KEY` env var
  - Returns 401 if missing or invalid
- [ ] **`packages/api/src/middleware/csrf.ts` created:**
  - Origin/CSRF middleware: Verify `Origin` or `Referer` header for private mutations
  - Reject unauthorized cross-origin requests (403)
- [ ] **`packages/api/src/middleware/cache.ts` created:**
  - Private responses include `Cache-Control: private, no-store` header
- [ ] **Negative tests required:**
  - Missing `X-API-Key` → 401
  - Invalid `X-API-Key` → 401
  - Private mode, no identity → 401
  - Private mode, non-owner identity → 403
  - Cross-origin private mutation → 403

**Verification:**
- [ ] `pnpm --filter @recallfeed/api test` passes all auth middleware tests
- [ ] Negative tests explicitly verified: Missing key → 401, wrong key → 401, cross-origin → 403
- [ ] Cache header test: Private responses include `Cache-Control: private, no-store`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/api test` including negative tests + CSRF/cache)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/middleware/auth.ts`
- `packages/api/src/middleware/csrf.ts`
- `packages/api/src/middleware/cache.ts`
- `packages/api/src/middleware/__tests__/auth.test.ts`
- `packages/api/src/middleware/__tests__/csrf.test.ts`

**Estimated scope:** Medium

---

### Task 19: Implement POST /import/markdown (Spec 05 contract, uses FeedEngine)

**Description:** **Early working path complete:** Protected endpoint → parse Markdown → persist to PostgreSQL → generate original cards → return summary. **Uses FeedEngine.importMarkdown contract** (not duplicate logic). **Spec 05 response contract.**

**Specification references:**
- `.kiro/specs/05-authentication.md` — POST /import/markdown endpoint, exact contract
- `.kiro/specs/04-feed-engine.md` — FeedEngine.importMarkdown method
- Review 2026-11-14: Use approved Spec 05 contract (sourceId, queued, notesImported, feedItemsCreated), 10 byte-100KB validation

**Dependencies:** Task 18

**Acceptance criteria:**
- [ ] Route: `POST /import/markdown`
- [ ] Protected: Uses `requireOwner` or `requireApiKey` based on visibility mode
- [ ] Accepts `Content-Type: text/markdown` (raw body) OR `Content-Type: application/json` with `{content, name?}`
- [ ] **Request validation per Spec 05:** Min 10 bytes, max 100 KB
- [ ] **Delegates to FeedEngine:** Instantiate `FeedEngine`, call `feedEngine.importMarkdown(content, {name})`
- [ ] **Response per Spec 05:** `{sourceId, queued, notesImported, feedItemsCreated}` (NOT `notesCreated, notesUpdated`)
- [ ] Error responses: 400 (size), 401/403 (auth), 500 (import failure)

**Verification:**
- [ ] Integration test with `TEST_DATABASE_URL`: POST markdown → verify notes and feed_items in PostgreSQL
- [ ] Size validation tests: 9 bytes → 400, 101KB → 400, 50 bytes → 200
- [ ] Negative auth test: No API key → 401
- [ ] Manual: `wrangler dev`, authenticated curl with ≥10 bytes:
  ```bash
  curl -X POST http://localhost:8787/import/markdown \
    -H "Content-Type: text/markdown" \
    -H "X-API-Key: $API_SECRET_KEY" \
    -d "# Test Note

Content here"
  ```
  Response matches Spec 05: `{sourceId, queued, notesImported, feedItemsCreated}`

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: integration test + manual curl)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/routes/import.ts`
- `packages/api/src/__tests__/import.test.ts` (integration test with PostgreSQL)

**Estimated scope:** Medium

---

### Task 20: Implement GET /feed with owner authorization and isPublished filtering (basic, no pagination yet)

**Description:** Retrieve basic feed items with owner authorization (private mode) or public filtering (public mode). **Spec 05 field contracts** (public omits review fields). **Note:** Full pagination with cursors added in Phase 4 (Tasks 25-27); this provides basic feed response.

**Specification references:**
- `.kiro/specs/05-authentication.md` — GET /feed endpoint, exact field contracts
- `.kiro/specs/04-feed-engine.md` — Feed generation, pagination
- Review 2026-11-14: Explicitly require requireOwner guard, unauthenticated test, public DTO omissions

**Dependencies:** Task 19

**Acceptance criteria:**
- [ ] Route: `GET /feed?limit=10`
- [ ] **Authorization:**
  - Private mode: Uses `requireOwner` middleware
  - Public mode: No authentication, filters `is_published = true` only
- [ ] Query params: `limit` (optional, max 50, default 10)
- [ ] **Note:** `cursor` parameter deferred to Phase 4; this returns basic feed without pagination
- [ ] **Response per Spec 05:**
  - Private: Full FeedItem fields (`reviewCount`, `lastReviewedAt`, `savedAt`, `snoozedUntil`, etc.)
  - Public: Omit `reviewCount`, `lastReviewedAt`, `savedAt`, `snoozedUntil`, `sourceId`, `isPublished`, `updatedAt`
- [ ] Returns array of feed items (no `nextCursor` yet - pagination in Phase 4)
- [ ] **Tests required:**
  - Private mode: requireOwner enforced (401 test)
  - Public mode: Unauthenticated request returns only `is_published=true` items
  - Public mode: Response omits review fields

**Verification:**
- [ ] Integration test: Create published + unpublished items, public GET returns only published
- [ ] Negative test: Private mode, no auth → 401
- [ ] Public DTO test: Verify omitted fields not in response

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: integration test + negative tests)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/routes/feed.ts`
- `packages/api/src/__tests__/feed.test.ts`

**Estimated scope:** Medium

---

### Task 21: Implement GET /feed/:id with authorization and public DTO

**Description:** Retrieve single feed item by ID with owner authorization (private) or published-only check (public). **Spec 05 public DTO omissions.**

**Specification references:**
- `.kiro/specs/05-authentication.md` — GET /feed/:id endpoint, public filtering
- Review 2026-11-14: Require guard enforcement, public DTO omissions

**Dependencies:** Task 20

**Acceptance criteria:**
- [ ] Route: `GET /feed/:id`
- [ ] **Authorization:**
  - Private mode: Uses `requireOwner` middleware
  - Public mode: No auth, returns 404 if `is_published = false`
- [ ] **Response per Spec 05:**
  - Private: Full FeedItem fields
  - Public: Omit `sourceId`, `isPublished`, `reviewCount`, `lastReviewedAt`, `savedAt`, `snoozedUntil`, `updatedAt`
- [ ] Error responses: 401 (private, no auth), 403 (private, non-owner), 404 (not found or not published in public)

**Verification:**
- [ ] Integration test: Create unpublished item, public GET → 404
- [ ] Integration test: Create published item, public GET → 200 with omitted fields
- [ ] Negative test: Private mode, no auth → 401

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: integration test + negative tests)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/routes/feed.ts` (update with `:id` route)
- `packages/api/src/__tests__/feed-item.test.ts`

**Estimated scope:** Small

---

**PHASE 2 CHECKPOINT:** Complete protected path works end-to-end. Stop for human review before proceeding to Phase 3.

**Checkpoint criteria:**
- [ ] POST /import/markdown with real authorization → PostgreSQL → original cards → response (Spec 05 contract)
- [ ] GET /feed with owner authorization (private) or public filtering (public)
- [ ] GET /feed/:id with authorization and public DTO omissions
- [ ] Negative authorization tests pass (401, 403 where expected)
- [ ] PostgreSQL integration tests pass (not SQLite mocks)
- [ ] Early working path verified: `wrangler dev`, POST markdown, GET feed
- [ ] All Spec 05 contracts followed (exact response fields, validation)

---

## Phase 3: Review & Publish Mutations (Tasks 22-24)

### Task 22: Implement PUT /feed/:id/review (all actions per Spec 05)

**Description:** Record review actions on feed item. **Spec 05 defines all actions on PUT /feed/:id/review** (reviewed, saved, unsaved, snoozed, published, unpublished). **No separate /publish endpoint.**

**Specification references:**
- `.kiro/specs/05-authentication.md` — PUT /feed/:id/review with all actions
- `.kiro/specs/04-feed-engine.md` — Review recording logic
- Review 2026-11-14: All actions on /review endpoint, add invalid-action tests

**Dependencies:** Task 21, Task 24

**Note:** Requires `insertReviewEvent` query function from Task 24

**Acceptance criteria:**
- [ ] Route: `PUT /feed/:id/review`
- [ ] Protected: Uses `requireOwner` or `requireApiKey` based on visibility
- [ ] Request body: `{action: "reviewed" | "saved" | "unsaved" | "snoozed" | "published" | "unpublished"}`
- [ ] **All actions implemented per Spec 05:**
  - `reviewed`: Increment `review_count`, update `last_reviewed_at`
  - `saved`: Set `saved_at = now`
  - `unsaved`: Set `saved_at = null`
  - `snoozed`: Set `snoozed_until = now + config.snoozeDefaultHours`
  - `published`: Set `is_published = true`
  - `unpublished`: Set `is_published = false`
- [ ] Insert immutable `review_events` log record
- [ ] **Response per Spec 05:** Updated FeedItem fields (`reviewCount`, `lastReviewedAt`, `savedAt`, `snoozedUntil`, `isPublished`)
- [ ] Error responses: 400 (invalid action), 401/403 (auth), 404 (not found)
- [ ] **Invalid-action test:** `{action: "invalid"}` → 400

**Verification:**
- [ ] Integration test: All 6 actions update correct fields
- [ ] Invalid-action test: Unknown action → 400
- [ ] Negative auth test: No auth → 401

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: integration test with all actions + invalid-action test)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/routes/review.ts`
- `packages/api/src/__tests__/review.test.ts`

**Estimated scope:** Medium

---

### Task 23: Write integration tests for review state transitions

**Description:** Comprehensive integration tests for all review actions with PostgreSQL verification. Verify state transitions work correctly.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Review state transitions

**Dependencies:** Task 22

**Acceptance criteria:**
- [ ] Test: `reviewed` action increments count, updates timestamp
- [ ] Test: `saved` → `unsaved` → `saved` sequence works
- [ ] Test: `snoozed` sets future timestamp, excluded from feed until expired
- [ ] Test: `published` → `unpublished` sequence works, public GET respects state
- [ ] All tests use `TEST_DATABASE_URL` (PostgreSQL integration)

**Verification:**
- [ ] `TEST_DATABASE_URL=... pnpm --filter @recallfeed/api test` passes all review tests
- [ ] State transition tests verify database state after each action

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `TEST_DATABASE_URL=... pnpm test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/__tests__/review-integration.test.ts`

**Estimated scope:** Medium

---

### Task 24: Implement review_events immutable log with foreign keys

**Description:** Create `review_events` table insert logic with proper foreign key constraints. Immutable log of all review actions. **Note:** This task provides queries needed by Task 22 (PUT /review endpoint).

**Specification references:**
- `.kiro/specs/02-database-schema.md` — review_events table

**Dependencies:** Task 21

**Acceptance criteria:**
- [ ] `packages/database/src/queries/review-events.ts` created
- [ ] `insertReviewEvent(client, event)` function
- [ ] Foreign key constraint to `feed_items(id)` verified in migration
- [ ] Immutable: No update or delete functions (log only)
- [ ] Tests verify foreign key enforcement: Insert with non-existent feedItemId → error

**Verification:**
- [ ] `TEST_DATABASE_URL=... pnpm --filter @recallfeed/database test` passes review_events tests
- [ ] Foreign key test: Invalid feedItemId → constraint violation error

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `TEST_DATABASE_URL=... pnpm test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/database/src/queries/review-events.ts`
- `packages/database/src/queries/__tests__/review-events.test.ts`

**Estimated scope:** Small

---

**PHASE 3 CHECKPOINT:** All Spec 05 review/publish actions work. Stop for human review before proceeding to Phase 4.

**Checkpoint criteria:**
- [ ] PUT /feed/:id/review handles all 6 actions (reviewed, saved, unsaved, snoozed, published, unpublished)
- [ ] Invalid action returns 400
- [ ] State transitions verified with PostgreSQL
- [ ] review_events immutable log working with foreign keys
- [ ] No separate /publish endpoint (consolidated per Spec 05)

---

## Phase 4: Expanded Features (Tasks 25-28)

### Task 25: Implement recency resurfacing strategy (oldest first per Spec 04)

**Description:** Implement recency strategy that **sorts by oldest effective reviewed time first** (ascending order, not descending) per Spec 04.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Recency strategy, oldest first
- Review 2026-11-14: Recency sorts oldest first per Spec 04

**Dependencies:** Task 16

**Acceptance criteria:**
- [ ] `packages/feed-engine/src/strategies/recency.ts` implements `IResurfacingStrategy`
- [ ] `rank(candidates, config, now)` sorts by **oldest** `effectiveReviewedAt` first (ascending)
- [ ] `effectiveReviewedAt = lastReviewedAt ?? createdAt`
- [ ] Returns sorted array (oldest unreviewed items first)

**Verification:**
- [ ] Unit test: Create 3 feed items with different timestamps, recency sorts oldest first
- [ ] `pnpm --filter @recallfeed/feed-engine test` passes recency tests

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/feed-engine/src/strategies/recency.ts`
- `packages/feed-engine/src/__tests__/recency.test.ts`

**Estimated scope:** Small

---

### Task 26: Implement importance resurfacing strategy (lower reviewCount first)

**Description:** Implement importance strategy per Spec 04: prioritizes unreviewed/less-reviewed items.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Importance strategy (rank lower reviewCount first, filter snoozed)
- Review 2026-11-14T105728Z: Restore approved strategy (not weighted score)

**Dependencies:** Task 25

**Acceptance criteria:**
- [ ] `packages/feed-engine/src/strategies/importance.ts` implements `IResurfacingStrategy`
- [ ] `rank(candidates, config, now)` ranks by **lower reviewCount first** (unreviewed items prioritized)
- [ ] Filters out snoozed items: `snoozedUntil IS NULL OR snoozedUntil <= now`
- [ ] Returns sorted array: `reviewCount ASC, then effectiveReviewedAt ASC`
- [ ] Per Spec 04 approved behavior

**Verification:**
- [ ] Unit test: Items with reviewCount [0, 1, 3] sort as [0, 1, 3]
- [ ] Unit test: Snoozed items excluded from ranking
- [ ] `pnpm --filter @recallfeed/feed-engine test` passes importance tests

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/feed-engine/src/strategies/importance.ts`
- `packages/feed-engine/src/__tests__/importance.test.ts`

**Estimated scope:** Medium

---

### Task 27: Implement strategy-dependent pagination cursors (sortKey + id per Spec 04)

**Description:** Implement cursor encoding/decoding with **strategy-dependent sortKey** per Spec 04. Recency uses timestamp, importance uses score.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Pagination cursors with strategy-specific sortKey
- Review 2026-11-14: Strategy-dependent sortKey, not hardcoded lastReviewedAt

**Dependencies:** Task 26

**Acceptance criteria:**
- [ ] `packages/api/src/utils/cursor.ts` created
- [ ] `encodeCursor({id, sortKey})` returns base64 string
- [ ] `decodeCursor(cursor)` returns `{id, sortKey}`
- [ ] `extractSortKey(feedItem, strategy)` function:
  - Recency: Returns `lastReviewedAt ?? createdAt` timestamp
  - Importance: Returns computed importance score
- [ ] GET /feed uses strategy-specific sortKey for cursor generation

**Verification:**
- [ ] Unit tests: Encode/decode cursor round-trip
- [ ] Integration test: GET /feed with recency → cursor contains timestamp, GET /feed with importance → cursor contains score

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: integration test with both strategies)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/utils/cursor.ts`
- `packages/api/src/__tests__/cursor.test.ts`

**Estimated scope:** Small

---

### Task 28: Implement highlight card generator

**Description:** Implement highlight card generator that creates highlights from note content.

**Specification references:**
- `.kiro/specs/04-feed-engine.md` — Highlight generator

**Dependencies:** Task 16

**Acceptance criteria:**
- [ ] `packages/feed-engine/src/generators/highlight.ts` implements highlight logic
- [ ] Extracts quoted text or emphasized sections from notes
- [ ] Creates feed_items with `cardType = "highlight"`
- [ ] Register in card generator factory

**Verification:**
- [ ] Unit test: Note with `> quote` → highlight card created
- [ ] `pnpm --filter @recallfeed/feed-engine test` passes highlight tests

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: `pnpm --filter @recallfeed/feed-engine test`)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/feed-engine/src/generators/highlight.ts`
- `packages/feed-engine/src/__tests__/highlight.test.ts`

**Estimated scope:** Medium

---

**PHASE 4 CHECKPOINT:** Multiple strategies work, pagination handles strategy-specific sort keys. Stop for human review before proceeding to Phase 5.

**Checkpoint criteria:**
- [ ] Recency strategy sorts oldest first (ascending)
- [ ] Importance strategy scores and ranks correctly
- [ ] Strategy-dependent pagination cursors work (timestamp for recency, score for importance)
- [ ] Highlight card generator creates cards
- [ ] All feed-engine tests pass

---

## Phase 5: Source Management (Tasks 29-30)

**Note:** CSRF/cache protection moved to Task 18 (Phase 2)

### Task 29: Implement POST /sources (Notion source creation per Spec 05)

**Description:** Create Notion source records per Spec 05 contract. **Notion connector deferred to Gate 4.**

**Specification references:**
- `.kiro/specs/05-authentication.md` — POST /sources endpoint

**Dependencies:** Task 11

**Acceptance criteria:**
- [ ] Route: `POST /sources`
- [ ] Protected: Uses `requireOwner` or `requireApiKey` based on visibility
- [ ] Request body per Spec 05: `{name, type: "notion", config: {databaseId}}`
- [ ] Response per Spec 05: Created Source with `id`, `isActive=true`, `lastSyncedAt=null`
- [ ] Error responses: 400 (invalid type or missing config), 401/403 (auth)

**Verification:**
- [ ] Integration test: POST /sources → verify row in sources table
- [ ] Negative test: No auth → 401

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: integration test)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/routes/sources.ts`
- `packages/api/src/__tests__/sources.test.ts`

**Estimated scope:** Small

---

### Task 30: Implement POST /sources/:id/import stub (returns 501 until Gate 4)

**Description:** Notion import endpoint stub. **Returns 501 Not Implemented** until Notion connector implemented in Gate 4.

**Specification references:**
- `.kiro/specs/05-authentication.md` — POST /sources/:id/import endpoint

**Dependencies:** Task 29

**Acceptance criteria:**
- [ ] Route: `POST /sources/:id/import`
- [ ] Protected: Uses `requireOwner` or `requireApiKey` based on visibility
- [ ] **Returns 501 with message:** `{"error": "Notion connector not implemented yet", "code": "NOT_IMPLEMENTED"}`
- [ ] Test verifies 501 response

**Verification:**
- [ ] Authenticated curl: `curl -X POST http://localhost:8787/sources/<id>/import -H "X-API-Key: $API_SECRET_KEY"` → 501
- [ ] Unauthenticated curl returns 401 (auth required before 501)

**Status:**
- [ ] Implemented (commit: _______)
- [ ] Verified (command: manual curl or integration test)
- [ ] Reviewed (evidence: ______)

**Files created:**
- `packages/api/src/routes/sources.ts` (update with `:id/import` route)
- `packages/api/src/__tests__/sources.test.ts` (update with 501 test)

**Estimated scope:** Small

---

---

**PHASE 5 CHECKPOINT (GATE 2 COMPLETE):** All foundation features complete, security hardening verified (CSRF/cache in Task 18), ready for demo apps (Gate 3).

**Note:** Task 31 (Origin/CSRF + cache headers) was consolidated into Task 18. Phase 5 concludes with Task 30.

**Checkpoint criteria:**
- [ ] POST /sources creates Notion source records
- [ ] POST /sources/:id/import returns 501 (Notion connector deferred)
- [ ] Origin/CSRF checks protect private mutations (Task 18)
- [ ] Cache-Control: private headers on private responses (Task 18)
- [ ] Origin/CSRF checks protect private mutations
- [ ] Cache-Control: private headers on private responses
- [ ] All Gate 2 success criteria met (see plan.md)

---

## Gate 2 Success Criteria (Final Review)

Before advancing to Gate 3, verify all criteria from `tasks/plan.md`:

- [ ] All packages build without errors (`pnpm build`)
- [ ] All tests pass (`pnpm test` with TEST_DATABASE_URL)
- [ ] TypeScript strict mode enabled, core package has zero runtime dependencies
- [ ] **Early protected path verified:** POST /import/markdown with real authorization → PostgreSQL → GET /feed response
- [ ] **Authorization enforced:** Negative tests prove non-owners/missing keys rejected before logic
- [ ] `isPublished` filtering verified with PostgreSQL queries (not SQLite)
- [ ] Review and publish mutations work with state transitions (all 6 actions)
- [ ] No credentials in code or logs
- [ ] Migrations run forward-only (no down migrations per Spec 02)
- [ ] **PostgreSQL integration checks pass** (not SQLite mocks)
- [ ] **Kiro skills properly installed** (native structure with discovery evidence)
- [ ] Code follows project conventions (ESLint max-lines enforced on all handwritten JS/TS including tests)
- [ ] All functions have JSDoc comments
- [ ] Git repository initialized with clean history, no secrets staged
- [ ] **Each task tracks:** Implemented (commit SHA) / Verified (command output) / Reviewed (evidence)
- [ ] **Phase checkpoints completed:** Human review at boundaries (tasks 7, 21, 24, 28, 30)

---

## Out of Scope (Deferred to Later Gates)

**Gate 3 — Demo Applications:**
- ReflectionFeed (Next.js + Cloudflare Access)
- DevRecall (React + Vite + API keys)
- DevRecall visibility check wrapper
- ReflectionFeed OpenNext integration

**Gate 4 — Optional Features:**
- Notion connector implementation (POST /sources/:id/import functional)
- AI enrichment pipeline (`@recallfeed/ai`)
- Inngest workflows (async processing)
- Reflection prompt generation

**Gate 5 — Launch Readiness:**
- Documentation polish
- Hackathon submission materials
- Performance optimization
- Optional standalone repos

---

## Task Closing Workflow

Per incremental-implementation discipline, **implement → test → verify → commit** (not commit before verification):

1. **Implement:** Write code for task
2. **Test:** Write or update tests
3. **Verify:** Run `pnpm test && pnpm build && pnpm typecheck` (all pass)
4. **Commit:** `git commit -m "descriptive message"`
5. **Record:** Update task Status section with commit SHA, verification output, review evidence

**Never commit before verification passes.**

---

## Corrections Applied from 2026-11-14 Planning Review

This todo.md addresses all findings from planning review cycle 2:

1. ✅ **Phase 1 conflicts fixed:** ESLint includes tests, TypeScript creates root tsconfig.json, Vitest has smoke test, Git commits existing specs with secrets check
2. ✅ **Early path reorganized:** feed-engine (Task 16), Worker entry (Task 17), auth guards (Task 18) BEFORE POST /import/markdown (Task 19)
3. ✅ **API contracts restored:** Spec 05 exact response fields, all review actions on /review endpoint (no separate /publish), source-scoped deduplication clarified
4. ✅ **PostgreSQL transport declared:** Task 10 specifies local PostgreSQL or Neon HTTP test DB
5. ✅ **Checkpoint review clarified:** Human approval at phase boundaries (tasks 7, 21, 24, 28, 30), within-phase "Reviewed" is independent verification (test suite)
6. ✅ **Skill setup complete:** Native Kiro structure verified, discovery evidence provided (Task 6)

**All tasks reconciled against approved Specs 01-09, no invented requirements.**

