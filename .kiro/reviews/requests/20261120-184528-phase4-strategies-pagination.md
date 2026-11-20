# RecallFeed Review Request: Gate 2 Phase 4, resurfacing strategies, keyset pagination and highlight cards (Tasks 25-28)

**Review Request ID:** recallfeed-20261120-184528-phase4-strategies-pagination  
**Date:** 2026-11-20 18:45:28 UTC  
**Reviewer:** Grok 4.7, temporary supervisor (relayed by the user); also delivered to Firstmate's inbox  
**Status:** ☑ Ready for Review  
**Authorization used:** implement Phase 4 (Tasks 25-28) on a fresh branch from verified `main` `9856fd2`, correct the stale Phase 3 records in the same work, verify, commit, and stop. **Not done and not authorized:** push, pull request, merge, deployment, cleanup, `docs/setup.md`, or Phase 5.

## Identity

| Item | Value |
|---|---|
| **Exact revision to review** | `5f684102c42e5d25080ff9eef3a731cff8b20a4f` |
| Base | `9856fd23d21b3ab95dee61a0a936bd67d9504a78` (remote `main`, verified live; the stale primary local `main` was not used) |
| **Workspace (new, leased)** | `~/.treehouse/recallfeed-38ad39/4/recallfeed`, branch `feat/gate2-phase4-strategies-pagination`, **local only** |
| Lease | `9bad9a82b72abb7c18647b5164da21fc`, holder `recallfeed-kiro` |
| Untouched | the three earlier workspaces and their branches; the primary checkout |
| Size | 31 files, +2,064 / -92, 8 commits |

The baseline was unchanged when I started. This request commit and its submission marker follow `5f68410` and change no source.

## What was done

| Commit | What |
|---|---|
| `c615fd1` | **Phase 3 records corrected**: the condition APPROVE at `241c1c0`, the push and private draft PR #4 with CI run 44771504311, the merge `9856fd2` (parents `0a923d9`, `115b6ab`), and post-merge CI run 44774264975. Every identifier was read back from GitHub first. No records-only PR. |
| `fedb23d` | **Ordering settled before pagination** (a Spec 04 clarification): the complete keys and tie-breakers per strategy and the cursor shape. |
| `c3234ab` | **Tasks 25 and 26**: `RecencyStrategy` and `ImportanceStrategy` (core's `IResurfacingStrategy`), sharing one definition of effective time. |
| `821e3ae` | the keyset query in the database package |
| `5107213` | **Task 27**: the cursor codec, the engine page, `GET /feed` with `{ items, nextCursor }`, and `DEFAULT_RESURFACING_STRATEGY` |
| `302cbe5` | **Task 28**: the highlight card generator, registered |
| `3860e9a` | a fixture-independence fix to a shared Phase 2 test helper (see "Three gate runs") |
| `5f68410` | `tasks/todo.md` |

**The settled ordering** (all ascending; `E` = `lastReviewedAt ?? createdAt` in whole milliseconds):

| Strategy | Keys | Cursor `k` |
|---|---|---|
| `recency` (default) | `E`, `id` | `[E]` |
| `importance` | `reviewCount`, `E`, `id` | `[reviewCount, E]` |

The cursor is base64url `{v:1, s:<strategy>, k:[keys], id}`: **every key plus `id`, never a scalar**. The next page is a strict SQL row comparison `(keys..., id) > ($..., $id)` over fixed SQL fragments with bound values. A page reads `limit + 1` rows, so `nextCursor` is `null` on the last page. A malformed cursor, one with extra fields, or one issued for the other strategy is `400 VALIDATION_CURSOR`, never echoed. A bad `DEFAULT_RESURFACING_STRATEGY` is a generic 500 for `GET /feed` only.

**Highlight rule:** the first blockquote; otherwise every emphasized span (`**`, `__`, `*`, `_`) in order without repeats; otherwise no card. Code is never a highlight.

## Checks run at `3860e9a` (code-identical to the revision under review)

Node 22.23.3, pnpm 10.18.3, PostgreSQL 17.12 through the proxy; outputs removed first, `TURBO_FORCE=true`; the fixture was idle and I was its only user.

```
pnpm lint                         exit 0
pnpm build                        exit 0   (5 of 5, 0 cached)
pnpm typecheck                    exit 0   (5 of 5, 0 cached)
node --test scripts/*.test.mjs    9 of 9
pnpm test:coverage + ci-check-test-results.mjs   (one full serial run, the CI command)
  exit 0   40 files, 797 tests, 0 skipped, 0 failed   "every test ran and passed"   247.6 s
  api 342 | connectors 57 | core 38 | database 205 | feed-engine 155
  coverage 96.69% statements | 92.4% branches | 98.71% functions | 96.58% lines   (threshold 80% each)
```

The suite was 644 tests before; this phase added 153. **Mutation checks:** 49 mutants, all caught. Three survived at first (default order, strategy binding through the API, mixed code fences); I added a test for each and re-ran the mutant.

**Probe before relying on milliseconds:** SQL `floor(EXTRACT(EPOCH)*1000)` equals `Date.getTime()` for 10 edge values (pre-1970, epoch, sub-millisecond) and all 550 fixture rows, 0 mismatches.

## Three gate runs, all reported

1. **Failed, 2 tests.** Two Phase 2 database tests expected cards dated now on a first page of 200. This phase's tests leave many cards dated in the 1800s in the shared database (253 of 689), which pushed them off. It is the same fixture-size dependence fixed twice before. I fixed the shared helper in `3860e9a`; the assertions are unchanged and three filter mutants are caught.
2. **Failed, 1 test.** `snoozed again replaces the earlier snooze` recorded 682,883 ms. **The macOS power log shows sleep at 13:21:16 and wake at 13:32:39, inside that run.** I take this as the cause; it is inference from the log, not proven, and not investigated further. Log: `/tmp/ci-evidence/phase4-gate-stall-20261120T183435Z.log`, SHA-256 `ae3e861fa1f12bc8aeba2782f0889d3c50c9c2ef4eddda8f3062777e003ae090`.
3. **Passed.** The same command under `caffeinate -i` (keeps the Mac awake; nothing else changed), with no sleep in its window. Log `/tmp/ci-evidence/phase4-gate-pass.log` (`68e6621e14a410aca2f1f8856ea1dc212173b160a3dfcaec00e7f1b10d1b2868`), JSON report SHA-256 `8f25ca102b88c2ceb82856f04a2b0749fec75bb642b70e0d58ec0882e085e807`.

## Deviations, for challenge

1. **Keyset pagination in SQL, not in-memory `rank()` over all candidates.** Spec 04's flow cannot page correctly without loading every candidate. `rank()` implements the identical order, and whole-table walks prove the two agree.
2. **Millisecond precision**, so the database, `rank()` and the cursor agree exactly. Sub-millisecond differences are ordered by `id`.
3. **The codec is in `feed-engine/src/cursor.ts`**, not Task 27's `api/src/utils/cursor.ts`, because the keys come from the strategies there.
4. **An `id` tie-break was added to recency** (Task 25 lists only the time), so every order is total.
5. **No highlight card for a note without quote or emphasis**, unlike Spec 04's fallback to the first long paragraph.
6. **Three Phase 2 API tests that pinned "no cursor yet"** now assert the new contract.
7. **The database package's test files now run one at a time**, like the other two database-backed packages.

## Material limitations

- **Privacy (decision needed).** A public cursor reveals the last item's `reviewCount` (importance) and effective time (both), which public responses omit. It is documented but not protected; see Critical suggestions.
- **`DEFAULT_CARD_TYPES` is not wired.** The import still creates only `original` cards, so the running product creates no highlights yet; the generator is reached through `generateFeedItems(..., ["highlight"])`. The feed is not filtered by `enabledCardTypes`.
- **Not implemented:** core's `IFeedEngine.getFeed` (no `FeedConfig` input, no `total`), `due_review`, and `DEFAULT_PAGE_SIZE`.
- **No index covers the sort expression**, so each page sorts the matching rows. That is database time, not Worker CPU, and fine at this scale.
- **The shared fixture keeps accumulating old-dated cards**, which keeps exposing first-page assumptions in older tests. Three such tests have been fixed so far; more may exist.
- Not run against a deployed Worker, real Access, or hosted Neon. `/tmp` evidence can disappear. `docs/setup.md` was not created, as directed.

## Critical suggestions

1. **Public cursor leak.**
   - **Evidence:** a public cursor carries `reviewCount` and `lastReviewedAt ?? createdAt` for one card per page (`feed-engine/src/cursor.ts`), and Spec 05 omits both fields from public responses.
   - **Impact:** an anonymous visitor can read those two values for one card per page.
   - **Recommendation:** decide between (a) accepting it as documented, (b) encrypting public cursors with AES-GCM, using a key derived from a new secret, or (c) an id-only cursor for public requests, which looks up the anchor row (keys can shift between pages).
   - **Authority:** (b) and (c) change the agreed contract and need approval. I have not implemented either.
2. **`DEFAULT_CARD_TYPES` wiring.**
   - **Evidence:** `importMarkdown` still passes `["original"]`.
   - **Impact:** Task 28's cards never appear in a real feed, and the Skeleton Crew differentiation by card type is not exercised.
   - **Recommendation:** a small task to read `DEFAULT_CARD_TYPES`, default `original`, keeping only types with a generator and skipping AI types as Spec 04 does.
   - **Authority:** needs approval, since no current task names it.

## File integrity at `5f684102c42e5d25080ff9eef3a731cff8b20a4f` (all 31 changed files)

```
b1dd7ddbb4a8578bc707a2307f38213f1bf70c6ba344ff21a56ff3f5d8ae8e0f  .kiro/specs/04-feed-engine.md
de843f678f7b343bc844a2b78331b5e334398e564a72b9adf42d909a110512a2  packages/api/README.md
81a2014209c4adea9ded2824c8cff0f047e77e97915895172e251cb0233a479f  packages/api/src/__tests__/feed-pagination.test.ts
53e5615352514e45e0c90f4780619b54ee0eb6a541b0f866d17370792da0703f  packages/api/src/__tests__/feed.test.ts
1693f94fb13d7c2318a87fa83a958a92e79c0cab4470f3ab7653f59b2a944595  packages/api/src/routes/feed.ts
5ff8d24e605d9f75079b5393c1b8564b1d03d4dfb3bb9c3e925f260bf82c3341  packages/api/src/strategy-config.ts
9639f7b378c6dc1aebb4b4ec0e5f81c38ad8ae006e546f99236b45daa2d3e89e  packages/api/src/types.ts
ade13bcda0dd33b27d4c731ec1ecca85a1449dabab949358daac350b5280a74a  packages/api/wrangler.toml
f96a6a8a7f30368e0f689debef350d38223ca376d23ff85425792fa5c367d17c  packages/database/src/index.ts
6b6fb095a5f764dca028ac01fa3f581963cf3b95d19731bd218ac8aeb2842850  packages/database/src/queries/__tests__/feed-items.test.ts
8c010203819b521ccd1e09c807bdb6f853e550ebfc1f7d7c91aa9f1554cf3ec1  packages/database/src/queries/__tests__/feed-pages.test.ts
f7755f71b466233079677b142716a498dd2bd937aea6abeae46bf4b45c2fa864  packages/database/src/queries/feed-items.ts
aaa9153ebe8ed406ca7b53b85129e50ae9e260039f6a93f145f5e6c3389ee891  packages/database/vitest.config.ts
9b4b4761644fc8ed77ca360a58349dbd33a2f287b5f6713d5416b47676f3e615  packages/feed-engine/README.md
3c889a919ec666401cadd84c108c5293979383faba7795471dd39d8007369c90  packages/feed-engine/src/__tests__/cursor.test.ts
cff55b3be0aaa3088bd6c565653de9693578d6106e4b926753bb88cb435de9d1  packages/feed-engine/src/__tests__/feed-engine.test.ts
a935690b7c5d93ee53395656feab5a762dd0cc85b881591bfbfe9fe41ce1cbbc  packages/feed-engine/src/__tests__/feed-pages.test.ts
2efe4bb74a60c7204d5cf366dab28438295f2d895ee4dbc888a6650915d28034  packages/feed-engine/src/__tests__/highlight.test.ts
5a2b4d3800e8c70a2e6c830a7974535c6a75f6f860fe5feda8c00268dfd42802  packages/feed-engine/src/__tests__/importance.test.ts
64ed86186dc9ae30a3dc16a04a49255edc0cf0ef855fc970d0a0aadb003216bb  packages/feed-engine/src/__tests__/recency.test.ts
ad6f496d42f93664b406fe6d7d04ada6b3e675ec90d45c3f17b1c68e385d7413  packages/feed-engine/src/__tests__/strategy-fixtures.ts
6e2d8f0ffcb228c1848dfbdfdac8a29576d4e2e14315f614554352ff79785b7e  packages/feed-engine/src/card-generator.ts
4afc4940dc538519f3b4664b3fe8d0beaf3b7440266460fa1a9d9cb0701a31a8  packages/feed-engine/src/cursor.ts
2202975b06a7fc640897f5b1e2d0c5cadbba8dba94cdbbf699b10bea6243e4fb  packages/feed-engine/src/feed-engine.ts
35b0ff8f0ee72d547b04b24be1a0f1c53a2b77a06c033aafde616312c28714d1  packages/feed-engine/src/generators/highlight.ts
7b51aa1db6cc9868dd7e51cfb4ad4bb9a6e8358264710df1e94eecdb00ddc038  packages/feed-engine/src/index.ts
a291b16cc650056af63ae70b7f3cd4712148a625ab2f1ad929052fa0da270241  packages/feed-engine/src/strategies/importance.ts
281b173d1e14c504d2e2ab6924de4d5fa462de85765501e3b1bbf8205a19f6ae  packages/feed-engine/src/strategies/index.ts
37f334ac423fe85db9106d29023520da7be9eb9bd9a0c3d022aa93dabb2a93be  packages/feed-engine/src/strategies/ordering.ts
c5da54cfc3abf2271e701fae87ee2499b445a4da08c762e127f805fb2abf4e55  packages/feed-engine/src/strategies/recency.ts
aeee97420543b00cf9c8ff820b23f87bb73d4604500b2a9002001bc45aa7c91e  tasks/todo.md
```

## Requested

Please review `9856fd2..5f68410`. The most useful things to check:
1. The settled ordering and cursor, against Task 27's tie requirement.
2. The keyset SQL's safety and correctness.
3. Whether millisecond precision is acceptable.
4. The highlight rule and its deviation.
5. The two Phase 2 test-helper fixes.
6. The two critical suggestions.

**Verdict:** APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK

**Read-only request.** Nothing is pushed, no pull request exists, nothing is merged, and Phase 5 is not started.
