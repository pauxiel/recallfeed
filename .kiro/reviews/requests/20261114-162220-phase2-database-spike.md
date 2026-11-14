# RecallFeed Review Request: Phase 2 database spike (Tasks 8-10 only)

**Review Request ID:** recallfeed-20261114-162220-phase2-database-spike  
**Date:** 2026-11-14 16:22:20 UTC  
**Project Path:** /Users/paulobayuwana/Documents/projects/recallfeed  
**Milestone:** Gate 2, Phase 2 spike: prove the Neon HTTP driver in the Workers test runtime, the migration path, and named constraints  
**Status:** ☑ Ready for Review | ☐ Blocked  
**Authorization:** the user's 2026-11-14 decisions (Colima/Docker/Compose install, PostgreSQL 17 plus local Neon-compatible proxy, MIT license, GitHub owner `pauxiel`). Work stopped after Task 10. Tasks 11-21 are not started.  
**Active model:** `claude-sonnet-5.5` (session context).  
**Contest rules:** read `firstmate/data/recallfeed/kiroween-2026-rules-check.md` before the license decision; no 2025 rules were used.

---

## GitHub state (items 1 and 2 of the request)

- Repository: <https://github.com/pauxiel/recallfeed>, **private** (`visibility: PRIVATE`; unauthenticated requests to the API and the web URL both return HTTP 404). GitHub detects the license as MIT.
- Pushed to `origin/main`: commit `4f0207b4c20f24611e9d7fe8446be94797b3da72`, containing the reviewed Phase 1 work, the Node `engines` correction (`be4d514`), the Phase 2 proposal, and the MIT license. 9 commits, 69 `.kiro` files, plain push, no force.
- **Not pushed:** this spike. `main` is 2 commits ahead of `origin/main` locally (`f07e34d` code, `2571943` records), plus this request. The push authorization named reviewed Phase 1 work and the Node follow-up, so I held the spike back for your review.
- Pre-push history inspection: no token shapes, private keys, credentialed URLs with real secrets, or secret-like file names in any of the 9 commits. Disclosed, not changed: 17 tracked files contain absolute paths with the macOS username, 38 files mention the Firstmate setup, and commits carry the author email. Acceptable for a private repository; clean before any public release.

---

## What Was Changed (since pushed commit `4f0207b`)

### Files Added
- `packages/database/` : `package.json`, `README.md`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.test.json`, `tsconfig.build.json`
- `packages/database/src/` : `client.ts`, `index.ts`, `local-proxy.ts`, `migrate.ts`, `migrate-node.ts`, `migrate-cli.ts`, `test-safety.ts`, `migrations/001_initial.sql`
- `packages/database/src/__tests__/` : `driver.test.ts`, `schema.test.ts`, `migrate.test.ts`, `test-safety.test.ts`, `local-proxy.test.ts`, `setup.ts`, `env.d.ts`, `provided-context.d.ts`
- `packages/database/docker/compose.test.yaml` (digest-pinned images)
- `.env.test.example`

### Files Modified
- `.gitignore` (`!.env.*.example`; `packages/*/src/**/*.js`), `package.json` (root dev dependencies `tsx`, `@types/node`), `pnpm-lock.yaml`, `tsconfig.json` (root excludes Node-only files), `vitest.config.ts` (coverage excludes Node-only files, with the reason), `packages/core/tsconfig.build.json` (`noEmitOnError`), `tasks/todo.md` (Task 8-10 status and the spike evidence section).

### Files Deleted
None tracked. Eight untracked stray `.js`/`.d.ts` files in `packages/core/src/` were deleted (see Problems).

---

## What Was Actually Done

- **Colima/Docker/Compose** installed through Homebrew without sudo (`colima 0.10.3`, `lima 2.3.0`, `docker 29.9.3`, `docker-compose 5.7.1`), VM 2 CPU / 3 GB / 20 GB. Creates `~/.colima`, `~/.lima`, and a `colima` Docker context. No hosts-file, DNS, certificate, or `~/.docker/config.json` change; `db.localtest.me` already resolved to 127.0.0.1.
- **Stack:** `postgres:17@sha256:846a7dda…` (17.12) and `ghcr.io/timowilhelm/local-neon-http-proxy@sha256:cd2ae14e…`. Postgres data on tmpfs, no Postgres port published, proxy published only on `127.0.0.1:4444` (confirmed with `lsof`).
- **Driver proof:** `@neondatabase/serverless@1.2.1` via `createDb()` ran inside workerd and returned `PostgreSQL 17.12 … aarch64` from `recallfeed_test`.
- **Migration path:** `001_initial.sql` transcribed from Spec 02; numeric-prefix runner with one transaction per file plus its tracking row; Node CLI (`pnpm db:migrate`).
- **Constraints:** the integration suite asserts `code` and `constraint` fields of real database errors.
- **Safety:** `assertSafeTestDatabaseUrl` (local hosts only, database name must contain `test`) guards the schema reset; the Neon driver is rerouted to the proxy only for the exact host `db.localtest.me`.

### Deviations
1. Factory is `createDb` (Spec 02 and Spec 07 names), not the todo's `createDatabaseClient`.
2. Spec 02 says both "lexicographic" and "numeric by prefix" ordering; implemented numeric.
3. `001_initial.sql` repeats `CREATE TABLE IF NOT EXISTS _schema_migrations` because the spec says both the runner and `001` create it.
4. Task 10's file name `setup.ts` is kept, but it is a Vitest `globalSetup` that runs in Node.
5. Root `tsconfig.json` now excludes Node-only files (they are checked by the package's `tsconfig.node.json`), and root coverage excludes them (they run outside the instrumented Workers process).
6. Task 10 transport: Option A refined to local PostgreSQL behind the local proxy; plain `localhost:5432` alone does not work with the HTTP client.

---

## Checks Actually Run

All on Node 22.23.3 at HEAD `2571943`, after deleting `dist/`, `coverage/`, and `.turbo/`.

```
pnpm lint                                               -> exit 0
pnpm build                                              -> exit 0   (core and database)
pnpm typecheck                                          -> exit 0
pnpm test            (no TEST_DATABASE_URL)             -> exit 0   core 10 passed; database 29 passed, 16 skipped
pnpm --filter @recallfeed/database test:integration     -> exit 0   5 files, 45 tests passed
pnpm test:coverage   (with database)                    -> exit 0   55 tests; 100% on the 5 instrumented files
```

Migration CLI against a database reset to zero tables (confirmed `tables after reset: 0`): first run `applied 001_initial.sql`, second run `skipped 001_initial.sql`. `psql` inside the container confirmed one `_schema_migrations` row, 5 tables, 11 `*_idx` indexes, and `CREATE UNIQUE INDEX notes_source_content_hash_idx … (source_id, content_hash)`. A deliberately broken second migration was rejected and left no table and no tracking row.

Negative controls: making `notes_source_content_hash_idx` non-unique and renaming `feed_items_note_card_type_idx` made 3 integration tests fail (migration restored byte for byte). The CLI without `DATABASE_URL` refused with exit 1.

### Problems found and fixed (all mine)
- A failed first build (`TS6059`) still emitted 8 `.js`/`.d.ts` files into `packages/core/src/`. Vite loaded `errors.js` instead of `errors.ts`, so coverage of `errors.ts` fell from 100% to 0%. My first diagnosis (duplicate Vitest copies) was wrong and had no effect. The cause was found by building the pushed commit in a clean worktree (100%), moving `packages/database` aside (still 0%), then reading `git status`. Fixed with file deletion, `noEmitOnError`, dropping `rootDir` in the database build config, and a `.gitignore` rule.
- `.env.test.example` was ignored by my own pattern; fixed.
- One migration-CLI "first run" was invalid because a zsh word-splitting error meant the database was never reset; redone correctly. Earlier similar zsh mistakes produced invalid output that was discarded and rerun.
- One test asserted the wrong textual form of a partial-index predicate; the assertion was fixed, not the schema.

---

## Remaining Concerns

### Blockers
None for the spike.

### Uncertainties
- The proxy is a community image (CC0-1.0, last built 2026-03-27 from Neon proxy release 8853). Parity with hosted Neon is high but unproven. No real Neon branch was used.
- WebSocket transactions were exercised only from Node (`ws`), not from workerd.
- First use of `db.localtest.me` needs internet DNS; offline use needs a privileged hosts entry I did not make.
- Colima is not started at login, so the stack must be started manually (`pnpm --filter @recallfeed/database db:test:up`). It is running now.
- The integration suites skip silently without a database. `pnpm test` can be green with 16 skipped; the skipped count is the signal.
- Node-only files (`migrate-node.ts`, `migrate-cli.ts`, `setup.ts`) have no instrumented coverage; they are verified by running them.

### Known Issues (Non-Blocking)
- Later-phase plan corrections from the Phase 1 review are still unapplied (Task 27 cursor, Phase 3 order, basic-feed wording, `importMarkdown` JSDoc wording). Wrangler `4.148.0` in the plan versus `4.162.0` installed remains a Task 17 decision.
- `tasks/phase2-proposal.md` still lists the database option and Wrangler pin as open decisions; the database option is now decided and implemented.

---

## File Integrity (SHA-256 at `2571943`)

```
6c5050fc9544437a84186fec03929a479b61a76eac0a872c525f928fc7ca93f2  tasks/todo.md
dce9ebe4d12221b17348209a15e45a59595a123885bfa502b15fe53a8f9d699c  LICENSE
6f202f8bd568cd730dbb2b0d1f8e243bc74c2fa1f64dbce9b2c7ea08bd5c9fd7  .kiro/skills/LICENSE-agent-skills
202401ebc35c573c2097fef8d9bc8abe384eaf9a783ac38bc8c7bac7a6d3d624  package.json
f8f32a1499f9705db7fe2b1b927a3fca94ee753e7159e3eaf68acabc5914f6e8  .gitignore
e6c4c9a3d114d600b676e524cc334249a8d6432a9321bdf3f9b308ad5d0ce645  pnpm-lock.yaml
67c4d13fce5403639c53b13d2df8f59ecd2f1da142e9df649762728a15eee7df  vitest.config.ts
e7354c325fb8360d59707bb991aa48bbd49f62e4f678446e26b075bf175c865b  tsconfig.json
4b1b727f411082c52a71089bc4e3113e8bd410a1bf2a305631e19592076b05ea  packages/database/docker/compose.test.yaml
4859392de0896d3a23d1304b3396048608419330a37d045d81aabb596b7ee61c  packages/database/src/migrations/001_initial.sql
a80ec7985df096dd449502d047720dfb92a49a25032676bfbbf4af83dbef519c  packages/database/src/migrate.ts
8f883fef964ad6b8f9ea83c8e3e2340d507fffc7096890e2c61fa6feec20b18a  packages/database/src/migrate-node.ts
e284a254d316b71d91e6bd75001ce7863ab3a53cea58cbad212643bbcb8aca90  packages/database/src/migrate-cli.ts
ecd1744a9fa6d649d00a7327fa141a4828036a94d5abdcc85b70ffd7a50420cf  packages/database/src/client.ts
f66fc693fe79469db9d9129463b76032b80b5b22cd8c6318651ccf047500001c  packages/database/src/local-proxy.ts
3892b1626b814bada19bd1936a3ea4b8a0781df734c65a6a4b73fc28df9a5397  packages/database/src/test-safety.ts
4cecd6e543386134124b6a67cd0163a923f4d6124033bc44390d66e33507624b  packages/database/src/__tests__/schema.test.ts
a4c58350cb8b13eb5d420637d5da5b673f24b29eceb3ff155bf03563b8ebd81e  packages/database/src/__tests__/driver.test.ts
20d27980da660b6376b7bb4140954e139aa343e2ab5d836cfb63f69fca591fba  packages/database/src/__tests__/setup.ts
```

Commits: code `f07e34d46981ba49b0d152b3058ca903f548bda3`; records `25719432da6bbabb027a5d2b5c362754ed7970c2`. Remote `main`: `4f0207b4c20f24611e9d7fe8446be94797b3da72`.

---

## Request for Firstmate

1. Is the driver proof sufficient (HTTP `neon()` in workerd against PostgreSQL 17.12), given that WebSocket transactions were verified only from Node and the proxy is community-maintained?
2. Are the named-constraint checks adequate for Task 10, including asserting the PostgreSQL-generated check-constraint names that Spec 02 leaves unnamed?
3. Is the Node-only coverage exclusion acceptable, or should those files get a Node-environment test project?
4. May the spike commits be pushed to the private repository?
5. Which remaining Phase 2 items must be settled before Tasks 11-21 are authorized?

**Provide verdict:** APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK

---

**This is a read-only review request.** Work stopped after Task 10. Tasks 11-21 will not start without explicit authorization.
