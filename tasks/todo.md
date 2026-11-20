# RecallFeed Implementation Tasks — Gate 2 (Corrected)

**Status:** Phase 1 (Tasks 1-7) implemented, verified, and independently reviewed by Firstmate 2026-11-14 (APPROVE WITH CONDITIONS at `a2ce7c6`; Node metadata condition corrected, see Phase 1 Follow-up). Phases 2-5 are not authorized. See "Phase 1 Execution Record" below the Phase 1 checkpoint.  
**Based on:** `tasks/plan.md` (corrected per 2026-11-14 planning review)  
**Tracking:** Markdown checklist with explicit Implemented/Verified/Reviewed state

---

## Task State Protocol

Each task tracks three stages:

1. **Implemented:** Code written, committed (record commit SHA)
2. **Verified (self-tested):** the implementing worker ran the checks: tests, build, typecheck, lint. Record the exact commands, versions, results, and skipped counts. Running your own tests is verification, not independent review.
3. **Reviewed:** an independent review by someone other than the implementer (for example Firstmate or the user). Record the reviewer, the date, the verdict, and **the revision (commit SHA) that was reviewed**. A passing test suite is Verified evidence, not Reviewed evidence, however thorough it is.

**Delivery states (added 2026-11-14, see `CONTRIBUTING.md`):** two further states are kept distinct from the three above. **Pushed** = the commit is on the remote (record remote, branch, and the SHA read back from the server). **Merged** = the branch tip is contained in `main` (record the merge or fast-forward commit). Tasks 1-10 predate the extra fields; their pushed state is recorded in the execution records, and later tasks should add `- [ ] Pushed` and `- [ ] Merged` lines.

**Format per task:**
```markdown
**Status:**
- [ ] Implemented (commit: <SHA>)
- [ ] Verified (self-tested: <commands, versions, results, skipped counts>)
- [ ] Reviewed (independent: <reviewer, date, verdict, revision reviewed>)
- [ ] Pushed (<remote, branch, SHA read back from the server>)
- [ ] Merged (<merge or fast-forward commit>)
```

**Checkpoint boundaries:** Human approval required at phase boundaries (after Task 7, Task 21, **Task 23, which ends Phase 3 because Phase 3 runs 24 → 22 → 23**, Task 28, and Task 30). Within a phase, no individual task needs a manual human approval: the implementing worker records Implemented and Verified (self-tested) as each task is done. "Reviewed" is recorded only when an independent review has examined a stated revision. That review normally happens at the phase or milestone checkpoint (or at an earlier boundary the user sets), and one review may cover many tasks; record the same review evidence on each task it covers. A task that is not yet reviewed does not block the next task in the same phase.

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
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`: APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`; the one condition, Node metadata, is corrected in the follow-up commit below and that correction is not yet independently re-reviewed)

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
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`: APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`; the one condition, Node metadata, is corrected in the follow-up commit below and that correction is not yet independently re-reviewed)

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
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`: APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`; the one condition, Node metadata, is corrected in the follow-up commit below and that correction is not yet independently re-reviewed)

**Deviations:** The machine default is Node 20.20.2 but the toolchain requires Node >=22 (Vitest 5 and Wrangler 4.162 declare `>=22.12.0`; the Workers plugin depends on Wrangler 4.162 and Miniflare 5, which declare `>=22`). All commands ran with the already-installed nvm Node 22.23.3. Added `.nvmrc` and root `engines.node`. Original value `>=22.12.0` was corrected on 2026-11-14 after Firstmate's review: ESLint 10.15.0 declares `^20.19.0 || ^22.13.0 || >=24`, so `>=22.12.0` wrongly admitted 22.12.x and 23.x. The range is now `^22.13.0 || >=24.0.0`, the intersection of `engines.node` across all 139 installed packages that declare one, and `.nvmrc` pins the tested `22.23.3`. `pnpm lint` runs `eslint .` at the root so it also covers root config files; `turbo.json` still defines a `lint` task and core has a `lint` script. `typecheck` runs the root `tsc --noEmit` and then `turbo run typecheck`.

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
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`: APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`; the one condition, Node metadata, is corrected in the follow-up commit below and that correction is not yet independently re-reviewed)

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
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`: APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`; the one condition, Node metadata, is corrected in the follow-up commit below and that correction is not yet independently re-reviewed)

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
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`: APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`; the one condition, Node metadata, is corrected in the follow-up commit below and that correction is not yet independently re-reviewed)

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

**Checkpoint criteria** (self-verified 2026-11-14 on Node 22.23.3; independently reviewed by Firstmate at `a2ce7c6`, APPROVE WITH CONDITIONS):
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

**Record reconciliations made in this pass (review item 5, narrow):** `tasks/plan.md` no longer says "Implement multiple tasks in one commit"; the two checkpoint lists in this file now read "7, 21, 24, 28, 30". [Superseded: Phase 3 runs 24 → 22 → 23, so its boundary is Task 23; see the Task State Protocol and the later corrections.] The remaining references to Task 31 in this file are historical notes about its consolidation into Task 18.

**Deliberately not changed (later-phase corrections from the review, to settle before those phases are authorized):** Task 10 database transport; Task 27 cursor and its reference to a removed importance score; the basic-feed versus full Spec 05 contract distinction; the Phase 3 execution order and the "checkpoint after task 24" phrasing. Task 17 also needs a Wrangler version decision, since `4.148.0` is not what the installed plugin pins.

**Review state:** Tasks 1-7 were independently reviewed by Firstmate (`firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`, APPROVE WITH CONDITIONS, reviewed HEAD `a2ce7c6`). The review verified lint, build, typecheck, test, and coverage independently, matched all 25 file hashes, and matched all 27 Spec 01 declarations. It did not independently reinstall from the registry, so the clean-install result above remains this session's evidence. Later phases are not reviewed or authorized.

### Phase 1 Follow-up (after Firstmate review)

**Condition closed, pending re-review:** `package.json` `engines.node` changed from `>=22.12.0` to `^22.13.0 || >=24.0.0`; `.nvmrc` changed from `22` to `22.23.3`. Evidence (run 2026-11-14 before the commit):

- The range is the intersection of `engines.node` across all 139 installed packages that declare one (computed with the installed `semver`). Accepted: 22.13.0, 22.23.3, 24.0.0, 24.22.2, 26.0.0. Rejected: 20.20.2, 22.12.0, 23.0.0, 23.11.0. `.nvmrc` is inside the range.
- Node 22.23.3, working tree: `pnpm lint`, `build`, `typecheck`, `test`, `test:coverage` all exit 0; 10 tests passed.
- Node 24.22.2, fresh copy of the tracked files, `pnpm install --frozen-lockfile` exit 0, then the same five commands all exit 0; 10 tests passed. This exercises the `>=24` half of the range with a real install, not only the semver arithmetic.
- Node 20.20.2, `pnpm install --frozen-lockfile --engine-strict` fails with `ERR_PNPM_UNSUPPORTED_ENGINE` (`Expected version: ^22.13.0 || >=24.0.0`, `Got: v20.20.2`), so the declared range is enforceable.
- Not run: Node 22.13.0 through 22.22.x (only 22.22.2, 22.23.2, 22.23.3 are installed locally) and Node 25/26 (not installed); their acceptance rests on the manifests only.

**Review conditions carried forward, not changed in Phase 1:** the `IFeedEngine.importMarkdown` JSDoc claims the 100 KB limit keeps the import within the CPU budget. Firstmate treats that as an unproved claim; reword it when the import is implemented, backed by Workers benchmarks, without weakening acceptance criteria. Packages are private and source-exported; nothing here certifies a publishable package.

---

## Phase 2: Early Working Path - Protected Markdown Import (Tasks 8-21)

> **Scope note (2026-11-14):** the Phase 2 checkpoint verifies an **intermediate** API, not the final Spec 05 contract. `GET /feed` returns a basic list with `limit` and no `cursor` or `nextCursor`; cursor pagination and strategy-based ordering arrive in Phase 4 (Tasks 25-27). Passing the Phase 2 checkpoint does not mean every Spec 05 response, ordering, and pagination contract passes. Tasks 19-21 are checked against their own acceptance criteria only. The `X-API-Key` curl examples need an explicitly public local configuration; the private default requires the trusted Access identity.

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
- [x] Implemented (commit: `f07e34d`)
- [x] Verified (2026-11-14, Node 22.23.3: `pnpm build` → exit 0 for both packages; `pnpm typecheck` → exit 0 (three configs: Worker code, Node scripts, tests); `pnpm lint` → exit 0. `createDb` is exercised in the Workers runtime by `driver.test.ts` and `schema.test.ts`. `@recallfeed/database` dependencies are `@neondatabase/serverless ^1.2.1` and `@recallfeed/core workspace:*` only; no pooling or ORM library.)
- [x] Reviewed (Firstmate independent review: `2026-11-14T163124Z-database.md` REQUEST CHANGES, then `2026-11-14T171500Z-database-corrections.md` APPROVE at `29538fb`; it independently reran lint, build, typecheck, and the no-database tests, ran SELECT-only live checks, and mutated the corrected files in an isolated copy. It did not rerun the destructive integration suite; that remains this project's own evidence)
- [x] Pushed (`origin/main` = `29538fb9def2ac9717c5310ffd8da564a69a0112`, read back from the server 2026-11-14)
- [ ] Merged (not applicable: committed directly to `main` before the phase-branch workflow; no branch to merge)

**Deviations:** The factory is named `createDb` (with `DbClient`), as approved Spec 02 and Spec 07 name it; this task's text said `createDatabaseClient`. A `DatabaseEnv` type holds the `DATABASE_URL` binding. `tsx`, `@types/node`, `ws`, and `@types/ws` are dev tooling for the Node-only migration CLI; `tsx` and `@types/node` sit at the workspace root and `ws`/`@types/ws` in this package.

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
- [x] Implemented (commit: `f07e34d`)
- [x] Verified against a real PostgreSQL 17.12, not a syntax check: the `pnpm db:migrate` CLI was run on a reset database. First run → `applied 001_initial.sql`, `done: 1 applied, 0 skipped`; second run → `skipped 001_initial.sql`, `done: 0 applied, 1 skipped`. Ground truth read with `psql` inside the container: `_schema_migrations` holds exactly `001_initial.sql`; tables are `_schema_migrations, feed_items, notes, review_events, sources`; 11 `*_idx` indexes exist; `notes_source_content_hash_idx` is `CREATE UNIQUE INDEX … (source_id, content_hash)`. A deliberately failing second migration (`CREATE TABLE should_not_exist …; SELECT * FROM table_that_does_not_exist`) was rejected, left no `should_not_exist` table and no tracking row. The CLI without `DATABASE_URL` exits 1 and changes nothing. The 12 unit tests in `migrate.test.ts` cover numeric ordering (`010` after `002`), malformed names, duplicate prefixes, skipping, and rollback.
- [x] Reviewed (Firstmate independent review: `2026-11-14T163124Z-database.md` REQUEST CHANGES, then `2026-11-14T171500Z-database-corrections.md` APPROVE at `29538fb`; it independently reran lint, build, typecheck, and the no-database tests, ran SELECT-only live checks, and mutated the corrected files in an isolated copy. It did not rerun the destructive integration suite; that remains this project's own evidence)
- [x] Pushed (`origin/main` = `29538fb9def2ac9717c5310ffd8da564a69a0112`, read back from the server 2026-11-14)
- [ ] Merged (not applicable: committed directly to `main` before the phase-branch workflow; no branch to merge)

**Deviations and notes:** Spec 02 is internally inconsistent about ordering ("lexicographic" in the acceptance list, "numeric by prefix" in the algorithm); the runner sorts numerically, as the algorithm and the example in the spec require. `001_initial.sql` also contains `CREATE TABLE IF NOT EXISTS _schema_migrations` because the spec says both that the runner creates it and that `001` creates all five tables; the statement is idempotent. The runner uses a WebSocket `Client` session in Node. The HTTP `neon()` function does support non-interactive transactions (`sql.transaction([...])`), but it rejects a multi-statement string ("cannot insert multiple commands into a prepared statement") and cannot hold an interactive `BEGIN … COMMIT` across stateless calls (checked against PostgreSQL 17.12 on 2026-11-14); a migration file needs both. This wording was corrected after Firstmate's review. Files are `src/migrate.ts` (logic), `src/migrate-node.ts` and `src/migrate-cli.ts` (Node entry).

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
- **Selected 2026-11-14 (user-authorized, implemented in `f07e34d`, corrected in `1170b07`):** neither option as written. The transport is `@neondatabase/serverless` over HTTP to `ghcr.io/timowilhelm/local-neon-http-proxy` (pinned by digest) in front of a local PostgreSQL 17, run by Docker Compose under Colima; the URL host is `db.localtest.me`. An ordinary `localhost:5432` listener does not work with the HTTP client. No cloud resource is used; Option B stays unused.
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
- [x] Implemented (commit: `f07e34d`)
- [x] Verified (2026-11-14, see "Phase 2 database spike evidence" below)
- [x] Reviewed (Firstmate independent review: `2026-11-14T163124Z-database.md` REQUEST CHANGES, then `2026-11-14T171500Z-database-corrections.md` APPROVE at `29538fb`; it independently reran lint, build, typecheck, and the no-database tests, ran SELECT-only live checks, and mutated the corrected files in an isolated copy. It did not rerun the destructive integration suite; that remains this project's own evidence)
- [x] Pushed (`origin/main` = `29538fb9def2ac9717c5310ffd8da564a69a0112`, read back from the server 2026-11-14)
- [ ] Merged (not applicable: committed directly to `main` before the phase-branch workflow; no branch to merge)

**Transport chosen:** Option A, refined. `@neondatabase/serverless` over HTTP to a local Neon-compatible proxy (`ghcr.io/timowilhelm/local-neon-http-proxy`, pinned by digest) in front of PostgreSQL 17.12, both run by Docker Compose under Colima. No cloud resources. An ordinary `postgresql://localhost:5432` listener is not enough; the proxy is what makes the HTTP client work.

**Files created:**
- `.env.test.example`
- `packages/database/src/__tests__/setup.ts`
- `packages/database/src/__tests__/smoke.test.ts` (PostgreSQL feature verification)

**Estimated scope:** Small

---

### Phase 2 database spike evidence (Tasks 8-10 only; stop point for Firstmate review)

Run 2026-11-14 under the user's authorization to install Colima/Docker/Compose and prove the Neon HTTP driver from the Workers test runtime. Work stopped after Task 10; Tasks 11-21 are not started.

**Host and tool versions:** macOS 26.5.2 arm64, 8 CPUs, 16 GB. Installed with Homebrew, no sudo: `colima 0.10.3`, `lima 2.3.0`, `docker 29.9.3` (client; server 29.5.2 linux/arm64), `docker-compose 5.7.1`. Colima VM: 2 CPUs, 3 GB, 20 GB disk, docker runtime, default profile. Starting Colima created `~/.colima`, `~/.lima`, and a `colima` Docker context in `~/.docker`. Not done: no `~/.docker/config.json` plugin edit (the standalone `docker-compose` binary is used), no login service, no hosts-file edit (DNS for `db.localtest.me` already resolved to 127.0.0.1), no sudo.

**Images, pinned by digest in `packages/database/docker/compose.test.yaml`:**
- `postgres:17@sha256:846a7ddaa67a4b354ae1d21087b683901aa6113a4ed626d3787cfbf6c85e3e07` → PostgreSQL 17.12 (Debian), arm64.
- `ghcr.io/timowilhelm/local-neon-http-proxy@sha256:cd2ae14edf2feafbc3330492de5c80506f77274c3bd013154cdef697bdeb768a`, built 2026-03-27 from the community project (CC0-1.0), arm64.

**Isolation:** compose project `recallfeed-test`; PostgreSQL data on tmpfs (gone on teardown); PostgreSQL publishes no port; only the proxy publishes `127.0.0.1:4444` (checked with `lsof`: one listener, bound to 127.0.0.1, nothing on 5432). Development data must use a different compose project, volume, and ports; none was created. Test harness guard `assertSafeTestDatabaseUrl` allows only `localhost`, `127.0.0.1`, `::1`, `db.localtest.me` and a database name containing `test` as a whole word, because the setup drops and recreates the `public` schema.

**Driver proof (the main question):** `@neondatabase/serverless@1.2.1`, called as `createDb(url)` inside workerd (`navigator.userAgent === "Cloudflare-Workers"` asserted), returned `PostgreSQL 17.12 (Debian 17.12-1.pgdg13+1) on aarch64-unknown-linux-gnu` and `current_database() = recallfeed_test`, over HTTP via the proxy. The Neon driver's `fetchEndpoint`, `wsProxy`, and `useSecureWebSocket` settings are changed only when the URL host is exactly `db.localtest.me` (`local-proxy.ts`; 3 tests, including that real Neon and lookalike hosts are left untouched).

**Test results (Node 22.23.3):**

| Command | Result |
|---|---|
| `pnpm lint`, `pnpm build`, `pnpm typecheck` | all exit 0 |
| `pnpm test` with no database | exit 0; core 10 passed; database 29 passed, 16 skipped (the integration suites skip without `TEST_DATABASE_URL`) |
| `pnpm --filter @recallfeed/database test:integration` | exit 0; 5 files, 45 tests passed, 0 skipped |
| `pnpm test:coverage` with the database | exit 0; 7 files, 55 tests passed; 100% statements, branches, functions, lines on `errors.ts`, `client.ts`, `local-proxy.ts`, `migrate.ts`, `test-safety.ts` |

**Named constraints (HTTP driver, in workerd; each failure's `code` and `constraint` fields were asserted, not only message text):** duplicate `(source_id, content_hash)` → `23505`, constraint `notes_source_content_hash_idx`; the same hash in another source is accepted; second card of one type on a note → `23505`, `feed_items_note_card_type_idx`; CHECK violations → `23514` with the PostgreSQL-generated names `sources_type_check`, `feed_items_card_type_check`, `review_events_action_check` (Spec 02 leaves these unnamed); orphan note → `23503`, `notes_source_id_fkey`; deleting a source cascades through notes, feed items, and review events. All 11 Spec 02 indexes exist with the expected columns, `UNIQUE`, partial predicates (`WHERE (is_published = true)`, `WHERE (snoozed_until IS NOT NULL)`), `NULLS FIRST`, and `DESC`. UUID, JSONB, and TIMESTAMPTZ column types were read from `information_schema`; a JSONB object and a `-05:00` timestamp round-tripped correctly; column defaults (`is_published = false`, `review_count = 0`) held; `sql.query($1, $2)` parameters worked.

**Negative controls:** changing `notes_source_content_hash_idx` to non-unique and renaming `feed_items_note_card_type_idx` made 3 integration tests fail (index shape, and both duplicate-rejection tests); migration restored byte for byte. The migration CLI without `DATABASE_URL` refused (exit 1).

**Problems found and fixed during the work (all mine):**
1. The first database build failed with `TS6059` (rootDir) because packages export TypeScript source. `tsc` still emitted files, writing 8 stray `.js`/`.d.ts` files into `packages/core/src/`. Vite resolves `./errors` to `errors.js` before `errors.ts`, so tests ran uninstrumented output and `errors.ts` coverage fell from 100% to 0%. I first guessed the cause wrongly (duplicate Vitest copies, then deduplicated; coverage did not change) and found the real cause by building the pushed commit in a clean worktree (100%), then moving `packages/database` aside (still 0%), then reading `git status`. Fixes: deleted the 8 untracked files; `noEmitOnError: true` in both build configs; dropped `rootDir` from the database build config; `.gitignore` now ignores `packages/*/src/**/*.js`.
2. `.env.test.example` was ignored by my own `.env.*` rule; added `!.env.*.example`.
3. A first migration-CLI "first run" check was invalid: a zsh word-splitting mistake meant the database was never reset, so the CLI correctly skipped. Redone with shell functions after a verified reset (`tables after reset: 0`).
4. A test expected `WHERE is_published`; PostgreSQL stores the predicate as `WHERE (is_published = true)`. Fixed the assertion, not the schema.
5. My `tsx`/`@types/node` install first went into the database package and produced extra peer-dependency resolutions; they now live at the workspace root, followed by a clean reinstall.

**Not verified / limits:** the proxy is a community image, so parity with hosted Neon is high but unproven; no real Neon branch was used. WebSocket transactions were verified only from Node (`ws`), not from workerd. First use of `db.localtest.me` needs internet DNS. (The earlier coverage exclusion of `*-node.ts` was replaced in the correction pass below; only `*-cli.ts` entry points are excluded now.)

**Stop point:** Tasks 8-10 are implemented and self-verified. Tasks 11-21 are not started. Awaiting independent Firstmate review.

---

### Phase 2 database spike: correction pass after Firstmate review (R1, R2, and related corrections)

Run 2026-11-14 under the user's correction-only authorization, from `firstmate/data/recallfeed/reviews/2026-11-14T163124Z-database.md` (verdict REQUEST CHANGES). Architecture unchanged. Tasks 11-21 not started. Nothing pushed. No cloud resources.

**R1 reproduced first (local, no network):** the guard accepted `postgres://…@db.localtest.me:5432/recallfeed_test?host=ep-example.neon.tech`, and the real driver's effective host was `ep-example.neon.tech`.
**R2 reproduced first:** `neonConfig.useSecureWebSocket` went `true` → `false` after a local call and stayed `false` after a nonlocal call.

**R1 fix: three gates before any destructive SQL** (`test-safety.ts`, `test-fixture.ts`, `test-fixture-node.ts`, `docker/init-test-fixture.sql`):
1. URL as written: allowed host, database name exactly `recallfeed_test` (the old "contains the word test" rule was dropped; it accepted `customer_test_backup`), and **no query string or fragment at all**, judged on the raw string.
2. The driver's effective target: an unconnected `Client` is built and its `host`, `port`, and `database` must equal the URL's.
3. The live session: `current_database()` must be `recallfeed_test` **and** the database must carry the comment `recallfeed-disposable-test-fixture:v1`, which the container's init script writes when the fixture is created. A database comment sits outside `public`, so the schema reset keeps it (verified: the marker survived a reset and a CLI migration). The destructive `DROP SCHEMA` / `CREATE SCHEMA` run on that same session, after the check.

**R2 fix:** the unencrypted WebSocket settings (`useSecureWebSocket = false`, `wsProxy`) are now set on one `Client`'s own `neonConfig`, only when that client's effective host is exactly `db.localtest.me`, and the installed `wsProxy` throws for any other host instead of falling back. Nothing is written to the process-wide config. Verified in the real driver: `client.neonConfig` is a separate object, and setting it on one client leaves another client and the global untouched. HTTP routing (`fetchEndpoint`) is the one setting the driver only allows globally, so `configureLocalNeonHttp` installs a function that answers only for `db.localtest.me` and delegates every other host to the driver's default endpoint (`https://api.neon.tech/sql` for a Neon host); repeated calls do not stack wrappers.

**Related corrections:**
- `readMigrationFiles(directory)` used `new URL(filename, "file://" + directory)`, which resolves one directory too high when the path has no trailing slash. Now `path.join`. Regression test passes with and without the slash, with a temp directory, and for a missing directory.
- The statement that HTTP `neon()` "cannot run transactions" was wrong; corrected in `README.md`, `migrate.ts`, `migrate-node.ts`, and Task 9 above, using a live check: `sql.transaction([a, b])` works; a multi-statement string is rejected; an interactive `BEGIN` does not persist across calls.
- New plain-Node Vitest project (`vitest.node.config.ts`, files `*.node.test.ts`) for the filesystem reader, the connection lifecycle, and the guarded fixture client. `pnpm test` runs both projects. Coverage now measures the Node files too; only `*-cli.ts` entry points are excluded.
- `docker/compose.test.yaml` mounts `init-test-fixture.sql`; the stack was recreated so the container carries the marker (the earlier container did not, and the new setup would correctly have refused it).
- `tasks/phase2-proposal.md` now records the decided database option.

**Regression tests (all named `regression R1` / `regression R2`):** gate 1 rejects `?host=`, `?hostname=`, `?database=`, `?port=`, `?sslmode`, a fragment, a bare `?`, and seven non-fixture local database names including `customer_test_backup`; the review's exact URL passes the old host check but the real driver resolves a different host and gate 2 refuses it; scripted sessions with a wrong database name, a missing marker, or a wrong marker receive **zero** destructive statements and the identity check always precedes them; against the live fixture, removing the marker makes `resetDisposableFixture` refuse, and the existing data is unchanged afterward, with the marker restored in a `finally`; a local client's TLS relaxation does not reach a later nonlocal client, the global stays `true`, the local client refuses an unencrypted socket to any other host, and a `?host=` override gets no relaxation; a local client whose socket constructor throws rejects and leaves no global state; a `migrateDatabase` run against the local proxy leaves the global `true`.

**Verification (Node 22.23.3, from clean `dist/`, `coverage/`, `.turbo/`):**

| Command | Result |
|---|---|
| `pnpm lint`, `pnpm build`, `pnpm typecheck` | all exit 0 |
| `pnpm test`, no database | exit 0; core 10 passed; database workerd 61 passed + 16 skipped; database Node 13 passed + 4 skipped |
| `pnpm --filter @recallfeed/database test:integration` | exit 0; workerd 77 passed; Node 17 passed; 0 skipped |
| `pnpm test:coverage` with the database | exit 0; 10 files, 104 tests; 100% statements, functions, lines; 97.91% branches |
| `pnpm db:migrate` twice on a reset schema | `applied 001_initial.sql`, then `skipped 001_initial.sql`; marker survived the reset |
| Review reproductions on corrected code | R1: review URL refused before any client was built (`VALIDATION_TEST_DATABASE_PARAMS`); R2: global stayed `true` after both local and nonlocal configuration |

**Mutation checks (each reverted, files diffed identical afterward):** removing the query-string rejection from gate 1 failed 8 tests (7 workerd, 1 Node); setting the TLS relaxation process-wide again and dropping the host restriction failed 3 tests.

**Fuzz of gate 1 against the real driver parser** (18 URLs including userinfo tricks, trailing dots, case, percent-encoding, `127.1`, IPv6): no URL passed gate 1 while the driver resolved a different target. Gate 2 therefore guards against future parser drift and is not shown to catch a live case beyond the `?host=` override that gate 1 now refuses first.

**Mistakes of mine during this pass, found by running things:** an interrupted file write (rewritten in full); a `fetchEndpoint` default I assumed was a string (it is a function; checked before coding the delegation); a test expecting a bare `?` to survive URL parsing (it does not; gate 1 now checks the raw string); a workerd test assuming a throwing socket constructor rejects (in workerd the driver took a different path and appears to have reached the live proxy; moved to the Node project where it is deterministic); a Node test assuming `:1` in the URL breaks the connection (the proxy ignores the URL port; removed, because the constructor-failure test already covers a real connection failure); a `timeout` command that does not exist on macOS, so one probe printed nothing and is not claimed.

**Not verified / limits:** the `host`, `port`, and `database` fields I read from the driver's `Client` are the effective values for this driver version (1.2.1); a future driver version could change them, which gate 2's test would reveal. The proxy ignores the URL's port and database, so a live "wrong database" case cannot be produced through it; gate 3 is exercised with scripted sessions and with the marker removed live. No hosted-Neon, deployment, or cloud check. Wrangler `4.148.0` versus `4.162.0` and the later-phase plan wording (Task 27 cursor, Phase 3 order, basic-feed wording, `importMarkdown` JSDoc) are deliberately **not** changed in this pass.

**Stop point:** correction pass complete, awaiting independent Firstmate review. The database commits are not pushed.

---

### Delivery and workflow state (2026-11-14)

| Item | State | Evidence |
|---|---|---|
| Phase 1, Tasks 1-7 | implemented, self-tested, **independently reviewed**, **pushed** | Firstmate `2026-11-14T145842Z-phase1.md`; pushed in `4f0207b` |
| Phase 2 database spike, Tasks 8-10 | implemented, self-tested, **independently reviewed**, **pushed** | Firstmate `2026-11-14T171500Z-database-corrections.md` APPROVE; `origin/main` = `29538fb9def2ac9717c5310ffd8da564a69a0112` |
| Tasks 11-21 | implemented, self-tested, **independently reviewed (APPROVE)**, **pushed, merged** | PR #2, merge commit `ac40227060d962617367ed132102d392b530be8a`; see the Phase 2 Execution Record |
| Workflow setup | implemented, self-tested, **pushed and merged** | PR #1, merge commit `8222b7c` (superseded the "not pushed" state this row recorded when the branch was written) |

**Repository:** https://github.com/pauxiel/recallfeed, private. **Remote baseline pushed:** a normal fast-forward `4f0207b..29538fb` after checking the destination, clean tree, reviewed HEAD, that remote `main` was an ancestor of HEAD, and that no unreviewed commit was included. No force, squash, rebase, reset, or history rewrite.

**Workflow setup branch:** `chore/workflow-setup`, cut from `29538fb` with `treehouse get --lease --base main -b chore/workflow-setup --lease-holder recallfeed-kiro --json`. The workspace is a linked git worktree distinct from the primary checkout; dependencies were installed there with `pnpm install --frozen-lockfile` on Node 22.23.3 and pnpm 10.18.3 from `.nvmrc` and `packageManager`. See `CONTRIBUTING.md` for the workflow, and the review request on this branch for the actual workspace path, lease id, and commits.

**Planning corrections made on this branch (focused edits, specs untouched):** the selected local PostgreSQL/proxy transport recorded in Task 10 and the plan; the direct Wrangler pin aligned to 4.162.0 in Task 17, the plan, the proposal, and the agent config; the intermediate-versus-final API scope stated in the Phase 2 header, the Phase 2 checkpoint, and the plan; the CPU-budget claim corrected in the `importMarkdown` JSDoc, with benchmark criteria added to Tasks 15 and 19; Task 27's cursor wording corrected to `reviewCount` with the full-ordering requirement and an explicit open decision on cursor shape; Phase 3 execution order 24 → 22 → 23 with the checkpoint after Task 23.

**Not changed, and why:** the approved specifications are untouched. Three places in them still carry wording this pass corrected elsewhere, for the user or Firstmate to decide: `.kiro/specs/01-core-domain.md` line 231 (`importMarkdown` "within CPU budget via 100 KB size limit"), `.kiro/specs/03-connectors.md` line 145 (a code comment "100 KB for free-tier CPU budget safety"; line 314 of the same spec already says the cap is chosen conservatively), and `.kiro/steering/technology-decisions.md` line 26 ("approximately 3-6 ms CPU" is an unmeasured estimate). Spec 04's cursor still describes a single `sortKey`. Spec 05 states OpenNext's `^4.148.0` Wrangler peer range, which is accurate. `Task 5`'s original acceptance text still says Wrangler 4.148.0; Task 5 is complete and its deviations are recorded.

**Known limits of this setup:** `treehouse.toml` sets only `base_branch = "main"`; Treehouse printed identical status with and without it, so the file is unexercised, and the key comes from `treehouse get --help`. The shared database means only one integration run at a time; this was checked by confirming zero other connections before running. Automatic supervisor notification now requires local configuration (`FM_HOME`), so the Kiro hook no longer notifies by itself until that is set.

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
- [x] Implemented (commit: `da29fbc`)
- [x] Verified (self-tested: 2026-11-14, Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 fixture: `upsertSource`, `getSourceById`, `updateSourceSyncedAt` tested against the real database through the Neon-compatible proxy (database package: 114 workerd + 17 node tests, 0 skipped with `TEST_DATABASE_URL`; 61 + 13 pass and 53 + 4 skip without it). No unique index on `sources.name` exists (Spec 02 approved, no schema change), so `upsertSource` takes a transaction-scoped advisory lock and runs a CTE upsert; a deterministic lock-wait test replaced a probabilistic race test after mutation checks showed the latter was weak. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `da29fbc`)
- [x] Verified (self-tested: 2026-11-14: `upsertNotes` (batch `jsonb_to_recordset` with `ON CONFLICT (source_id, content_hash)`), `upsertNote`, `getNotesBySourceId`, `getNotesMissingCardType` tested against real PostgreSQL, including source-scoped dedup (same text under two sources is two notes), parameterized-SQL injection strings, and empty batches. One mutant (`getNotesMissingCardType` returning all notes) is equivalent in effect except payload size. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `da29fbc`)
- [x] Verified (self-tested: 2026-11-14: `insertFeedItems`, `insertFeedItem`, `getFeedItemCandidates` (published and snooze filters, fixed order `COALESCE(last_reviewed_at, created_at) ASC, id ASC`), `getFeedItemById` tested against real PostgreSQL. **Deviation:** `afterId`/`afterSortKey` (cursor inputs) are deliberately not implemented; the multi-key cursor shape is an open decision for Task 27 (Spec 04 single scalar `sortKey` vs Task 26's two-key importance order), so no final strategy-dependent pagination is claimed. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `6381ef3`)
- [x] Verified (self-tested: 2026-11-14: `pnpm --filter @recallfeed/connectors build` and typecheck exit 0. **Deviation:** the registry is a class (`register`/`get`, throws `CONNECTOR_NOT_FOUND`), as Spec 03 defines it, not the `Map` this task sketched. Only the Markdown connector is registered; Notion is deferred. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [ ] **CPU evidence, not assumption:** add an informational benchmark that logs measured Workers CPU time for representative sizes (for example 1 KB, 10 KB, 50 KB, 100 KB, with and without many fenced code blocks), per the project convention for CPU-sensitive operations. The figures in the steering document (about 3-6 ms for 100 KB) are an estimate until this runs. The 100 KB cap limits input size; it does not by itself show the free-tier CPU budget is met.

**Verification:**
- [ ] `pnpm --filter @recallfeed/connectors test` passes markdown connector tests
- [ ] Parsing test: `"# Note 1\n\nContent\n\n---\n\n# Note 2"` → 2 NormalizedNote objects

**Status:**
- [x] Implemented (commit: `6381ef3`)
- [x] Verified (self-tested: 2026-11-14: connectors package, 57 tests pass (0 skipped), plus an informational benchmark file. **Deviations:** `marked` 18.2.0 is used where Spec 03 names ^9.1.6 (the token shapes this connector reads were checked identical); hashing uses async `crypto.subtle.digest` because the spec's `digestSync` does not exist; `sourceCreatedAt` is set only from a frontmatter date. This task's example `# Note 1 ... --- # Note 2` yields one note under Spec 03 (empty sections are dropped); the spec governs. A `marked` stack overflow on deeply nested input is caught and degrades to one plain-text note. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `524c1b8`)
- [x] Verified (self-tested: 2026-11-14: feed-engine package, 38 tests pass with the database (17 pass, 21 skip without); build, typecheck, lint exit 0. A 300-note import measured 5 HTTP requests to the database (4 on repeat), against the free-tier limit of 50. `FeedEngine.importMarkdown` returns `{ sourceId, queued, notesImported, feedItemsCreated }` (`notesImported` = notes now stored, `feedItemsCreated` = cards created by this call). See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- `.kiro/steering/technology-decisions.md` — Hono, Wrangler deployment (that file names no Wrangler version; see the pin below)
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
- [ ] **Wrangler pin (aligned 2026-11-14):** `wrangler` is a direct devDependency pinned to exactly `4.162.0`, the version `@cloudflare/vitest-plugin@1.8.2` already pins and this repository already tests, so one copy is installed. This replaces the earlier `4.148.0` plan. It satisfies OpenNext 1.20.x's `^4.148.0` peer range on paper only; it does **not** show that OpenNext, Next.js, or Cloudflare deployment works. That is verified in Gate 3, not here.

**Verification:**
- [ ] `pnpm --filter @recallfeed/api build` succeeds (or `wrangler deploy --dry-run`)
- [ ] `wrangler dev` starts local server (no routes yet, returns 404)

**Status:**
- [x] Implemented (commit: `6a892d7` (package, configs), `3996cdb` (Worker entries, `wrangler.toml`, `wrangler.local.toml`))
- [x] Verified (self-tested: 2026-11-14: `wrangler dev --config wrangler.local.toml` (wrangler 4.162.0, pinned) started and served requests from `src/dev-entry.ts` on port 8799 (the default is 8787; this run chose a port to avoid a clash). Production `src/index.ts` passes `env` and `ctx` through and never routes the local database proxy (tested). `wrangler.toml` defaults `FEED_VISIBILITY` to `private`. `.dev.vars` used for the smoke test was git-ignored and deleted afterwards. **Limit:** `wrangler dev` has no Cloudflare Access, so local dev runs the public mode; private mode is verified through the test suite with a real `ctx.access` interface. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `6a892d7`, tests added in `d53caab`)
- [x] Verified (self-tested: 2026-11-14: 104 middleware tests pass in workerd with no database; 6 mutation checks on the auth, CSRF and redaction code were caught, and all 6 mutants of the error handler were caught. **Decisions where an approved spec wins over this task:** an invalid key is 403 `AUTH_API_KEY_INVALID` and a missing key is 401 `AUTH_API_KEY_MISSING` (Spec 05; this task said 401 for both); `requireApiKey` always enforces the key (the Spec 05 sketch passed through in private mode). Identity comes only from `ctx.access.getIdentity()`; no header, cookie or query value can supply one. Visibility fails closed: only the exact string `public` is public. CSRF runs before auth and is private-mode only. No permissive placeholder or production bypass exists. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [ ] **Request validation per Spec 05:** Min 10 bytes, max 100 KB. The cap is an input limit, not evidence of CPU compliance; record the Task 15 benchmark results for the full import path (parse, hash, database round trips, card creation) before claiming the free-tier budget is met
- [ ] **Delegates to FeedEngine:** Instantiate `FeedEngine`, call `feedEngine.importMarkdown(content, {name})`
- [ ] **Response per Spec 05:** `{sourceId, queued, notesImported, feedItemsCreated}` (NOT `notesCreated, notesUpdated`)
- [ ] Error responses: 400 (size), 401/403 (auth), 500 (import failure)

**Verification:**
- [ ] Integration test with `TEST_DATABASE_URL`: POST markdown → verify notes and feed_items in PostgreSQL
- [ ] Size validation tests: 9 bytes → 400, 101KB → 400, 50 bytes → 200
- [ ] Negative auth test: No API key → 401
- [ ] Manual: `wrangler dev`, authenticated curl with ≥10 bytes. **This `X-API-Key` example applies only to an explicitly public local configuration** (`FEED_VISIBILITY=public` and `API_SECRET_KEY` in the git-ignored `.dev.vars`). Under the private default, `requireOwner` needs the trusted Access identity and `X-API-Key` is not what authorizes the request:
  ```bash
  curl -X POST http://localhost:8787/import/markdown \
    -H "Content-Type: text/markdown" \
    -H "X-API-Key: $API_SECRET_KEY" \
    -d "# Test Note

Content here"
  ```
  Response matches Spec 05: `{sourceId, queued, notesImported, feedItemsCreated}`

**Status:**
- [x] Implemented (commit: `3996cdb`)
- [x] Verified (self-tested: 2026-11-14: 41 import tests against real PostgreSQL (public API key and private owner paths; 401/403 and CSRF with nothing written; size 9/10 bytes and 100 KB / +1 byte boundaries; streamed bodies of unknown length are cut off shortly after the cap; content-type, UTF-8, JSON shape; duplicate import creates no cards; SQL-injection text stored literally; exact four-field response). Mutation checks: 9 of 9 import mutants caught (two survivors from the first round led to a new streaming-read test). Manual smoke through `wrangler dev` and the proxy: no key 401, wrong key 403, import 200 with `notesImported 2, feedItemsCreated 2`, repeat `feedItemsCreated 0`. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `3996cdb`)
- [x] Verified (self-tested: 2026-11-14: 27 tests against real PostgreSQL (public: published-only, exact six public keys, snoozed hidden, limit 1-50 with invalid values 400 not clamped, `?cursor=` 400 `VALIDATION_CURSOR_UNSUPPORTED`; private: owner sees all fields, 401 anonymous, 403 other user, a valid API key does not open it, no `FEED_VISIBILITY` is private, `private, no-store` on every response including errors). Tests give each seeded card a review time older than every earlier card so they stay on the first page of the shared fixture. 9 of 10 route mutants caught; the survivor (the route's own limit bounds check) is equivalent because the engine repeats the check. **Scope:** returns `{ items }` with no `nextCursor`; cursor pagination and strategy ordering are Phase 4. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

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
- [x] Implemented (commit: `3996cdb`)
- [x] Verified (self-tested: 2026-11-14: 9 tests against real PostgreSQL (public: published card returns exactly six keys; an unpublished card, a missing card, a malformed ID and an injection string return the identical 404 body; identity does not unlock an unpublished card in public mode; private: owner reads all fields, 401/403 do not reveal whether a card exists, 404 carries the private cache policy, missing or unrecognized `FEED_VISIBILITY` never serves anonymously). Mutations on this route are covered by the Task 20 run. See full gate in the Phase 2 Execution Record below.)
- [x] Reviewed (Firstmate independent review 2026-11-14, `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`: **APPROVE WITH CONDITIONS**, reviewed revision `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`. Conditions C1 (CI report check) and C2 (stale `marked` example) were corrected afterwards and closed by Firstmate's focused review `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md` (2026-11-15): **APPROVE** at `3402fdb36f14caf12c756d00892f7a98baa35818`.)
- [x] Pushed (`origin/phase/gate2-phase2-markdown-slice` = `d6ff37aa503543b616a81179fe8ab8d7dded1dbb`, read back with `git ls-remote` on 2026-11-14; non-forced; draft PR #2. Later commits on the branch are listed in the Phase 2 Execution Record.)
- [x] Merged (PR #2 merged 2026-11-15T01:25:24Z by `pauxiel` with a **merge commit** `ac40227060d962617367ed132102d392b530be8a`, parents `8222b7cf91163b8d68f30c830a971f85df97280c` and `e4800dd6161812ecdd9ba56e8fc0b3931acb5f18`; `main` = that commit, read back from GitHub and the remote; the 23 individual commits are preserved. CI on that commit failed on a test timeout; see "Merge and the failed post-merge CI run".)

**Files created:**
- `packages/api/src/routes/feed.ts` (update with `:id` route)
- `packages/api/src/__tests__/feed-item.test.ts`

**Estimated scope:** Small

---

**PHASE 2 CHECKPOINT:** Complete protected path works end-to-end. Stop for human review before proceeding to Phase 3.

**Checkpoint criteria** (self-verification evidence is in the Phase 2 Execution Record; the boxes stay unchecked until the human review at this checkpoint):
- [ ] POST /import/markdown with real authorization → PostgreSQL → original cards → response (Spec 05 contract)
- [ ] GET /feed with owner authorization (private) or public filtering (public)
- [ ] GET /feed/:id with authorization and public DTO omissions
- [ ] Negative authorization tests pass (401, 403 where expected)
- [ ] PostgreSQL integration tests pass (not SQLite mocks)
- [ ] Early working path verified: `wrangler dev`, POST markdown, GET feed
- [ ] The Spec 05 contracts that Tasks 19-21 cover are followed (import response fields and validation, public DTO omissions, auth responses). The full `GET /feed` contract (cursor, `nextCursor`, strategy ordering) is **not** claimed here; it is checked at the Phase 4 checkpoint

---

## Phase 2 Execution Record (Tasks 11-21)

Branch `phase/gate2-phase2-markdown-slice`, started at `8222b7c`. Pushed to `origin` (non-forced) and merged through https://github.com/pauxiel/recallfeed/pull/2 into `main` on 2026-11-15 with a merge commit, `ac40227060d962617367ed132102d392b530be8a` (parents `8222b7c` and `e4800dd`). **Independently reviewed by Firstmate: APPROVE WITH CONDITIONS at `28b4bd1`, then APPROVE at `3402fdb` after C1 and C2 were corrected.** The branch and its leased workspace are kept. Tasks 22 and later are not started.

**Commits:** `da29fbc` (Tasks 11-13), `6381ef3` (14-15), `524c1b8` (16), `6a892d7` (17-18 middleware layer), `3996cdb` (17, 19-21 routes, entries, README), `ab7be8d` (CPU wording in specs and steering), `d53caab` (error-handler tests), `81f3fc1` (Turbo env fix, order-independent seeding, coverage scope). This record is committed after them.

**Gate at `81f3fc1`** (Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 fixture through the Neon-compatible proxy; build outputs, `.turbo` and `coverage` removed first; `TURBO_FORCE=true`, so nothing replayed from cache):

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0, 5 of 5 tasks, 0 cached |
| `pnpm typecheck` | exit 0, 5 of 5 tasks, 0 cached |
| `pnpm test` with no `TEST_DATABASE_URL` | exit 0. **Skips:** api 108 pass / 78 skip; database 61 / 53 (workerd) and 13 / 4 (node); feed-engine 17 / 21; connectors 57 / 0; core 10 / 0. This is unit-only and is **not** database validation. |
| `pnpm test:integration` (same tests against real PostgreSQL, packages run one at a time) | exit 0, **0 skipped**: api 186, database 114 + 17, feed-engine 38, connectors 57, core 10. Run twice in a row at an earlier revision with the same totals after the final fixes. |
| `pnpm test:coverage` with the database | exit 0, 28 files, 422 tests. All files: 96.09% statements, 91.98% branches, 98.21% functions, 95.97% lines (threshold 80% each). Scope widened from core, database and feed-engine to include connectors and api. |

The 1,000-line `max-lines` rule is part of `pnpm lint` above.

**Protected import-to-feed path, exercised for real:** the tests drive the real Hono app inside `workerd` against real PostgreSQL. Separately, `wrangler dev --config wrangler.local.toml` was started by hand with a git-ignored `.dev.vars` (fake key, deleted afterwards) and exercised with `curl`: no key gave 401 `AUTH_API_KEY_MISSING`; a wrong key gave 403 `AUTH_API_KEY_INVALID`; a valid import returned `notesImported 2, feedItemsCreated 2`; the repeat returned `feedItemsCreated 0`; `GET /feed` returned only the six public keys; an unpublished card by ID gave 404; after `is_published` was set directly in the database the same ID returned 200 with six keys; `?cursor=` and `?limit=0` gave 400. The wrangler processes were stopped afterwards.

**Performance evidence (local; this is not Cloudflare billed CPU time).** Local `workerd` timers advance, so these are real measurements, but they include Miniflare overhead and the local proxy, and they do not reproduce Cloudflare's billing.
- Parse and hash only, in-process, elapsed milliseconds (`markdown.bench.test.ts`, informational): 100 KB prose median 8 ms, code 4 ms, mixed 6 ms; 4,000 tiny notes from 46 KB took 17 ms.
- Whole import request through `wrangler dev`, `workerd` process CPU from `ps` (10 ms resolution, summed over many requests), 40 requests per case after a warm-up, idle baseline 0.00 s: one small note about 5.2 ms CPU per request; 300 tiny notes (about 7 KB) about 10.0 ms; 100 KB prose about 10.8 ms. Median elapsed time per request was about 390-420 ms, almost all waiting on the database proxy, which is not CPU.
- Database requests per import: 5 for a 300-note import, 4 on a repeat (free-tier subrequest limit is 50).
- **Conclusion:** the 10 ms free-tier CPU budget is neither shown to be met nor shown to be exceeded. 100 KB and many-note imports sit close to it locally, so it stays a real risk. Only a deployed Worker can settle it, and no deployment is part of this phase. The 100 KB input limit and the performance requirement are unchanged; the unsupported guarantees ("within CPU budget via 100 KB", "3-6 ms CPU") were replaced with these measurements (`ab7be8d`).

**Where an approved spec won over this todo** (also noted per task): invalid API key is 403 and missing is 401 (Spec 05); connector registry is a class, not a `Map` (Spec 03); factory is `createDb` (Specs 02 and 07); `marked` 18.2.0 instead of ^9.1.6 (token shapes verified identical); no unique index on `sources.name` (Spec 02 approved, no migration), so `upsertSource` uses an advisory lock; cursor inputs for `getFeedItemCandidates` and `GET /feed` are deferred to Phase 4, with `?cursor=` rejected as 400 instead of ignored.

**Problems found and fixed while verifying (recorded so a reviewer can check them):**
- `pnpm test` with `TEST_DATABASE_URL` set still skipped every database test, because Turbo's strict env mode dropped the variable. The result looked green and was not database validation. `turbo.json` now declares the variable for the `test` task, a root `test:integration` script exists, and CONTRIBUTING says to read the skipped counts.
- Two suites seeded cards with different fixed review dates on the shared database, so one suite's cards could fall off the first page of the other. Both now use a review time older than every earlier card.
- Several of my own tests were wrong, not the application: unique values placed in a heading, which the note hash ignores; a private-mode request without `Origin`, which CSRF correctly refused before auth; and a made-up `X-Source-Name` header I briefly wrote before checking the route. All were fixed in the tests.
- Mutation checks found two weak spots (body-size caps that returned the same 400 either way); a streaming-read test now measures how many bytes the Worker pulled.

### CI follow-up (draft PR #2)

Authorized as a CI-only follow-up on this branch. Added in three separate commits on top of the submitted Phase 2 work, no history rewritten:
- `5e98dd2` root `test:coverage` runs files one at a time (`--no-file-parallelism`). From the root, Vitest overlapped packages on the shared database (15 overlapping cross-package file pairs measured with the JSON reporter). Same 28 files, 422 tests and coverage afterwards, 0 overlaps.
- `0d075d0` `scripts/ci-check-test-results.mjs`. Vitest exits 0 when tests skip, so a run without a database passed while skipping 156 tests. The script fails on any failed, skipped, todo or missing test, on a package that ran no tests, and on an unset `TEST_DATABASE_URL`, and prints per-package totals and coverage. Tested both ways locally: passes the real run, fails the no-database run.
- `d6ff37a` `.github/workflows/ci.yml`: one `ubuntu-24.04` job, triggers on pull requests (drafts included) and pushes to `main`, `permissions: contents read`, no secrets, 20-minute timeout, actions `checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6` (current majors, read from the GitHub API), Node from `.nvmrc`, pnpm from `packageManager`, `pnpm install --frozen-lockfile`, lint, build, typecheck, the existing Compose fixture, a readiness probe that sends a real `select 1` through the proxy, then **one** `pnpm test:coverage` run, the result check, a log dump on failure, and `docker compose down --volumes` on every outcome.

**One coverage run is enough**, and I checked rather than assumed: it ran 28 files and 422 tests, the sum of every package's database-backed run (api 186, database 131, feed-engine 38, connectors 57, core 10), with 0 skipped. No separate unit or integration pass is run in CI.

**GitHub result:** run https://github.com/pauxiel/recallfeed/actions/runs/43649807256 on `d6ff37a` (event `pull_request`, runner `ubuntu-24.04`): **success** in 3m04s. The log shows Node 22.23.3, pnpm 10.18.3, "Lockfile is up to date", "database ready after 1 attempt(s)", 28 test files passed, 422 tests, **0 skipped, 0 failed**, coverage 96.09% statements, 91.98% branches, 98.21% functions, 95.97% lines (threshold 80% each), and 0 check annotations. Later commits are docs only and re-run the same workflow; their results are reported in the review request, not here, because this file cannot contain the result of a run on the commit that contains it.

**CI limits:**
- The job depends on the public DNS name `db.localtest.me` resolving to loopback, as the local run does. It resolved correctly on the runner; an outage of that name would fail the job at the readiness probe, which names the cause.
- The two container images are pinned by digest and pulled from Docker Hub and ghcr.io at run time.
- CI proves the code runs on Linux amd64 in Node, with workerd. It does not exercise Cloudflare itself, a real Neon database, or Cloudflare Access.
- Nothing was done to repository settings or branch protection, so the check is not a required status. No deployment, hosted database, or secrets exist.
- A first run on a PR is not evidence of stability: this is one passing run.

### Independent review (Firstmate)

Recorded as received, not as my own judgement. Review file: `firstmate/data/recallfeed/reviews/2026-11-14-phase2-and-ci.md`.
- **Verdict: APPROVE WITH CONDITIONS at `28b4bd1d64624b8f8c194dd8c7ecacaf0bc5b7da`.** The Phase 2 application slice and the minimal CI approach are accepted within their bounded scope. The verdict does not authorize merge, deployment, cleanup or the next phase.
- **C1:** the `Check that every test ran` step was conditioned on `hashFiles('test-results.json') != ''`, so a missing report skipped the check instead of failing the job. Firstmate describes this as a structural finding and states that none of the observed runs omitted tests and that a missing-report failure was not reproduced remotely.
- **C2:** `.kiro/specs/03-connectors.md` still showed `marked: ^9.1.6` while the accepted implementation uses 18.2.0. No downgrade was requested.
- It independently confirmed: the GitHub run (28 files, 422 tests, 0 skipped, coverage 96.09 / 91.98 / 98.21 / 95.97); its own isolated lint, build, typecheck and ordinary tests (266 passed, 156 skipped without a database, which is not a database run); a database-free coverage run that fails the thresholds and is rejected by the checker; seven synthetic checker controls; hashes in both handoffs; and 17 real-HTTP assertions without database mutation.
- It did **not** independently rerun the full database mutation suite, a deployed Access, hosted Neon, billed CPU or a two-app demo, and it noted that CI cleanup after a failure was not exercised remotely.

### Corrections after that review (mine; then closed by Firstmate's second review)

Authorized by the user after Firstmate's review. Application code under `packages/` is unchanged (diff empty; the four reference file hashes match the previous handoff).
- `fe22fdf` **C1.** The result check now runs whenever the test step ran (`steps.tests.outcome != 'skipped'`), with no dependence on the report existing. The script now fails a missing, empty, or non-Vitest report with a one-line reason instead of a raw `ENOENT` stack trace. New `scripts/ci-check-test-results.test.mjs` (Node's built-in `node:test`, no new dependency, 9 controls) runs as one CI step, `node --test scripts/*.test.mjs`.
- `a6f0ebe` **C2.** One dependency line in the Spec 03 example changed from `^9.1.6` to `^18.2.0`, plus a note recording that `packages/connectors/package.json` declares `^18.2.0` and `pnpm-lock.yaml` resolves `18.2.0`. The library is not downgraded and the rest of the spec is unchanged.

**My verification of the corrections:**
- `node --test scripts/*.test.mjs`: 9 of 9 pass against the corrected checker.
- Mutation checks of the controls: restoring the previous checker fails exactly the missing-report, empty-report and non-Vitest-report controls (6 other controls still pass); removing skip detection fails exactly the skipped-tests control (8 others pass). The missing-report control asserts the specific message and rejects a stack trace, because the previous checker also exited 1 on a missing report, through a crash.
- `actionlint` no findings; `pnpm lint` exit 0.
- GitHub: run https://github.com/pauxiel/recallfeed/actions/runs/43660308344 on `a6f0ebe` (`pull_request`, `ubuntu-24.04`) **success**, 3m08s. The log shows the 9 checker controls passing on the runner, database ready after 1 attempt, 28 files, 422 tests, 0 skipped, 0 failed, coverage 96.09 / 91.98 / 98.21 / 95.97, 0 annotations.

**Not verified:** a missing report was **not** reproduced on GitHub; the evidence is the local controls and mutation checks. CI cleanup after a failure is still not exercised on a runner. Firstmate's other notes were left alone on purpose, because only C1 and C2 were authorized: SHA pinning of actions, the readiness timeout text that says 60 seconds while the loop can take longer, and a few whitespace findings from `git diff --check`.

### Second independent review (Firstmate)

Recorded as received. Review file: `firstmate/data/recallfeed/reviews/2026-11-15-ci-corrections.md`. **Verdict: APPROVE at `3402fdb36f14caf12c756d00892f7a98baa35818`.** C1 and C2 are closed; the commits after it add only the handoff and its marker. It independently ran the nine checker controls (synthetic checker tests, not application tests), read the workflow predicate, and confirmed the manifest `^18.2.0` and lockfile `18.2.0`. It did not publish a deliberately broken workflow, so a missing report was still not reproduced on GitHub. The review is not merge authority; the user separately authorized the merge.

### Merge and the failed post-merge CI run (2026-11-15)

- **Merged:** PR #2 was marked ready, its description updated, and head, base and checks re-verified (head `e4800dd`, `main` still `8222b7c`, one check green). It was merged with a merge commit pinned to the approved head. GitHub reports merge commit `ac40227060d962617367ed132102d392b530be8a` with parents `8222b7c` and `e4800dd`; the merged tree equals `e4800dd`'s tree. The repository stays private; the phase branch and its workspace were kept.
- **The first push-to-`main` CI run failed:** https://github.com/pauxiel/recallfeed/actions/runs/43663026016, attempt 1, on `ac40227`. One test failed, `returns published cards only, oldest review time first, and hides unpublished and snoozed ones` (`packages/api/src/__tests__/feed.test.ts`), with `Test timed out in 5000ms` (5,010 ms). The suite took 132 s against about 92 s in the six earlier green runs. 421 of 422 tests passed.
- **One rerun, as authorized (`gh run rerun --failed`):** attempt 2 of the same run **failed the same way**, the same test at 5,015 ms, suite 134 s. It was not rerun again. The logs of both attempts were saved outside the repository before the rerun.

### Timing investigation and the correction (follow-up branch `fix/ci-integration-test-timeout`)

Cut from remote `main` `ac40227060d962617367ed132102d392b530be8a` in a fresh leased workspace. Nothing about the application changed.

**What the evidence shows**
- **No broad slowdown was seen in CPU-bound steps, but CPU and application effects are not excluded.** Image `ubuntu-24.04` 20261103.629 and runner agent 2.338.2 are identical in all runs. Install (6-7 s), lint (2-3 s), build (5-8 s) and typecheck (20-22 s) match the green runs, and the Markdown parser tests, which use no database, took 2.7-2.8 s in the red runs against 2.0-3.5 s in green ones. The steps that use Docker and the database were slower: starting the database 29-31 s versus 23-25 s, and the test step 134-135 s versus 92-98 s. This does not show what slowed them. Container and runner contention, the proxy, Docker networking and anything in the application path that makes requests slower are all not ruled out.
- **A test's duration tracked its number of database requests, and the time per request was higher in the slow runs; why was not isolated.** The failing test makes 25 database HTTP requests (four card seeds at 6 requests each, plus the feed read). Measured locally with each request timed, and the number of `fetch` calls matching the database package's own counter (6 and 6, 1 and 1, so no extra requests at that layer): each seed about 460 ms, four seeds about 1.85 s, the feed request about 78 ms, and 0-3 ms outside the database calls. Locally, the feed `SELECT` executes in 0.07 ms inside PostgreSQL, yet a `select 1` sent through the local proxy takes 78-89 ms, so on a developer machine the time is not query execution. That does not show where it goes: the proxy, its connection to PostgreSQL, Docker networking, or the HTTP layer are all untested candidates, and nothing was measured per request on GitHub. I did not sample `pg_stat_activity` during any run, so absence of lock waits is not established.
- **The fit with CI is an estimate.** Dividing test durations by request counts gives about 116-145 ms per request in green runs and about 196-256 ms in red ones, against about 80 ms locally. This assumes time is proportional to the request count, and the figures are not measured per request. The failing test has the most requests of any test, so it reaches Vitest's 5 s default first.
- **Supported conclusion: added request-path latency reproduced the timeout, and the larger test allowance handled that condition. The cause of the slower GitHub executions has not been isolated.** Adding a delay to every request sent to the local proxy, with no code changes, the unmodified test took 2.0 s at +0 ms, 3.6 s at +60, 4.7 s at +100, and **timed out at 5,007 ms at +150 ms**, with sibling tests at 4.68 s, close to the 4.65-4.86 s of the red CI run. With the timeout lifted for measurement only, the slowest test took 6.2 s at about 230 ms per request and 10.5 s at about 380 ms. This shows that added latency of this size produces the failure and that 30 s covers it. It does not show that added latency is why GitHub's runs were slow.

**The correction (tests only, 6 files, +30/-7 lines):** a named constant `DATABASE_TEST_TIMEOUT_MS = 30_000` (about three times the slowest measured case) applied as a per-suite `{ timeout }` option to the database-backed suites in the api package (`feed`, `feed-item`, `import`) and in feed-engine. It is not global, adds no retries, skips nothing, and leaves assertions, the 80% coverage thresholds, database safety and serial execution unchanged. The `database` package is untouched: its slowest red-run test took 2.4 s, and its slow tests are deliberate lock-wait tests. Verified locally: setting the constant to 1 s makes exactly the four seeded tests fail with `timed out in 1000ms`, so the option is enforced; with 30 s the formerly failing test passes at +150 ms (6.5 s) and +300 ms (10.5 s) with all 77 database-backed API tests passing; the full serial gate passes (28 files, 422 tests, 0 skipped, coverage 96.09 / 91.98 / 98.21 / 95.97).

**Uncertainty, stated plainly**
- **Cause of the slower GitHub runs: not isolated.** The two failing runs were `push` events, and the six earlier passing runs were `pull_request` events. A later `pull_request` run (see below) was as slow as the failing ones, so slowness is not specific to push events. Runner, time-of-day and other variation are not separated. Two failures in two attempts show it was not a single random flake. They do not show what made the requests slower.
- **A timeout is not a cancellation.** A Vitest timeout marks a test failed when its limit expires. It does not cancel or interrupt the operations the test has started, so a long-running or stuck operation can outlast its limit. `DATABASE_TEST_TIMEOUT_MS` therefore bounds how long a test is allowed, not how long it can run. The 207 s stall below is an example.
- **The 207 s stall is unexplained, and recurrence was not ruled out; see "Evidence for the stall" below.** `Network connection lost` is not linked to it: that message appears twice in every saved CI log, including all seven passing runs, and where a test header is nearby it is the output of the test that deliberately targets an unreachable proxy port. Not every occurrence was traced.
- A 7-request test implied about 400 ms per request in the red run, which the simple model does not explain.
- **Two slow GitHub runs have now passed with the correction; that is two runs in one time window, not a controlled comparison.** CI runs triggered by pushing wording corrections to the follow-up pull request were as slow as the failing ones: https://github.com/pauxiel/recallfeed/actions/runs/43716300137 (`pull_request`, suite 131.7 s, database start 30 s) and https://github.com/pauxiel/recallfeed/actions/runs/43716681130 (`pull_request`, suite 134.8 s). The four-seed feed test took **5,787 ms** and **6,583 ms**, both above Vitest's 5,000 ms default, and passed under the 30 s allowance. Neither run was started to gather evidence. The earlier follow-up run (43713049095) was fast and would probably have passed without the change.
- The correction is not independently reviewed.

**Evidence for the stall** (from saved material only; nothing was rerun to write this)
- **The 207 s run** (log saved as `/tmp/lat300.log`, SHA-256 `507ea2eb3a3d0de9d1ca671abbcfd8e453ff6f5075cde0b8065517c7eeae862d`), from `packages/api` with `TEST_DATABASE_URL` set to the local fixture: `EXTRA_LATENCY_MS=300 pnpm exec vitest run -c vitest.latency.config.ts --testTimeout=120000 2>&1 | sed 's/\x1b\[[0-9;]*m//g' > /tmp/lat300.log`. The temporary `zz-latency-setup.ts` shim replaces `globalThis.fetch` and awaits `setTimeout(EXTRA_LATENCY_MS)` before any request whose URL contains `:4444/sql`; the config is the api config plus that setup file. Both are in the review addendum. The run covered all 10 test files, 187 tests, which included the temporary `zz-timing-diagnostic.test.ts` that ran first (31 s).
- **What 120 s and 207 s measured.** 120 s is the per-test limit passed with `--testTimeout=120000`; the text `Test timed out in 120000ms` repeats that configured value and is not a measured time. 207,617 ms is the duration Vitest recorded for that test, and the run took 322.72 s of wall time, so the time really elapsed. The saved log cannot say whether the timer fired late or whether Vitest finished tracking the test about 88 s after the limit; both fit.
- **Outcome in the saved log:** `Test Files 1 failed | 9 passed (10)`, `Tests 1 failed | 186 passed (187)`, `Start at 22:01:18`, `Duration 322.72s`. The process exit code was **not captured** (the command was piped), though Vitest normally exits 1 on a failure.
- **It was not a single occurrence.** The first +300 run, with the same flags, also ended `Tests 1 failed | 186 passed (187)`, but its output was filtered and not saved, so the failing test was not identified. The earlier wording "one full local run" and "never recurred" was inaccurate.
- **The runs that passed were not like-for-like.** An isolated run of the one test at +300 ms with `--testTimeout=60000` passed in 2,060 ms. Two later runs at +300 ms with `--testTimeout=30000` covered only three files (`import`, `feed`, `feed-item`; 77 tests), so they omitted the diagnostic file, the Worker entry file and the middleware files, and passed (that test took 2,076 ms and 2,074 ms). They differ from the failing run in file set, in timeout, and in what ran before the failing test. Neither isolated nor bounded runs show that the stall cannot recur in the full set.
- **The database observations were not informative.** The three `pg_stat_activity` samples were taken about 12, 16 and 20 s after the isolated run was launched in the background, when the test (2 s) had very likely already finished. They did not observe the test. They are not evidence about lock waits.

**Known limits:**
- Private mode cannot run under `wrangler dev` (no Cloudflare Access). It is verified through the test suite with a `ctx.access` object shaped like the real one, not against a real Access deployment.
- Nothing has been deployed, so no behavior on Cloudflare itself (billed CPU, real Neon over the internet, real Access) is claimed.
- The shared fixture showed 20 idle client connections after earlier runs, with no process of mine alive; they were idle and did not interfere. Their owner was not identified beyond the local proxy.
- `wrangler` 4.162.0 is pinned exactly in `packages/api`. No OpenNext or deploy test exists.

---

## Phase 3: Review & Publish Mutations (Tasks 22-24)

> **Execution order: Task 24 → Task 22 → Task 23** (Task 22 needs the review-event queries from Task 24). The task numbers keep their file order. Review the **whole phase** after Task 23; do not stop for review after Task 24, before the endpoint and its integration tests exist.

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
- [x] Implemented (commit: `7db6fc0` (with `7398acd` for `FeedEngine.recordReview` and `c2ed3f1` for the shared bounded body reader))
- [x] Verified (self-tested: 2026-11-15: `PUT /feed/:id/review` for all six actions against real PostgreSQL. 84 endpoint tests plus 26 configuration tests (`review.test.ts`, `snooze-config.test.ts`) and 12 engine tests. Covers every action's field changes, the response shape (exactly `id, reviewCount, lastReviewedAt, savedAt, snoozedUntil, isPublished`), the invalid-action test (`{action: "invalid"}` is 400 `VALIDATION_REVIEW_ACTION`) with 16 further invalid bodies, the content-type, size (1 KB), JSON and UTF-8 rules, 404 for an unknown or malformed ID, negative authorization (401, 403, no key, wrong key, identity in public mode, key in private mode, unset or unrecognized `FEED_VISIBILITY`), CSRF (cross-origin, `null`, missing, Referer), private `Cache-Control: private, no-store`, that authorization precedes the body and the lookup, that extra body fields are ignored, and that there is no separate publish endpoint. **Mutation-checked:** 11 endpoint mutants, all caught, plus 4 engine mutants of which 3 are caught and 1 is equivalent in behavior (the engine's own action check, duplicated by the database layer, kept as defense in depth). **Deviations:** the endpoint uses `FeedEngine.recordReview`, which calls the one-statement `applyReviewAction`, and does not call `insertReviewEvent` separately (Task 22's note), for the atomicity reason under Task 24. `SNOOZE_DEFAULT_HOURS` is a new optional variable (default 24, whole number 1 to 8760); a set but unusable value is a generic 500 for `snoozed` only. It is documented in the `wrangler.toml` comments and the API README; **`docs/setup.md`, which the conventions name as the place for new variables, does not exist in the repository**, so it is not documented there. The bounded body reader moved unchanged out of the import route into `request-body.ts` so both routes share one copy; the 41 import tests still pass. See the Phase 3 Execution Record.)
- [x] Reviewed (independent: **Grok 4.7**, temporary supervisor, 2026-11-20, **APPROVE WITH CONDITIONS** at `7d5480afdb24fafd470eb1ebdb9466932b826259`. Written review: `firstmate/data/recallfeed-phase3-review/report.md`. One condition: an authorization-refusal test with a malformed body in both modes. Addressed in `2e0644d`. **Condition review: APPROVE at `241c1c016526747544189e2e56856245c0144ec0`**, condition closed (`firstmate/data/recallfeed/reviews/2026-11-20-phase3-condition.md`). See the Phase 3 Execution Record.)
- [x] Pushed (`origin/feat/gate2-phase3-review-publish` = `115b6ab979e0d3796be053e104797f29af1a5751`, read back from the server on 2026-11-20; non-forced; private draft PR #4, https://github.com/pauxiel/recallfeed/pull/4. CI on that head: https://github.com/pauxiel/recallfeed/actions/runs/44771504311, success.)
- [x] Merged (PR #4 merged 2026-11-20T16:31:35Z by `pauxiel` with a **merge commit** `9856fd23d21b3ab95dee61a0a936bd67d9504a78`, parents `0a923d9702b6ea2c47b0eff7d18f79b2695b19c9` and `115b6ab979e0d3796be053e104797f29af1a5751`; `main` = that commit, read back from GitHub and the remote; the 20 individual commits are preserved and the merged tree equals `115b6ab`. Post-merge CI on `main`: https://github.com/pauxiel/recallfeed/actions/runs/44774264975, `push`, attempt 1, **success**.)

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
- [x] Implemented (commit: `0cc7cea`)
- [x] Verified (self-tested: 2026-11-15: `review-integration.test.ts`, 20 tests through the real app against real PostgreSQL, checking the response and the database row after each action. `reviewed` (count, time, five concurrent), `saved` to `unsaved` to `saved`, `snoozed` (hidden from the public and owner lists until the snooze expires, simulated by moving `snoozed_until` into the past, still fetchable by ID, replaced by a later snooze), `published` to `unpublished` (an anonymous visitor sees the card only while it is published, with the identical 404 once it is not, and a private deployment exposes nothing), the ordered event log, a refused request writing no event, cascade on delete, independence between cards, and a 24-step pseudo-random sequence checked against an independent model after every step. **Mutation-checked:** 7 mutants through the SQL layer, all caught (publish also snoozes, review clears the saved flag, unpublish does nothing, snooze in the past, save clears, review leaves the time alone, update touches every row). See the Phase 3 Execution Record.)
- [x] Reviewed (independent: **Grok 4.7**, temporary supervisor, 2026-11-20, **APPROVE WITH CONDITIONS** at `7d5480afdb24fafd470eb1ebdb9466932b826259`. Written review: `firstmate/data/recallfeed-phase3-review/report.md`. One condition: an authorization-refusal test with a malformed body in both modes. Addressed in `2e0644d`. **Condition review: APPROVE at `241c1c016526747544189e2e56856245c0144ec0`**, condition closed (`firstmate/data/recallfeed/reviews/2026-11-20-phase3-condition.md`). See the Phase 3 Execution Record.)
- [x] Pushed (`origin/feat/gate2-phase3-review-publish` = `115b6ab979e0d3796be053e104797f29af1a5751`, read back from the server on 2026-11-20; non-forced; private draft PR #4, https://github.com/pauxiel/recallfeed/pull/4. CI on that head: https://github.com/pauxiel/recallfeed/actions/runs/44771504311, success.)
- [x] Merged (PR #4 merged 2026-11-20T16:31:35Z by `pauxiel` with a **merge commit** `9856fd23d21b3ab95dee61a0a936bd67d9504a78`, parents `0a923d9702b6ea2c47b0eff7d18f79b2695b19c9` and `115b6ab979e0d3796be053e104797f29af1a5751`; `main` = that commit, read back from GitHub and the remote; the 20 individual commits are preserved and the merged tree equals `115b6ab`. Post-merge CI on `main`: https://github.com/pauxiel/recallfeed/actions/runs/44774264975, `push`, attempt 1, **success**.)

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
- [x] Implemented (commit: `979f92f` (shared action list in core), `2d19cc5` (queries and tests))
- [x] Verified (self-tested: 2026-11-15, Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 fixture: `insertReviewEvent`, `listReviewEventsByFeedItem` and `applyReviewAction` against real PostgreSQL. 50 new database tests; the database package passes 181 tests (164 workerd + 17 node), 0 skipped. Foreign key enforced and verified: an unknown card is refused by `review_events_feed_item_id_fkey` (SQLSTATE 23503) and reported as `NotFoundError`, matched on the constraint name. Immutable: the module and the package export no update or delete function for events, and a test fails if one is added (the name check was itself tested against real mutator names). **Mutation-checked:** 12 mutants, all caught (no increment, snooze in minutes, publish sets FALSE, no event logged, UPDATE without WHERE, hard-coded event action, unmapped FK error, unsave sets a time, no action validation, no snooze upper or lower bound, a malformed ID queried). **Deviations:** the function that changes a card is `applyReviewAction`, one statement that updates the card and inserts its event (a data-modifying CTE), not the two separate calls Spec 04's sketch makes, so an unknown card changes and logs nothing and returns null instead of surfacing a foreign-key error, and both effects happen or neither; `insertReviewEvent` is kept as the plain log insert the task names. Spec 02 calls it `createReviewEvent`; Task 24, Spec 04 and the plan say `insertReviewEvent`, which is what is used. Core gained `REVIEW_ACTIONS` and `isReviewAction` (with a compile-time check that they cover every `ReviewAction`, mutation-checked both ways) because validation needs the list at runtime. See the Phase 3 Execution Record.)
- [x] Reviewed (independent: **Grok 4.7**, temporary supervisor, 2026-11-20, **APPROVE WITH CONDITIONS** at `7d5480afdb24fafd470eb1ebdb9466932b826259`. Written review: `firstmate/data/recallfeed-phase3-review/report.md`. One condition: an authorization-refusal test with a malformed body in both modes. Addressed in `2e0644d`. **Condition review: APPROVE at `241c1c016526747544189e2e56856245c0144ec0`**, condition closed (`firstmate/data/recallfeed/reviews/2026-11-20-phase3-condition.md`). See the Phase 3 Execution Record.)
- [x] Pushed (`origin/feat/gate2-phase3-review-publish` = `115b6ab979e0d3796be053e104797f29af1a5751`, read back from the server on 2026-11-20; non-forced; private draft PR #4, https://github.com/pauxiel/recallfeed/pull/4. CI on that head: https://github.com/pauxiel/recallfeed/actions/runs/44771504311, success.)
- [x] Merged (PR #4 merged 2026-11-20T16:31:35Z by `pauxiel` with a **merge commit** `9856fd23d21b3ab95dee61a0a936bd67d9504a78`, parents `0a923d9702b6ea2c47b0eff7d18f79b2695b19c9` and `115b6ab979e0d3796be053e104797f29af1a5751`; `main` = that commit, read back from GitHub and the remote; the 20 individual commits are preserved and the merged tree equals `115b6ab`. Post-merge CI on `main`: https://github.com/pauxiel/recallfeed/actions/runs/44774264975, `push`, attempt 1, **success**.)

**Files created:**
- `packages/database/src/queries/review-events.ts`
- `packages/database/src/queries/__tests__/review-events.test.ts`

**Estimated scope:** Small

---

## Phase 3 Execution Record (Tasks 24, 22, 23)

Branch `feat/gate2-phase3-review-publish`, started at `0a923d9702b6ea2c47b0eff7d18f79b2695b19c9` (remote `main`, verified live before branching; the primary checkout's local `main` was stale and not used). Treehouse workspace `~/.treehouse/recallfeed-38ad39/3/recallfeed`, lease `6911139c0d8f4e9624de199b9af85364`, holder `recallfeed-kiro`. *At the time of submission:* local only, not pushed, no pull request, not merged, not reviewed. *Later outcome:* reviewed (see below), pushed as private draft PR #4, and merged into `main` as `9856fd2`; see "Publication and merge of Phase 3". Tasks 25 and later are not started. The earlier branches and their workspaces are untouched.

**Commits (oldest first):** `c2ed3f1` bounded body reader moved to its own module (no behavior change); `979f92f` core `REVIEW_ACTIONS`; `2d19cc5` Task 24; `7398acd` `FeedEngine.recordReview`; `7db6fc0` Task 22; `0cc7cea` Task 23; `54e7a7c` documentation; `0c28020` a fix to an existing Phase 2 test. The record and review request follow.

**Gate at `0c28020`** (Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 through the Neon-compatible proxy; build outputs removed first; `TURBO_FORCE=true`; I was the only user of the shared fixture, checked before each run):

| Check | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0, 5 of 5 tasks, 0 cached |
| `pnpm typecheck` | exit 0, 5 of 5 tasks, 0 cached |
| `node --test scripts/*.test.mjs` (CI checker controls) | 9 of 9 |
| `pnpm test:coverage --reporter=default --reporter=json --outputFile.json=test-results.json` (the CI command), then `node scripts/ci-check-test-results.mjs test-results.json` | exit 0; **33 files, 642 tests, 0 skipped, 0 failed**; checker `every test ran and passed` |
| Per package | api 316, connectors 57, core 38, database 181, feed-engine 50 |
| Coverage | 96.24% statements, 92.1% branches, 98.37% functions, 96.14% lines (threshold 80% each). New files: `snooze-config.ts` 100%, `review.ts` 100% of lines, `review-events.ts` 94% (the uncovered lines are a defensive "no row returned" throw and the rethrow of a non-foreign-key error). |

Before this phase: 422 tests. This phase added 220, none skipped.

**A failure the full run exposed (fixed, in its own commit `0c28020`):** the first full serial run failed one existing Phase 2 test in the database package, `orders oldest effective review time first, then by id`. It passes alone. `getFeedItemCandidates` returns at most 200 cards, oldest effective review time first; that test created three cards dated 30 days ago, now and an hour ahead and looked for them in that page. Once other suites have left enough ancient-dated cards in the shared database (114 among 546 at that point), those three fall off the first 200. This is the same fixture-size dependence the CI-timeout work met. The three cards now get times older than every earlier card, one millisecond apart, with the never-reviewed one ordered by `created_at`, so the test still checks exactly the `COALESCE` ordering. Three ordering mutants are caught. Test only; no application code changed.

**Other verification:**
- Every behavior commit was mutation-checked: 12 database mutants, 4 engine (one equivalent), 11 endpoint, 7 integration, and 2 compile-time mutants of the action list, 36 in all; the single survivor is the equivalent one above.
- `wrangler deploy --dry-run` parsed the edited `wrangler.toml` and bundled the Worker with the new route. It deploys nothing.
- After every save under `packages/`, the Skeleton Crew greps found no demo-app names in `packages/`, no `packages/*` import of `apps/*`, and no sibling import in `packages/core`. The database package imports only `core`.

**Design decisions and deviations, for challenge:**
1. **One statement, not two.** `applyReviewAction` updates the card and logs the event in one SQL statement. Spec 04's sketch inserts the event first and then updates, which for an unknown card makes a 404 into a foreign-key 500 and can log an event for a state change that then fails. Cost: one database request per review.
2. **Naming:** `insertReviewEvent` (Task 24, Spec 04, plan) rather than Spec 02's `createReviewEvent`. The endpoint uses the atomic function, so `insertReviewEvent` is exported, tested and documented but not called by the route.
3. **Times come from the database clock** (`NOW()`), so `last_reviewed_at` equals the event's `created_at` and there is no Worker-versus-database skew.
4. **`SNOOZE_DEFAULT_HOURS`** is a new variable (Spec 04 reads it; Spec 05 says only "configured hours"). Strict whole number 1 to 8760; unset is 24; a bad value fails only `snoozed`, generically, without echoing it.
5. **Check order:** CSRF, authorization, body, then the database. A refused request reads no body and learns nothing about whether a card exists. A bad action for an unknown card is 400, not 404.
6. **`saved` on an already saved card** sets a new time, as Spec 05 says ("set saved timestamp"), rather than keeping the first.
7. **`PUT` is not idempotent for `reviewed`**, which counts again, as the spec defines it.
8. **A snooze hides a card from the lists only**, not from `GET /feed/:id`, which matches the existing read code.

**Limits:**
- `docs/setup.md` does not exist, so the new variable is documented only in the `wrangler.toml` comments and the API README.
- Not run against a deployed Worker, a real Cloudflare Access, or hosted Neon. The private-mode owner path is exercised with a supplied `ctx.access` object, as before.
- A snooze is tested by moving `snoozed_until` into the past; nothing waits out a real 24 hours.
- **Unexplained local slowness.** Several of my own verification runs on this Mac stalled or ran long (some produced only the Vitest banner, one tool call timed out). The same commands finished normally when retried, the database and proxy were healthy each time I checked, and the Mac was under load with a recorded wake from deep idle in the window, so the cause is not established. None of it was in a test result that I report; every figure above is from a run that completed. I did not investigate it further.
- The shared fixture is not reset by these runs except by the database package's own setup; the fixture-size dependence fixed above may exist in other older tests that this run did not happen to trip.

### Independent review of Phase 3 (Grok 4.7, temporary supervisor)

**Supervision change.** The user assigned the supervisory role to **Grok 4.7** until Astra returns on Saturday, 2026-11-21 at 11:50. Grok's approvals count as independent review and are recorded with Grok as the reviewer. Astra may revisit important decisions, but Grok-approved tasks do not automatically need reapproval. During this period the implementation model is Opus 5.5 (it returns to Sonnet 5.5 with Astra). Review requests still go to Firstmate's inbox through the notifier, and the user relays them to Grok by hand.

**Verdict, recorded as received:** **APPROVE WITH CONDITIONS** at `7d5480afdb24fafd470eb1ebdb9466932b826259`, relayed by the user as Grok's. Written review: `firstmate/data/recallfeed-phase3-review/report.md`. Accepted without change: the one-statement update-and-log design, the authorization and refusal order, the JSON-only, 1 KB and ignore-extra-fields rules, the state-transition tests, and the Phase 2 ordering-test correction. `docs/setup.md` is a separate, nonblocking follow-up. No publication or merge is authorized. **Attribution note:** Firstmate's intake record (`firstmate/data/recallfeed/reviews/2026-11-15-phase3-review.md`) names the read-only review worker as `openai/gpt-6-astra`. The verdict reached me as Grok's, so it is recorded that way; who authored which part was not resolved here. The reviewer states it did not independently run the full database suite or the mutation checks.

**The condition, and my response (I agree with it; no disagreement to record).** The review found that the existing tests showed a refused caller with an invalid body gets 401, but not in both deployment modes, not that nothing is written, and not that the answer is the same for a real and a missing card. I agreed, because the gap was real. Commit `2e0644d` adds two tests to `packages/api/src/__tests__/review.test.ts`. Public mode covers no key (401 `AUTH_API_KEY_MISSING`) and a wrong key (403 `AUTH_API_KEY_INVALID`). Private mode, same origin, covers no identity (401 `AUTH_REQUIRED`) and a non-owner (403 `AUTH_FORBIDDEN`). Each test sends five malformed bodies (invalid JSON, unknown action, over 1 KB, wrong content type, empty) to a real card and a missing one. It asserts the expected refusal, an identical body for both cards, an unchanged card, and no new review event in the whole table. **Mutation-checked:** parsing the body before authorization, and looking the card up before authorization, each fail both tests; the real code passes. Test only; no application code changed.

**Gate at `2e0644d`** (same settings as above): lint, build and typecheck exit 0 (5 of 5 tasks, 0 cached); the checker controls pass 9 of 9; `pnpm test:coverage` with the CI checker gives **33 files, 644 tests, 0 skipped, 0 failed** (api 318, connectors 57, core 38, database 181, feed-engine 50), with coverage 96.24% statements, 92.1% branches, 98.37% functions and 96.14% lines. The checker reports "every test ran and passed".

**Condition review (recorded as received):** **APPROVE** at `241c1c016526747544189e2e56856245c0144ec0`. Review file: `firstmate/data/recallfeed/reviews/2026-11-20-phase3-condition.md`. It states the condition is closed and needs no further code correction. It checked the corrected request hash and the three declared file hashes, and confirmed the application diff was only the test file. It read the implementer's test and coverage artifacts but did not rerun the full suite or the mutation checks. It calls the Grok/Astra attribution discrepancy historical delivery metadata, not a defect. `docs/setup.md` remains a separate, nonblocking follow-up.

### Publication and merge of Phase 3 (2026-11-20)

- **Published for CI** under the user's authorization: the branch was pushed without force (it did not exist on the remote before) and opened as private draft PR #4, https://github.com/pauxiel/recallfeed/pull/4, head `115b6ab979e0d3796be053e104797f29af1a5751`, base `0a923d9`. Checked first: the branch name, that the approved `241c1c0` was contained, and that every later commit touched only `.kiro/reviews/`.
- **PR CI:** https://github.com/pauxiel/recallfeed/actions/runs/44771504311 (`pull_request`, attempt 1), **success**. 33 files, 644 tests, 0 skipped, 0 failed (api 318, connectors 57, core 38, database 181, feed-engine 50); coverage 96.24% statements, 92.1% branches, 98.37% functions, 96.14% lines; checker controls 9 of 9; no annotations.
- **Merged** under a separate user authorization. Head, base and checks were re-read from live state, the description was updated and the PR marked ready, and it was merged with a merge commit pinned to `115b6ab` (`--match-head-commit`): `9856fd23d21b3ab95dee61a0a936bd67d9504a78`, parents `0a923d9` and `115b6ab`, at 2026-11-20T16:31:35Z. GitHub reports `merged: true`; the merged tree equals `115b6ab`, and all 20 commits are reachable from `main`. No squash, force or protection bypass. Branches and workspaces kept.
- **Post-merge CI on `main`:** https://github.com/pauxiel/recallfeed/actions/runs/44774264975 (`push`, attempt 1), **success**, the same totals and coverage as the PR run.
- **Watch item, not investigated:** the test step took about 8 minutes in both runs (suite 499 s and 494 s, slowest test 12.8 s), against about 90 to 165 s on earlier PRs and about 200 s locally. The suite grew from 422 to 644 tests, which explains part of that. The whole job took about 10 minutes against its 20-minute timeout.
- **This record** was corrected in the Phase 4 branch (`feat/gate2-phase4-strategies-pagination`), as the user directed, and not in a records-only pull request.

**PHASE 3 CHECKPOINT:** reached only after Tasks 24, 22, and 23 are all done, in that order. All Spec 05 review/publish actions work. Stop for human review before proceeding to Phase 4.

**Checkpoint criteria** (self-verification evidence is in the Phase 3 Execution Record; the boxes stay unchecked until the human review at this checkpoint):
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

**Description:** Implement cursor encoding/decoding with **strategy-dependent sortKey** per Spec 04. Recency uses the effective reviewed timestamp. Importance uses `reviewCount`, the actual ranking key from Spec 04 and Task 26; **there is no computed importance score** (Spec 04's `extractSortKey` returns `item.reviewCount`, and Task 26 removed the weighted score).

**Cursor must encode the whole ordering.** The cursor has to carry every field the strategy sorts by, ending with `id`, or items that tie on the leading key are skipped or repeated at page boundaries. Recency orders by `effectiveReviewedAt`, then `id`. Importance orders by `reviewCount`, then `effectiveReviewedAt`, then `id` (Task 26). Spec 04 describes a single scalar `sortKey` plus `id`, which is not enough for the two-key importance order. **Open decision before this task starts:** settle the cursor shape (for example a `sortKey` that holds every ordering key) and record it as a Spec 04 clarification. Do not drop an ordering key to fit a single scalar.

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
  - Importance: Returns `reviewCount` together with the later ordering keys (`effectiveReviewedAt`), per the cursor shape settled above; no computed score
- [ ] GET /feed uses strategy-specific sortKey for cursor generation
- [ ] The cursor encodes every ordering key of the active strategy plus `id`

**Verification:**
- [ ] Unit tests: Encode/decode cursor round-trip
- [ ] Pagination test with **ties**: several items with equal `reviewCount` (and equal `effectiveReviewedAt`) split across pages; walking every page returns each item exactly once, none skipped or repeated
- [ ] Integration test: GET /feed with recency → cursor contains timestamp, GET /feed with importance → cursor contains `reviewCount` and the tie-break keys

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
- [ ] Strategy-dependent pagination cursors work (timestamp for recency, `reviewCount` plus tie-break keys for importance; no computed score)
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
- [ ] **Phase checkpoints completed:** Human review at boundaries (tasks 7, 21, 23, 28, 30)

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
5. ✅ **Checkpoint review clarified:** Human approval at phase boundaries (tasks 7, 21, 23, 28, 30), no per-task manual approval within a phase, and "Reviewed" requires independent review evidence naming the revision reviewed (see Task State Protocol). [Wording corrected 2026-11-14: this line originally said an automated test suite counted as review, and listed Task 24 as the Phase 3 boundary.]
6. ✅ **Skill setup complete:** Native Kiro structure verified, discovery evidence provided (Task 6)

**All tasks reconciled against approved Specs 01-09, no invented requirements.**

