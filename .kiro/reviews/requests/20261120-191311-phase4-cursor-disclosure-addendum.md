# RecallFeed Review Request: Phase 4 addendum, accepted public cursor disclosure

**Review Request ID:** recallfeed-20261120-191311-phase4-cursor-disclosure-addendum  
**Date:** 2026-11-20 19:13:11 UTC  
**Workspace:** `/Users/paulobayuwana/.treehouse/recallfeed-38ad39/4/recallfeed` (branch `feat/gate2-phase4-strategies-pagination`, local only)  
**Revision to review:** `e984ef6f5c1d22980d10eb8cca794558c9205eb3`  
**Follows:** the approval of Phase 4 at `5f684102c42e5d25080ff9eef3a731cff8b20a4f` (request `recallfeed-20261120-184528-phase4-strategies-pagination`)

## What changed since `5f68410`

The changes are documentation and records only. No code behavior, test or API contract changed.

- `68ee8d4` documents the public cursor disclosure as accepted in:
  - the Spec 04 clarification;
  - `packages/api/README.md`;
  - `packages/feed-engine/README.md`;
  - the `encodeCursor` JSDoc in `packages/feed-engine/src/cursor.ts` (four comment lines; nothing else in the file changed).

  The wording says the cursor is opaque but not encrypted. On each page that has a `nextCursor`, it reveals the last card's effective time (`lastReviewedAt ?? createdAt`, in milliseconds, under both strategies) and its `reviewCount` (under `importance` only). Public card responses omit both fields. The cursor carries no other card data, and a forged cursor cannot reach an unpublished card. Cursors stay unencrypted, and the pagination contract is unchanged.
- `e984ef6` updates `tasks/todo.md`:
  - Tasks 25–28 are marked Reviewed (APPROVE at `5f68410`, relayed by the user). The record notes that no written review file exists, because Firstmate's scout could not authenticate.
  - The Phase 4 checkpoint boxes are checked.
  - A "Review of Phase 4" section records both decisions and this gate.
  - Wiring highlight cards into imports (`DEFAULT_CARD_TYPES`) is recorded as a separate follow-up and is not part of this change.

## Hashes at `e984ef6` (SHA-256 of the file contents in git)

```
a528066ae1a17b1d995a4697f12fbff3aabdfba5d3b912dcce7943e6a697be56  .kiro/specs/04-feed-engine.md
d797792eb1e0823d0641fd231ed80b07c3259c89bd4249e6068250e1191ba40f  packages/api/README.md
f28d262aa0527786df843e5301179e0ee2708c5653ba1da80ae7b7fa48e8a102  packages/feed-engine/README.md
d35a6fc69be95e5e8083473fdae5fd095097a796a993002d6fdbff5d449150da  packages/feed-engine/src/cursor.ts
df7bbb884cc52cdcfa20004da8d5cead1ad77dc374cc2542e34380b58becdef1  tasks/todo.md
```

The other files that differ from `5f68410` are the earlier request (`f9d35315…6ebd`, unchanged since `adc5ec4`) and `.kiro/reviews/.last-submitted`.

## Verification (gate at `68ee8d4`; `e984ef6` changes only `tasks/todo.md`)

- Lint, build and typecheck exit 0 (5 of 5 tasks, 0 cached, build outputs removed first). Checker controls: 9 of 9.
- `pnpm test:coverage` with the JSON reporter, then `node scripts/ci-check-test-results.mjs test-results.json`: **40 files, 797 tests, 0 skipped, 0 failed**. Coverage 96.69 / 92.4 / 98.71 / 96.58. The run took 19:08:45–19:12:25 UTC under `caffeinate -i`, with no sleep in the power log.
- My first checker call failed with `TEST_DATABASE_URL is not set` because I left the variable out of that shell. It passed on the same report once the variable was set.
- Log `/tmp/ci-evidence/addendum-gate.log` has SHA-256 `b4216e9a5c9181ed88cbf65536d82ef6ebc509a34a354032c31c3f45a034927f`, and `test-results.json` has `37f27de33bb448e94a1e1cbf2e726cdbb7fa1eadddb575c271c87b464ec51edb`.
- I did not repeat the mutation checks, because no tested behavior changed. The Skeleton Crew greps found nothing.

## Asked

Confirm that the documentation states the accepted disclosure accurately and that nothing else changed. Push, pull request, merge, deployment, cleanup, `docs/setup.md` and Phase 5 are not authorized and were not done.
