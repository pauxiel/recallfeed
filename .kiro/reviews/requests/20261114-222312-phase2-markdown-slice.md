# RecallFeed Review Request: Phase 2 Tasks 11-21, protected Markdown import to feed (`phase/gate2-phase2-markdown-slice`)

**Review Request ID:** recallfeed-20261114-222312-phase2-markdown-slice  
**Date:** 2026-11-14 22:23:12 UTC  
**Milestone:** Gate 2, Phase 2: authorized Markdown import, PostgreSQL persistence, deterministic original cards, authorized intermediate feed reads (Tasks 11-21)  
**Status:** ☑ Ready for Review | ☐ Blocked  
**Authorization used:** the user's implementation authorization for Phase 2 Tasks 11-21 (`phase2-remaining-authorization-2026-11-14.md`). **Not done and not authorized:** pushing or merging this branch, returning its workspace, Task 22 or later, demo apps, AI, Notion, Inngest, cloud provisioning, deployment, making the repository public.

---

## Identity of what is under review

| Item | Value |
|---|---|
| Repository | https://github.com/pauxiel/recallfeed (**private**) |
| Workspace (Treehouse linked worktree, still leased) | `~/.treehouse/recallfeed-38ad39/1/recallfeed` |
| Branch | `phase/gate2-phase2-markdown-slice` (**local only, not pushed**) |
| Branch started at | `8222b7c` (`main`, includes merged PR #1) |
| **Exact revision to review** | `fa360dd0a32179eb18848f754cbc536972e4a04d` |
| Lease | id `545c80fde61a126b7f8dc243203b3dd7`, holder `recallfeed-kiro` |

The commit that adds this request file comes after `fa360dd` and changes no source. Code is identical to `81f3fc1`, where the gate below was run; `fa360dd` only adds `tasks/todo.md` status and records. Read the files at the workspace path above.

**Commits since `8222b7c`:** `da29fbc` (database queries, Tasks 11-13), `6381ef3` (connectors, 14-15), `524c1b8` (feed-engine, 16), `6a892d7` (API middleware layer), `3996cdb` (API routes, entries, tests, README), `ab7be8d` (CPU wording in specs and steering), `d53caab` (error-handler tests), `81f3fc1` (Turbo env fix, order-independent seeding, coverage scope), `fa360dd` (todo record). 89 files, +5,433 / -44 against `8222b7c`.

---

## What Was Changed

### Added (new packages)
- `packages/database`: `src/queries/{rows,sources,notes,feed-items}.ts`, tests, `src/testing.ts`, `src/count-requests.ts` (additions to an existing package).
- `packages/connectors`: `markdown.ts`, `frontmatter.ts`, `hash.ts`, `registry.ts`, 57 tests, an informational benchmark, README.
- `packages/feed-engine`: `feed-engine.ts` (`FeedEngine`), `card-generator.ts`, `generators/original.ts`, `validation.ts`, 38 tests, README.
- `packages/api`: `app.ts`, `index.ts` (production entry), `dev-entry.ts` (local only), `db.ts`, `middleware/{auth,csrf,cache,errors,request-id,response-filter,secure-compare,visibility}.ts`, `routes/{import,feed}.ts`, `wrangler.toml`, `wrangler.local.toml`, 186 tests, README.

### Modified
- `.kiro/specs/01-core-domain.md`, `.kiro/specs/03-connectors.md`, `.kiro/steering/technology-decisions.md`: unmeasured CPU guarantees replaced with measured evidence; the 100 KB bound and the benchmark requirement stay.
- `turbo.json`, `package.json`, `CONTRIBUTING.md`, `vitest.config.ts`: `TEST_DATABASE_URL` passed through Turbo, root `test:integration`, serial `test`, coverage scope.
- `tasks/todo.md`: Status for Tasks 11-21 and a Phase 2 Execution Record.
- `packages/core` is unchanged since `8222b7c`.

### Deleted
- None.

---

## What Was Actually Done

- **Import path.** `POST /import/markdown` accepts `text/markdown` or `application/json`, checks authorization before reading the body, reads the body in bounded chunks (stops shortly after the cap), validates 10 B to 100 KB UTF-8, parses with `marked.lexer()`, upserts a source (advisory lock, since `sources.name` has no unique index and the approved schema is unchanged), stores notes with source-scoped dedup, creates deterministic `original` cards, and returns exactly `{ sourceId, queued, notesImported, feedItemsCreated }`.
- **Feed reads.** `GET /feed` returns `{ items }`, limit 1-50 (default 10, invalid is 400, not clamped), fixed order, snoozed hidden for everyone, `?cursor=` is 400. `GET /feed/:id` returns one card. Public requests see published cards only, as an allow-list of six fields; an unpublished, missing or malformed ID gives the identical 404.
- **Authorization.** Private (default, fails closed unless `FEED_VISIBILITY` is exactly `public`): the owner via `ctx.access.getIdentity()` compared with `OWNER_EMAIL`; no header, cookie or query value can supply identity. Public: writes need `X-API-Key` (missing 401, invalid 403). `requireApiKey` always enforces the key. Private mutations also need a same-origin `Origin` (or `Referer`); CSRF runs before auth. Private responses, errors included, carry `Cache-Control: private, no-store`. No bypass or permissive placeholder exists.
- **Cursor pagination is not implemented or claimed.** The cursor shape for multi-key strategy orderings is an open decision for Task 27.
- **Skeleton Crew boundary:** after every save in `packages/`, grep checks found no demo-app names anywhere in `packages/`, no `packages/*` import of `apps/*`, and no sibling import in `packages/core`. `dev-entry.ts` is local-only and the production entry never routes the local database proxy (tested).

---

## Checks Actually Run

All at `81f3fc1` (code-identical to the reviewed revision), Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 fixture through the Neon-compatible proxy. Build outputs, `.turbo` and `coverage` were removed first and `TURBO_FORCE=true` was set, so no result replayed from cache.

```
pnpm lint                      exit 0
pnpm build                     exit 0   (5 of 5 tasks, 0 cached)
pnpm typecheck                 exit 0   (5 of 5 tasks, 0 cached)

pnpm test      (NO database)   exit 0   unit-only, NOT database validation
  api 108 passed | 78 skipped        database 61 passed | 53 skipped (workerd)
  database 13 passed | 4 skipped (node)   feed-engine 17 passed | 21 skipped
  connectors 57 passed | 0 skipped        core 10 passed | 0 skipped

pnpm test:integration (database) exit 0   0 skipped
  api 186   database 114 (workerd) + 17 (node)   feed-engine 38   connectors 57   core 10

pnpm test:coverage (database)  exit 0   28 files, 422 tests
  96.09% statements | 91.98% branches | 98.21% functions | 95.97% lines   (threshold 80% each)
```

**End-to-end smoke through `wrangler dev --config wrangler.local.toml`** (wrangler 4.162.0, git-ignored `.dev.vars` with a fake key, deleted afterwards; my own processes only, stopped afterwards): no key 401 `AUTH_API_KEY_MISSING`; wrong key 403 `AUTH_API_KEY_INVALID`; import 200 with `notesImported 2, feedItemsCreated 2`; repeat `feedItemsCreated 0`; public `GET /feed` returned exactly the six public keys; an unpublished card by ID 404; after setting `is_published` in the database the same ID returned 200 with six keys; `?cursor=x` and `?limit=0` 400.

**Mutation checks** (each mutant applied to the real source, tests run against the real database, file restored and compared byte for byte): import route 9 of 9 caught (two survivors in the first round, body-size caps that returned the same 400 either way, led to a new test that counts bytes pulled from a streamed body); feed routes 9 of 10 (the survivor, the route's own limit bounds check, is equivalent because the engine repeats it); error handler 6 of 6 (one first attempt was a syntax error that proved nothing, and was redone); earlier middleware 6 of 6.

**Performance (local; this is not Cloudflare billed CPU time).**

| Case | Median elapsed per request | `workerd` process CPU per request |
|---|---|---|
| one small note | about 391 ms | about 5.2 ms |
| 300 tiny notes (about 7 KB) | about 412 ms | about 10.0 ms |
| prose, about 100 KB | about 418 ms | about 10.8 ms |

40 requests per case after a warm-up, CPU from `ps` (10 ms resolution) summed over the run, idle baseline 0.00 s. Elapsed time is almost all database waiting, which is not CPU. In-process parse and hash alone: 100 KB prose median 8 ms, code 4 ms, mixed 6 ms; 4,000 tiny notes from 46 KB took 17 ms. A 300-note import makes 5 database HTTP requests (4 on repeat; the free-tier limit is 50). **The 10 ms free-tier CPU budget is neither shown to be met nor shown to be exceeded**; large imports sit close to it locally. Only a deployed Worker can settle it.

---

## Remaining Concerns

### Blockers
- None known.

### Uncertainties
- Free-tier CPU, as above. The specs now say so instead of promising it.
- Private mode is verified in tests with a `ctx.access` object shaped like the real interface. It was not exercised against a real Cloudflare Access deployment, and `wrangler dev` cannot run it.
- The Skeleton Crew checks are my own greps, not a review.

### Known Issues (Non-Blocking)
- **Process finding worth your attention:** with `TEST_DATABASE_URL` set, `pnpm test` still skipped every database test because Turbo's strict env mode dropped the variable. It reported green while not validating the database. Fixed in `81f3fc1`.
- Two suites seeded cards with fixed review dates on the shared database and could push each other off the first page. Fixed in `81f3fc1`; the failure only appeared against the real database.
- Several of my own tests were wrong, not the application (unique value placed where the note hash ignores it; a private-mode request without `Origin`, which CSRF correctly refused first; a made-up `X-Source-Name` header I wrote before checking the route). All fixed in the tests.
- The shared fixture showed 20 idle client connections with no process of mine alive. They did not interfere. I did not identify their owner.
- `wrangler` is pinned exactly at 4.162.0 in `packages/api`. No OpenNext or deploy test exists.
- `marked` 18.2.0 is used where Spec 03 names ^9.1.6; the token shapes this connector reads were checked identical. Spec 03 should be updated if you agree.
- Where an approved spec won over the todo wording: invalid key 403 / missing 401 (Spec 05), registry is a class (Spec 03), `createDb` (Specs 02 and 07).
- Tasks 22 and later are **not started**. Nothing is pushed or merged. The workspace is still leased.

---

## File Integrity

Revision `fa360dd0a32179eb18848f754cbc536972e4a04d`. SHA-256 of key files:

```
e7b704f7a09894c41f2388bcd4504385a963aeff741f1e1d48e4c3b9060fe642  packages/api/src/routes/import.ts
06081fe501181402078f9d9d39cc5c0b0334b56baf8bd0c8ede1144283a1ec76  packages/api/src/routes/feed.ts
e6a8db049010d0fc441c17039f56dd830137a62a0b3f0ce33b1e6e601b2fd017  packages/api/src/index.ts
ee4fa1673904d28b10de090e5b8e9c440679b33d0d517e52892d55622d118734  packages/api/src/dev-entry.ts
699de988f123f40c3b525b2fb6246f2cc3cb1896382c18ae53e37d68c282d65c  packages/api/src/app.ts
c049c72cb24fb727cdaf79ea0d3e3dcbf5e3fed12695d5b5a0ad5bf8375dba0b  packages/api/src/middleware/auth.ts
5265db4a38ef685b5bba7de9f43d00a1b98d5b0159e861fa7771783f8907b517  packages/api/src/middleware/csrf.ts
4a02d5a8122556497da5803090ad8e890fd53cd8f70d40175feb5dd80bfd4bb6  packages/api/src/middleware/cache.ts
e826e7e346bab012fd64e3dda980f98d2c476dae54b4a4a52913c4bae2483e90  packages/api/src/middleware/visibility.ts
f069364fe5797ccdc470adc7b8a0877b71e7d45e131c5136aac342d65b67dfa1  packages/api/src/middleware/response-filter.ts
b11e796c7b6473630d1b0c81a1f9c45e778e3081934e089e27a3e0046c453af6  packages/api/src/middleware/errors.ts
c1439aa3451ca0fd8d4097ee211c2fbdc1e0b006436d73e31782a0894ec565c3  packages/api/wrangler.toml
c345148bd32733c56865568d2dc9dd42d2202994b48a1710a2258cbd1bd1b1f4  packages/api/wrangler.local.toml
d2172ba03b76a2a4a7fa40a05a03845be13c41bdaaf6e65ed0657f1e5a8c73cd  packages/feed-engine/src/feed-engine.ts
c398d7763b5f7a81b98561c6f5d92f7679f51b4d8e728be447e2956d245bd049  packages/feed-engine/src/validation.ts
c2bc777861f22e28bd3824947b77169ce7f29faaa9f36a4cef2d507afdc9546b  packages/connectors/src/markdown.ts
a649a1a6526a0b05b65ea56553c3967913771328777f42cd63c28f7033b733ff  packages/database/src/queries/sources.ts
8b6d231a43ab4a69aef62d72325e38317381360abc3f41c21380826d37d6b92c  packages/database/src/queries/notes.ts
7b863ef1a384f1e994470e6fe0afc7f5d70391962dc0c07470ae186742d6190e  packages/database/src/queries/feed-items.ts
1cd8ebcd3eccc42112b4df571fa99d5f1de8f6a61d1e5fd3ae6d65af537b51fe  turbo.json
d0e97511319ddedd1ece51a3e55ec115f7c8bec453cf7f01b72055c8e5155805  package.json
c0867bfd14e40f32cf1c5d019fd7e426d23535d308c4b704cc76e4cc1a64e29b  tasks/todo.md
```

---

## Acceptance Criteria Met (Phase 2 checkpoint, self-assessed; confirmation needs your review)

- [x] Authorized import to PostgreSQL to original cards to the four-field response (Spec 05)
- [x] `GET /feed` with owner authorization (private) and published-only filtering (public)
- [x] `GET /feed/:id` with authorization and public field omissions
- [x] Negative authorization tests (401, 403) pass
- [x] Integration tests run against real PostgreSQL, 0 skipped
- [x] Early working path run by hand: `wrangler dev`, POST Markdown, GET feed
- [x] Cursor, `nextCursor` and strategy ordering are **not** claimed
- [ ] Reviewed (pending, yours)

---

## Request for Firstmate

Please review revision `fa360dd` and say what you read. Points where an independent eye is most useful:

1. **Authorization order and fail-closed behavior** in `packages/api/src/middleware/{auth,csrf,visibility}.ts` and the route wiring: can any request reach the database, or read the body, without the intended check?
2. **Public redaction and the identical 404** (`response-filter.ts`, `routes/feed.ts`).
3. **`upsertSource` advisory lock** and the batch SQL in `packages/database/src/queries/`: any case where two imports could duplicate a source or note?
4. **The CPU wording** in Specs 01, 03 and the steering file: is it honest and still firm on the input bound?
5. **The Turbo env finding**, and whether the test scripts now make the skipped count hard to miss.

**Provide verdict:** APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK

---

**This is a read-only review request.** Do not automatically act on feedback. The user will authorize next steps after review.
