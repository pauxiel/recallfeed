# RecallFeed Review Addendum: qualifying the CI-timeout explanation and the stall evidence (draft PR #3)

**Review Request ID:** recallfeed-20261115-125505-ci-timeout-addendum  
**Date:** 2026-11-15 12:55:05 UTC  
**Supersedes, where they differ:** `.kiro/reviews/requests/20261115-122030-ci-timeout-fix.md` (left unedited as a submitted handoff)  
**Status:** ☑ Ready for Review | ☐ Blocked

| Item | Value |
|---|---|
| Draft pull request | https://github.com/pauxiel/recallfeed/pull/3 (draft, auto-merge off, private repository) |
| **Exact revision to review** | the branch head at submission: the `commit` field of the notification, which also carries this file's own SHA-256. A file cannot name its own commit. The code and records it describes were last changed in `40cc868c443693f09c5566631deb8ea7c7220034`; the hashes in section 4 are of the files at that head. |
| Workspace | `~/.treehouse/recallfeed-38ad39/2/recallfeed`, branch `fix/ci-integration-test-timeout`, leased |
| Changed since `94191c3` (reviewed earlier) | comments in two `helpers.ts` files; `tasks/todo.md`; PR #3 description; this addendum |
| **Unchanged** | application code, every assertion, `DATABASE_TEST_TIMEOUT_MS = 30_000`, coverage thresholds, serial execution, no retries, nothing skipped. In both `helpers.ts` files only comment lines changed. |

No experiment was run and CI was not rerun to write this. Each push to the draft pull request starts its CI automatically; those runs are cited where they matter and none was used to fill an evidence gap.

---

## 1. The 207-second stall, from saved material only

**What is saved and what is not.** Saved: the full log of the 207 s run (`/tmp/lat300.log`, SHA-256 `507ea2eb3a3d0de9d1ca671abbcfd8e453ff6f5075cde0b8065517c7eeae862d`), the isolated +300 ms run (`/tmp/lat300-one.log`, `5dcd6bc88bcf8a9649b082c11015d589b0cd81b6e74e892ff6758ae310dc8d32`), the shim, the config, and the diagnostic test (copies in `/tmp/ci-evidence/diagnostics/`, hashes below). **Not saved:** the output of the first +300 run, the three isolated +0 runs and the two bounded runs; I filtered those through pipes. For them only the summary lines I reported at the time exist, and I rely on my record of the commands. These files are outside the repository, in `/tmp`, so they may not survive.

### 1a. The temporary latency shim (exactly as saved; never committed)

`packages/api/src/__tests__/zz-latency-setup.ts` (SHA-256 `62c6e29c…136c`):
```ts
import { env } from "cloudflare:workers";
const extra = Number((env as unknown as { EXTRA_LATENCY_MS?: string }).EXTRA_LATENCY_MS ?? "0");
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (extra > 0 && url.includes(":4444/sql")) {
    await new Promise((resolve) => setTimeout(resolve, extra));
  }
  return realFetch(input, init);
}) as typeof fetch;
```
`packages/api/vitest.latency.config.ts` (`5fbf6560…26ecc`) is the api config with `name: "api-latency"`, `bindings: { TEST_DATABASE_URL, EXTRA_LATENCY_MS }` taken from the environment, `fileParallelism: false`, the same `globalSetup`, and `setupFiles: ["./src/__tests__/zz-latency-setup.ts"]`. It sets **no** `testTimeout`, so Vitest's 5,000 ms default applies unless the command line overrides it. The delay is added before each database request, and only to requests for the local proxy.

### 1b. The five runs, with the settings that differ

All from `packages/api`, `TEST_DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/recallfeed_test`, config `vitest.latency.config.ts`, Node 22.23.3. All five ran **before the timeout correction existed**: the source tree was the base `ac40227` (the merged `main`, with no timeout option anywhere), plus the untracked shim, config and `zz-timing-diagnostic.test.ts` (which `include: src/**/*.test.ts` picked up). The 30,000 ms constant was added afterwards.

| Run | Command (after `EXTRA_LATENCY_MS=…`) | Files / tests | Effective `testTimeout` | Outcome |
|---|---|---|---|---|
| A: first +300 | `pnpm exec vitest run -c vitest.latency.config.ts --testTimeout=120000` (in a loop with +150, output piped through `sed` and a Python summary) | all 10 files, 187 tests | 120,000 ms | `Tests 1 failed \| 186 passed (187)`. **The failing test was not identified**; output not saved. The +150 run in the same loop passed 187 of 187. Slowest passing at +300: 10,468; 7,943; 7,922; 7,876 ms. |
| **B: the 207 s run** | `EXTRA_LATENCY_MS=300 pnpm exec vitest run -c vitest.latency.config.ts --testTimeout=120000 2>&1 \| sed 's/\x1b\[[0-9;]*m//g' > /tmp/lat300.log` | all 10 files, 187 tests | 120,000 ms | **Saved.** `Test Files 1 failed \| 9 passed (10)`, `Tests 1 failed \| 186 passed (187)`, **the owner import test failed at 207,617 ms**. See 1c. |
| C: isolated, +0 (three runs) | `EXTRA_LATENCY_MS=0 pnpm exec vitest run -c vitest.latency.config.ts src/__tests__/import.test.ts -t "owner's same-origin import succeeds"` | 1 test | 5,000 ms (default) | passed each time: 390, 390, 393 ms |
| D: isolated, +300 | `EXTRA_LATENCY_MS=300 pnpm exec vitest run -c vitest.latency.config.ts --testTimeout=60000 src/__tests__/import.test.ts -t "owner's same-origin import succeeds"` (backgrounded) | 1 test | 60,000 ms | **Saved.** passed in 2,060 ms |
| E and F: "bounded full" | `EXTRA_LATENCY_MS=300 pnpm exec vitest run -c vitest.latency.config.ts --testTimeout=30000 src/__tests__/import.test.ts src/__tests__/feed.test.ts src/__tests__/feed-item.test.ts` (twice) | **3 files, 77 tests** | 30,000 ms | `Tests 77 passed (77)` both times; the owner test took 2,076 and 2,074 ms. Output not saved. |

**Correction to what I reported before:**
- Runs E and F were **not full runs**. They covered three of ten files, so they ran without `zz-timing-diagnostic.test.ts`, `worker-entry.test.ts` and the middleware tests.
- They also used a 30 s limit against the failing run's 120 s.
- The stall was **not** a single occurrence: run A also ended with one failure at the same latency and flags. Its test was not identified, so I cannot say it was the same one.
- In D the database was sampled three times with `pg_stat_activity` (`sessions=20 active=0 waiting-on-lock=0`), at about 12, 16 and 20 s after the background launch. The test takes 2 s, so those samples very likely came after it finished. **They are not evidence about lock waits during any run**, and I did not sample the database during runs A, B, E or F.

### 1c. The 207 s log, and what "120 s" and "207 s" each measured

Excerpt of `/tmp/lat300.log` (line numbers are the log's):
```
36   ✓ api-latency src/__tests__/zz-timing-diagnostic.test.ts (1 test) 31013ms     <- ran first
38   ✓ api-latency src/__tests__/feed.test.ts (27 tests) 42199ms
51   ❯ api-latency src/__tests__/import.test.ts (41 tests | 1 failed) 225409ms
93   ✓ api-latency src/__tests__/feed-item.test.ts (9 tests) 20276ms
102  uncaught exception; source = Uncaught (in promise); stack = Error: Network connection lost.
106  ✓ api-latency src/__tests__/worker-entry.test.ts (5 tests) 663ms
114  ⎯⎯⎯ Failed Tests 1 ⎯⎯⎯
116  FAIL api-latency src/__tests__/import.test.ts > POST /import/markdown (real PostgreSQL through the proxy) > private deployment: the owner, CSRF, and cache headers > the owner's same-origin import succeeds and the response is private, no-store
117  Error: Test timed out in 120000ms.
130  Test Files  1 failed | 9 passed (10)
131       Tests  1 failed | 186 passed (187)
132    Start at  22:01:18
133    Duration  322.72s (transform 162ms, setup 21ms, import 947ms, tests 319.58s, environment 1ms)
```
The test line shows `× the owner's same-origin import succeeds and the response is private, no-store 207617ms`. The test is at `import.test.ts:177`.

- **120 s** is the per-test limit set by `--testTimeout=120000`. The words `Test timed out in 120000ms` repeat that configured value. They are not a measurement of how long the test ran.
- **207,617 ms** is the duration Vitest recorded for that test. The other 40 tests in that file took 17,792 ms (225,409 − 207,617), and the whole run took 322.72 s, so the 207 s really elapsed on the clock.
- **The 88 s between the two is unexplained.** Either the timer fired late (the event loop was stalled) or the limit fired at 120 s and Vitest took about 88 s more to finish tracking the test. The saved log cannot tell these apart. In both cases the limit did not stop the test promptly, which matters for the next point.
- **Final process outcome:** the log ends with the summary above. The process **exit code was not captured**, because the command was piped. Vitest normally exits 1 when a test fails.
- **Where `Network connection lost` appears:** line 102, after `feed-item` and before `worker-entry`, not beside the failing test.

### 1d. What cannot be concluded
The stall is **unexplained and recurrence is not ruled out.** The runs that passed (D, E, F) differ from run B in file set, timeout, and what ran earlier (the diagnostic test, which temporarily replaced `globalThis.fetch`, ran first in A and B only). I did not examine whether that matters. I did not investigate the cause.

---

## 2. Qualifying the explanation

**Supported conclusion (adopted verbatim):** *Added request-path latency reproduced the timeout, and the larger test allowance handled that condition. The cause of the slower GitHub executions has not been isolated.*

| Where | What I said | Replaced by |
|---|---|---|
| `helpers.ts` comment, todo.md, PR #3, earlier request | "only the latency varies" / "the latency moved" | A test's duration **tracked its number of database requests**, and the time per request was higher in the slow runs. Why was not isolated. |
| todo.md, PR #3, earlier request | "the runner was not slower at CPU work"; "runner CPU was not slower" | **No broad slowdown was seen in CPU-bound steps** (install, lint, build, typecheck, and the Markdown parser tests that use no database: 2.7-2.8 s in red runs against 2.0-3.5 s in green ones). CPU, container and runner contention, and application-path effects are **not excluded**. |
| todo.md, PR #3, earlier request | "the cost is a fixed round trip in the proxy" | Locally the feed query executes in 0.07 ms in PostgreSQL while a `select 1` through the proxy takes about 80 ms, so on a developer machine **the time is not query execution**. Where it goes (the proxy, its connection to PostgreSQL, Docker networking, the HTTP layer) is untested, and nothing was measured per request on GitHub. |
| todo.md, PR #3, earlier request | "116-256 ms per request" on GitHub | An **estimate** from dividing test durations by request counts, assuming proportionality. |
| todo.md, earlier request | "no lock waits were seen" | Not established: the database was not sampled during any run (see 1b). |
| earlier request, `helpers.ts` comment | "30 s still stops a test that is truly stuck" | **A Vitest timeout marks a test failed when it expires. It does not cancel or interrupt the operations the test started**, so it bounds how long a test is allowed and not how long it can run. Run B is an example: a 120 s limit and a 207 s test. |
| todo.md, earlier request | the stall "coincided with" `Network connection lost`, the message the original failures logged | **Withdrawn.** That message appears twice in **every** saved CI log, including all seven passing runs. Where a test header is nearby it is the output of `worker-entry.test.ts`, whose test deliberately targets an unreachable proxy port. I did not trace every occurrence, so I call it expected output and do not claim a single source. |
| todo.md, PR #3 | "both red runs were `push` and all green were `pull_request`" as the open alternative | Still true of the first six runs, but see section 3. |

---

## 3. New evidence, not planned: two slow runs that passed

Pushing the wording corrections started CI on the draft, and two `pull_request` runs were as slow as the failing `push` runs:

| Run | Suite | Four-seed feed test | Outcome |
|---|---|---|---|
| https://github.com/pauxiel/recallfeed/actions/runs/43716300137 (`eddd672`) | 131.7 s | 5,787 ms | success |
| https://github.com/pauxiel/recallfeed/actions/runs/43716681130 (`9c8ea25`) | 134.8 s | 6,583 ms | success |

Both are 28 files, 422 tests, 0 skipped, 0 failed, coverage 96.09 / 91.98 / 98.21 / 95.97. The four-seed test exceeded the old 5,000 ms default in both and passed under the 30 s allowance, so **the correction has now passed under slow GitHub conditions** and slowness is **not specific to `push` events**. Two runs in one time window are not a controlled comparison, and they do not say what made GitHub slow. The earlier follow-up run (https://github.com/pauxiel/recallfeed/actions/runs/43713049095, 91 s, 2.9 s) was fast. The run on `2408d55` itself is reported in my handoff message, since this file cannot cite the run of its own commit.

---

## 4. Integrity

At `40cc868c443693f09c5566631deb8ea7c7220034` (the two `helpers.ts` files are identical to those at `2408d55`):
```
c8a092df11808df8b8ee4e78176d470e0e35779ebd32ea5c3f14e910d917ce71  tasks/todo.md
4fd6277a24d0cb571efe9321d42daa8d33c7668594de1b4d8fb94c0c7d6871eb  packages/api/src/__tests__/helpers.ts
0bbafb11c6740ba53ddef180d300c429ca35620956abfc9c05aeb68fe6c655de  packages/feed-engine/src/__tests__/helpers.ts
```
Temporary files, outside the repository: `zz-timing-diagnostic.test.ts` `0a295d4d…8ebba`, plus the logs and shim named in section 1.

## Requested of Firstmate
A focused check that: (1) the stall evidence is stated fully and without implying more than it shows, (2) the qualified conclusion is carried through todo.md, the helper comments and the PR description, and (3) nothing outside comments, records and the PR text changed.

**Provide verdict:** APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES | BLOCK

**Read-only request.** Not merged. The next phase is not started.
