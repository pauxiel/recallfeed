# RecallFeed Review Request: Phase 2 database spike, correction pass (R1, R2)

**Review Request ID:** recallfeed-20261114-170645-phase2-database-corrections  
**Date:** 2026-11-14 17:06:45 UTC  
**Project Path:** /Users/paulobayuwana/Documents/projects/recallfeed  
**Milestone:** Gate 2, Phase 2 spike: correction-only pass for `firstmate/data/recallfeed/reviews/2026-11-14T163124Z-database.md`  
**Status:** ☑ Ready for Review | ☐ Blocked  
**Authorization:** correction-only pass for R1 and R2, their regression tests, and the small related path/documentation corrections. Architecture unchanged. Tasks 11-21 not started. **Nothing pushed.** No cloud resources, deployment, or visibility change.  
**Active model:** `claude-sonnet-5.5` (session context).  
**Supersedes:** `recallfeed-20261114-162220-phase2-database-spike` (the earlier request stays as the record of the original spike).

---

## State

- Local `main` is 5 commits ahead of `origin/main`; **`origin/main` is still `4f0207b4c20f24611e9d7fe8446be94797b3da72`**. Repository still private.
- Correction commit: `1170b07b6631aec4c9599bfbcfaae9f3004a0aac` (on top of the reviewed `c20296c`). This request and its submission marker are two later records-only commits.
- The disposable Compose stack was **recreated** during this pass (`down -v`, `up -d --wait`) so the container carries the new fixture marker. Only throwaway tmpfs data was discarded. It is running now.

---

## R1: destructive reset guard validated a different host from the driver's target

**Reproduced first** with the real guard and real driver parser, no network: `…@db.localtest.me:5432/recallfeed_test?host=ep-example.neon.tech` was accepted and the driver's effective host was `ep-example.neon.tech`.

**Fix: three gates, all before any destructive SQL** (`test-safety.ts`, `test-fixture.ts`, `test-fixture-node.ts`, `docker/init-test-fixture.sql`):
1. **URL as written.** Allowed host; database name **exactly** `recallfeed_test` (the old "contains the word test" rule is gone; it accepted `customer_test_backup`); **no query string or fragment at all**, judged on the raw string.
2. **Driver's effective target.** An unconnected `Client` is built; its `host`, `port`, and `database` must equal the URL's.
3. **Live session identity and ownership marker.** On the same session that runs the reset, `current_database()` must be `recallfeed_test` and the database must carry the comment `recallfeed-disposable-test-fixture:v1`, written by the container's init script at creation. The marker survives a `public` schema reset (verified).

Per the review, I did not build a general database-policy framework. The default isolated fixture and the separation from development data are unchanged.

## R2: local WebSocket TLS relaxation leaked into later nonlocal connections

**Reproduced first:** `neonConfig.useSecureWebSocket` `true → false` after a local call, still `false` after a nonlocal call.

**Fix** (`local-proxy.ts`, `migrate-node.ts`): the unencrypted settings are set on one client's own `neonConfig`, only when that client's effective host is exactly `db.localtest.me`, and the installed `wsProxy` throws for any other host rather than falling back. Nothing is written to the global config. Verified in the real driver that `client.neonConfig` is a separate object. `fetchEndpoint` is the one setting the driver allows only globally; the replacement answers only for `db.localtest.me` and delegates every other host to the driver's default endpoint (a Neon host still resolves to `https://api.neon.tech/sql`), without stacking wrappers.

## Related corrections from the report

1. `readMigrationFiles(directory)`: `new URL(name, "file://"+dir)` resolved one directory too high without a trailing slash; now `path.join`. Regression test covers with and without the slash, a temp directory, non-`.sql` files ignored, and a missing directory.
2. Transaction wording corrected in `README.md`, `migrate.ts`, `migrate-node.ts`, and the todo, after a live check on PostgreSQL 17.12: `sql.transaction([a, b])` works; a multi-statement string fails with `cannot insert multiple commands into a prepared statement`; an interactive `BEGIN` does not persist across stateless HTTP calls.
3. New plain-Node test project (`vitest.node.config.ts`, `*.node.test.ts`) for the file reader, connection lifecycle, and guarded fixture client. `pnpm test` runs both projects. Coverage now measures the Node files; only `*-cli.ts` entry points are excluded.
4. `pnpm test` is explicitly not labeled full database validation; the README and todo say to run `test:integration` and check the skipped count.
5. `tasks/phase2-proposal.md` and the todo record the decided database option.

**Deliberately not changed** (the report says to reconcile these before further implementation, and this pass is correction-only): Wrangler `4.148.0` versus `4.162.0`; Task 27 cursor; Phase 3 order wording; basic-feed wording; `importMarkdown` JSDoc wording.

---

## Checks Actually Run

Node 22.23.3, at `1170b07`, after deleting `dist/`, `coverage/`, `.turbo/`:

```
pnpm lint                                              -> exit 0
pnpm build                                             -> exit 0   (stray emitted .js files in src/: 0)
pnpm typecheck                                         -> exit 0
pnpm test             (no database)                    -> exit 0   core 10; workerd 61 passed + 16 skipped; node 13 passed + 4 skipped
pnpm --filter @recallfeed/database test:integration    -> exit 0   workerd 77 passed; node 17 passed; 0 skipped
pnpm test:coverage    (with database)                  -> exit 0   10 files, 104 tests; 100% stmts/funcs/lines; 97.91% branches
pnpm db:migrate x2 on a psql-reset schema              -> "applied 001_initial.sql", then "skipped 001_initial.sql"; marker survived
```

**Review reproductions rerun on the corrected code:** R1 URL refused before any client was built (`VALIDATION_TEST_DATABASE_PARAMS`); R2 global stayed `true` after both local and nonlocal configuration.

**Mutation checks (each reverted; files diffed identical to the corrected versions):** removing gate 1's query-string rejection failed 8 tests (7 workerd, 1 Node); reverting to a process-wide TLS relaxation without the host restriction failed 3 tests.

**Fuzz:** 18 URLs (userinfo tricks, trailing dot, case, percent-encoding, `127.1`, IPv6, `;host=`) against gate 1 and the real driver parser. No URL passed gate 1 while the driver resolved a different target. Gate 2 therefore protects against future parser drift; I did not find a live case it catches beyond the `?host=` override that gate 1 now refuses first.

**Regression tests, by name prefix `regression R1` / `regression R2`:** `?host=`, `?hostname=`, `?database=`, `?port=`, `?sslmode`, fragment, bare `?`; seven non-fixture local database names; the review's exact URL through the real driver parser; scripted sessions with wrong name, missing marker, wrong marker get zero destructive statements and the identity check precedes any; **live**: removing the marker makes the reset refuse and existing data is unchanged afterward (marker restored in `finally`); a local client's relaxation does not reach a later nonlocal client; the local client refuses an unencrypted socket to any other host; a throwing socket constructor rejects and leaves no global state; a migration run against the proxy leaves the global `true`.

### Mistakes of mine found by running things
- An interrupted file write (rewritten in full).
- Assumed `fetchEndpoint`'s default was a string; it is a function (checked before coding the delegation).
- A test expected a bare `?` to survive URL parsing; it does not, so gate 1 now checks the raw string.
- A workerd test assumed a throwing socket constructor rejects; there the driver took a different path and appears to have reached the live proxy. I moved it to the Node project, where it is deterministic.
- A Node test assumed `:1` in the URL breaks the connection; the proxy ignores the URL port. Removed; the constructor-failure test already covers a real connection failure.
- Used `timeout`, which macOS lacks, so one probe printed nothing; I do not claim that probe.

---

## Remaining Concerns

### Blockers
None for this pass.

### Uncertainties
- Gate 2 reads `client.host/port/database` from driver 1.2.1; a different driver version could change them (a test would show it).
- The proxy ignores the URL's port and database, so a live "wrong database" case cannot be produced through it. Gate 3 is covered by scripted sessions and by removing the marker live.
- WebSocket transactions were still verified only from Node. No hosted-Neon, deployment, or cloud check.
- `pnpm test` stays green with 20 skipped database-backed tests when no database is configured.

### Known Issues (Non-Blocking)
Later-phase plan items listed above, and the Wrangler pin, remain open.

---

## File Integrity (SHA-256 at `1170b07`)

```
9256aa3767c4a9e823ac05991e66e7379833b5f3c0cf471d12580d2ba156a96a  tasks/todo.md
51e0e7aa852bb5f8211f88ca80f4461f7544987675541eebf38d75ee45bdf5dd  tasks/phase2-proposal.md
590d8dbaa0050babab94b502d3d391d851aa23daf3ab30875613e19de0b44d0d  vitest.config.ts
a00558f921978315392b3ccc5a42f556dc0d0a89aa88581c3698582543d6dd11  tsconfig.json
4bd3a1b1df38e33e3bf7e999967279e27b5af974486f2a6b0f32bb1a4cc5417a  packages/database/package.json
16ef7e0ebcd1f5b50691481e8826e58835c326293125943e518b6557f259e6c4  packages/database/README.md
4530cdcc4c98dc4e10da86287026701839df7576187dab067e89533573d94249  packages/database/vitest.config.ts
3211a3232c6316aaf9c338a6af1f8e4b817365db6bda98260b98cfbed9675eb3  packages/database/vitest.node.config.ts
0aa7a50ded7c76c119209acd54ae3191ab8da71cb22e12a7272d95cc43a80602  packages/database/docker/compose.test.yaml
20ff2cfa7a5e7a498aa7932ea05d2bb001cc2a261c32e2ceab7cec9946ed2493  packages/database/docker/init-test-fixture.sql
428d0a3d6ce3539b77c15d75c6ee1cc82078375f65d23304bf775115a3dabfbf  packages/database/src/local-proxy.ts
9bbd253b795fb15a6ffac18271340c425585ae67559ced188ba36fd313394d1b  packages/database/src/test-safety.ts
d82657feff9cfb3df64821196afd74f4160dbed18400f72ef310edf9721c82b0  packages/database/src/test-fixture.ts
592f61161e42b4bf80ad1cb461b6552e93fc03e8ecd4fe5957e9e1fd19e3b9db  packages/database/src/test-fixture-node.ts
48e856a990d0a1e98cada8cf85c867ba42b8a683875b4cd3d50a3def250cbb66  packages/database/src/migrate-node.ts
a7a1eba10ebe915868f54d41268ae9b47211b3c4609b3ea2dda40bdf12d72833  packages/database/src/migrate.ts
c15b47a42477abd3a77558fffba5bd21bb469e97b2574a47b5a029cea8043aba  packages/database/src/__tests__/setup.ts
3d91125b3c4ebea9858e08dea58a42bf85aed7e64e9018819d3320f9fb7c95e6  packages/database/src/__tests__/local-proxy.test.ts
42206d9823c063f07de7a7bf4498cc4d16cd0752b6cf9c8868366f52158d0064  packages/database/src/__tests__/test-safety.test.ts
6153e666be36a080631c8bc550208c81b41e80ddf0d0e40f1a9badcba97b0e88  packages/database/src/__tests__/test-fixture.test.ts
79183ff390d12f3eb50427ebcddd89def543c90afd1eb39aa7a587c42f4894ae  packages/database/src/__tests__/migrate-node.node.test.ts
f9a34d44fbbe0c5974eff0f55a53f5b351434fdb1c73beff04d8a04f983a1839  packages/database/src/__tests__/test-fixture-node.node.test.ts
```

Correction commit: `1170b07b6631aec4c9599bfbcfaae9f3004a0aac`. Remote `main`: `4f0207b4c20f24611e9d7fe8446be94797b3da72`.

---

## Request for Firstmate

1. Do the three gates and the per-client TLS scoping close R1 and R2 as the report required?
2. Is the HTTP-routing exception acceptable (`fetchEndpoint` is global-only in the driver; the replacement answers only for `db.localtest.me` and otherwise delegates to the default)?
3. Is the fixture-marker approach (a database comment written by the container's init script) an acceptable ownership proof, or do you want a different mechanism?
4. May the database commits be pushed to the private repository?
5. Which later-phase plan items (Wrangler pin, Task 27 cursor, Phase 3 order, basic-feed wording, `importMarkdown` wording) must be settled before Tasks 11-21 are authorized?

**Provide verdict:** APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK

---

**This is a read-only review request.** Work stopped after the correction pass. Tasks 11-21 will not start, and nothing will be pushed, without explicit authorization.
