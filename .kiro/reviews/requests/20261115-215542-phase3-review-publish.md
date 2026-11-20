# RecallFeed Review Request: Gate 2 Phase 3, Review & Publish Mutations (Tasks 24, 22, 23)

**Review Request ID:** recallfeed-20261115-215542-phase3-review-publish  
**Date:** 2026-11-15 21:55:42 UTC  
**Milestone:** Gate 2, Phase 3: `PUT /feed/:id/review` with all six actions, the review-event queries, and the integration tests  
**Status:** ☑ Ready for Review | ☐ Blocked  
**Authorization used:** the user's instruction to implement the whole phase in the order Task 24, Task 22, Task 23, verify it, commit it, and stop. **Not done and not authorized:** push, a new pull request, merge, deployment, cleanup, or any later-phase work.

---

## Identity of what is under review

| Item | Value |
|---|---|
| **Exact revision to review** | `7d5480afdb24fafd470eb1ebdb9466932b826259` |
| Base | `0a923d9702b6ea2c47b0eff7d18f79b2695b19c9`, the verified remote `main` (checked live before branching; the primary checkout's local `main` was stale and was not used) |
| **Workspace (new, leased)** | `~/.treehouse/recallfeed-38ad39/3/recallfeed` |
| Branch | `feat/gate2-phase3-review-publish`, **local only: not pushed, no pull request** |
| Lease | id `6911139c0d8f4e9624de199b9af85364`, holder `recallfeed-kiro` |
| Untouched | the earlier branches and their leased workspaces (`.../1/recallfeed` and `.../2/recallfeed`); the primary checkout |

The request commit and a submission-marker commit follow `7d5480a` and change no source. The baseline was unchanged: remote `main` still equalled `0a923d9` when I started and nothing unexpected was found.

**Changed since the baseline:** 26 files, +2,007 / -78. Ten commits, oldest first (the request and its submission marker follow them):

| Commit | What |
|---|---|
| `c2ed3f1` | the bounded request-body reader moved, unchanged, out of the import route into `request-body.ts` so both write routes share one copy (the 41 import tests pass) |
| `979f92f` | core: `REVIEW_ACTIONS`, `isReviewAction`, and a compile-time check that the list and the `ReviewAction` type agree |
| `2d19cc5` | **Task 24**: `insertReviewEvent`, `listReviewEventsByFeedItem`, `applyReviewAction`, and 50 tests |
| `7398acd` | `FeedEngine.recordReview`, `DEFAULT_SNOOZE_HOURS`, and 12 tests |
| `7db6fc0` | **Task 22**: `PUT /feed/:id/review`, `SNOOZE_DEFAULT_HOURS`, and 110 tests |
| `0cc7cea` | **Task 23**: `review-integration.test.ts`, 20 tests |
| `54e7a7c` | documentation: API, core, database and feed-engine READMEs, and `wrangler.toml` comments |
| `0c28020` | a fix to an existing **Phase 2** test that the first full run exposed (see below) |
| `85c3868`, `7d5480a` | `tasks/todo.md`; the second corrects a mistake of mine in the first (see below) |

---

## What was done

- **`PUT /feed/:id/review`** records `reviewed`, `saved`, `unsaved`, `snoozed`, `published` and `unpublished` per Spec 05, and returns exactly `id, reviewCount, lastReviewedAt, savedAt, snoozedUntil, isPublished`. There is **no separate publish endpoint**. Authorization, CSRF, private caching and public-data filtering are the ones import and the reads already use: the owner (with the Origin check) in a private deployment, an API key in a public one. Order: CSRF, authorization, body, database. A refused request reads no body and cannot learn whether a card exists. The body is `application/json` only, at most 1 KB, and fields other than `action` are ignored, so a caller cannot set state directly.
- **One statement per review.** `applyReviewAction` updates the card and inserts its event in a single SQL statement, so both happen or neither does. An unknown card changes and logs nothing and returns `null` (a 404), not a foreign-key error. Each action is a fixed SQL fragment, so request data never becomes SQL text. Times use the database clock, and the counter is `review_count + 1` in SQL, so concurrent reviews all count.
- **The log is immutable by construction.** The module and the package export no function that updates or deletes an event, and a test fails if one appears. The foreign key to `feed_items` is enforced and reported as `NotFoundError`, matched on the constraint name.
- **`SNOOZE_DEFAULT_HOURS`** (new, optional): a whole number from 1 to 8760, unset means 24 (Spec 04). A set but unusable value makes `snoozed`, and only `snoozed`, fail with a generic 500, without echoing the value.

---

## Checks Actually Run

At `0c28020` (code-identical to the reviewed revision; the later commits change only `tasks/todo.md` and this request). Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 through the Neon-compatible proxy; build outputs removed first, `TURBO_FORCE=true`; I was the only user of the shared fixture, checked before each run.

```
pnpm lint                         exit 0
pnpm build                        exit 0   (5 of 5 tasks, 0 cached)
pnpm typecheck                    exit 0   (5 of 5 tasks, 0 cached)
node --test scripts/*.test.mjs    9 of 9   (the CI checker controls)

pnpm test:coverage --reporter=default --reporter=json --outputFile.json=test-results.json   (the CI command)
node scripts/ci-check-test-results.mjs test-results.json
  exit 0   33 files, 642 tests, 0 skipped, 0 failed   "every test ran and passed"
  api 316 | connectors 57 | core 38 | database 181 | feed-engine 50
  coverage: 96.24% statements | 92.1% branches | 98.37% functions | 96.14% lines   (threshold 80% each)
```

Before this phase there were 422 tests; this phase added 220, none skipped. New files: `snooze-config.ts` 100%, `review.ts` 100% of lines, `review-events.ts` 94% (the uncovered lines are a defensive "no row returned" throw and the rethrow of a non-foreign-key error). `wrangler deploy --dry-run` parsed the edited `wrangler.toml` and bundled the Worker with the new route, deploying nothing.

**Mutation checks.** I ran each mutant against the real database, then restored the file and compared it byte for byte. 36 in total: 12 database (no increment, snooze in minutes, publish sets FALSE, no event logged, UPDATE without WHERE, hard-coded event action, unmapped foreign-key error, unsave sets a time, no action validation, no snooze upper or lower bound, a malformed ID queried), 4 engine, 11 endpoint (no auth, no CSRF, wrong order, any content type, no size cap, no action validation, response leaks the card, response drops a field, snooze length ignored, bad config checked for every action, ID taken from the body), 7 integration (a publish that also snoozes, a review that clears the saved flag, and others), and 2 compile-time. Three ordering mutants also guard the fixed Phase 2 test. **All are caught except one, which is equivalent:** the engine's own action check is duplicated by the database layer, which rejects the same action with the same code, so removing it changes nothing observable. I kept it as defense in depth.

---

## Two things that went wrong, and what I did

1. **The first full serial run failed one existing Phase 2 test** (`orders oldest effective review time first, then by id`, in the database package). It passes alone. `getFeedItemCandidates` returns at most 200 cards; that test looked for three cards with recent dates, and once other suites had left enough ancient-dated cards in the shared database (114 among 546), the three fell off the first page. The application was not at fault. This is the same fixture-size dependence the CI-timeout work met, exposed by this phase's tests. I fixed the test (commit `0c28020`) so its cards sort among the first, keeping the assertion about `COALESCE(last_reviewed_at, created_at)` ordering; three ordering mutants confirm it still guards that. A fresh CI database would not have hit this, since CI starts empty.
2. **I swapped Tasks 23 and 24's status text in `tasks/todo.md`.** Both started from identical placeholders and my replacement matched the first occurrence. I found it by reading the result back, not by trusting it, and fixed it in `7d5480a`. Each block now names its own commit.

---

## Design decisions and deviations, for challenge

1. **Atomic single statement, not Spec 04's two calls.** Spec 04's sketch inserts the event and then updates the card. For an unknown card that turns a 404 into a foreign-key 500, and it can log an event whose state change then fails. Cost: one database request per review.
2. **Naming.** `insertReviewEvent` per Task 24, Spec 04 and the plan; Spec 02 calls it `createReviewEvent`. The endpoint calls the atomic function, so `insertReviewEvent` is exported, tested and documented but not called by the route. Task 22's note says the endpoint "requires" it.
3. **Core gained a small runtime list** (`REVIEW_ACTIONS`), because validation needs the actions at runtime. Core still has no dependencies.
4. **`saved` on an already saved card** sets a new time, as Spec 05 says, and does not keep the first.
5. **`PUT` is not idempotent for `reviewed`**, which counts again, as the spec defines.
6. **A snooze hides a card from the lists only**, not from `GET /feed/:id`, which matches the existing read code.
7. **A bad action for an unknown card is 400**, not 404: the body is checked before the lookup.

---

## Remaining Concerns

### Blockers
- None known.

### Uncertainties and limits
- **Not run against** a deployed Worker, a real Cloudflare Access, or hosted Neon. The owner path in private mode is tested with a supplied `ctx.access` object shaped like the real one.
- **A snooze is tested by moving `snoozed_until` into the past**; nothing waits out a real day.
- **Unexplained local slowness.** Several of my verification runs on this Mac stalled or ran long: some produced only the Vitest banner, and one tool call timed out. The same commands finished normally when retried, the database and proxy were healthy each time I looked, and the Mac was under load with a recorded wake from deep idle in the window, so the cause is not established. I did not investigate it, in line with your instruction not to reopen the timeout work. Every figure above comes from a run that completed.
- **Older tests may share the fixture-size dependence I fixed once.** The full run found one. Others may exist that a clean run does not trip.
- **A test passing on its first run proves little.** That is why every new behavior was mutation-checked; the numbers are above.

### Critical suggestions
- **Evidence:** `docs/setup.md` does not exist in the repository. The project conventions call it the canonical onboarding document, and the Skeleton Crew checklist says every new environment variable is documented there and in `wrangler.toml`.
- **Impact:** `SNOOZE_DEFAULT_HOURS` is documented only in the `wrangler.toml` comments and the API README, so that checklist item cannot be met, and the same gap applies to every variable added in earlier phases.
- **Recommendation:** a small separate task to create a minimal `docs/setup.md` listing the variables that exist.
- **Authority:** needs approval, because it creates a file outside this phase's scope. I did not create it.

---

## File Integrity

SHA-256 of every file changed since the baseline, at revision `7d5480afdb24fafd470eb1ebdb9466932b826259`:

```
49ec1032264f8216c1cd530f519b4b99c037a722b26f2c9338f86f150d3382dd  packages/api/README.md
7c586f6619364f5d9d91dc7d0c70788779f7b7b58e170faab6b48f1dfab33739  packages/api/src/__tests__/review-integration.test.ts
1e4d930e7575fa6ab759122c6607a8b0183a681bc70611f3a8154e603e499426  packages/api/src/__tests__/review.test.ts
78e27369ac2e188fae1da58c6f9c618c31478c020c6e07e6bc8ae66b911f0272  packages/api/src/__tests__/snooze-config.test.ts
cb0b1051a984b6cfc7b3d05701477ff1947b6c079952a1693fbef6110c9b8b77  packages/api/src/app.ts
814632d83f380204e5139492d014293ee514935aa74d99e98f040663c8e26b12  packages/api/src/request-body.ts
1c236bdd5aebdc21e2eed101025dcbbc8a06e400f6cc0d7d117e8ac04fb3c677  packages/api/src/routes/import.ts
6d3932c30f5c5a598b54f4d4263f95f8a8fdc3475382f8a4c3510274c6625393  packages/api/src/routes/review.ts
0a898e91443834267e88af5f4379d8a539fd46b21e6527a6fa13786b59fee91e  packages/api/src/snooze-config.ts
9dc020a0cd8ca546ce109dffe32079618b916b9018e23ff5b6b75b6249e591a6  packages/api/src/types.ts
40eb15a23f626b426a9a251c5bd0e143a8c26c3bac1403bca13b4a9cff78d050  packages/api/wrangler.toml
e48848538685bbd1de96815cc41183f3debd47b98e5d1664af41e17886011cab  packages/core/README.md
8e261e67e01e4b5a56b1dcee19fa14d8722b451ebb16c5a7429f4572cc2e79a6  packages/core/src/__tests__/review-actions.test.ts
0e233c7a0c4d9a279d0b69e0f608a1616352f1d26a30fb41f158dbba61124727  packages/core/src/index.ts
af9691d34f8b95700106c439f7f76e148b97ca6bb16f0b0a6eaaba094a8a0c42  packages/core/src/review-actions.ts
aed72bccb28dd0d48972effd0ca9f5af4019746b9bcc48f912ee14f184556321  packages/database/README.md
c78c230a90f8de4366c5ffc2fbe347977c66c074af2c9093bc7fe31b333e13b2  packages/database/src/index.ts
446785d63c64ef228b5463bde35738eb6610d7fc25045eed37e0d78ce8c2338b  packages/database/src/queries/__tests__/feed-items.test.ts
1bac4ddbb7032f6a3e2445175e53a49c278040fa4092750497644f153e5934bd  packages/database/src/queries/__tests__/review-events.test.ts
5f065e7b220af0d0d289a18c1fb2ba16279b8a4527cb08f5ed4a9c127e85bda2  packages/database/src/queries/review-events.ts
b4bc8be0938edf16a9d119a04fe89f9e23e2b3ac49ebdaa57f3fa92cf1e0d2ef  packages/database/src/queries/rows.ts
00c6df26775f1e323a9282fed913a60ac58d806d538a774bce3f812859f97597  packages/feed-engine/README.md
a4f5c6813bcfc0743d8506e5cd84b84406f5e5838221e52c456f22953f000e55  packages/feed-engine/src/__tests__/feed-engine.test.ts
c836a3cde2a10ed2d50a6c11a96b462e371568256e02790a649249a40a40bdf8  packages/feed-engine/src/feed-engine.ts
1b5572a19895d05f693ddae5f0c78a7704b6339c0b1b257634422a5c2f77007a  packages/feed-engine/src/index.ts
34c1985a99e5513157df1b9acf1c161b36029db8d084201a23c4b923feb5bafe  tasks/todo.md
```

---

## Request for Firstmate

Please review `0a923d9..7d5480a` and say what you read. Where an independent eye helps most:

1. **The one-statement design** (`packages/database/src/queries/review-events.ts`): is atomicity worth departing from Spec 04's sketch and leaving `insertReviewEvent` uncalled by the route? Is the SQL safe, with fixed fragments, parameters only, and the `WHERE id = $1`?
2. **Authorization order and refusal behavior** (`routes/review.ts`): can any request reach the body or the database without the intended check, or learn whether a card exists?
3. **The mass-assignment and size rules**: fields other than `action` ignored, 1 KB cap, JSON only.
4. **Whether the state-transition tests assert real behavior** (`review-integration.test.ts`), including the model-based sequence.
5. **The fix to the Phase 2 ordering test** (`0c28020`) and the two records commits.
6. **The "Critical suggestions" item**, and whether to authorize it.

**Provide verdict:** APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK

---

**This is a read-only review request.** Do not automatically act on feedback. The user will authorize next steps. **Nothing is pushed, no pull request exists, and nothing is merged.** Independent review is pending; this request does not approve itself. The next phase is not started.
