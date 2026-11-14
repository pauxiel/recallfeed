# Phase 2 Proposal (for approval; nothing here has been started)

Prepared 2026-11-14 after the Phase 1 review (`firstmate/data/recallfeed/reviews/2026-11-14T145842Z-phase1.md`). Phase 2 is Tasks 8-21 in `tasks/todo.md`. This document covers only the prerequisites that review asked for: the isolated test database, the permissions it needs, compatible tool versions, and the root license. It does not authorize or begin any Phase 2 work.

## 1. Isolated test database (settles Task 10's transport)

**Decided 2026-11-14: Option A, implemented and verified in `packages/database` (see `tasks/todo.md`, "Phase 2 database spike evidence" and the correction pass). Option B was not used and no cloud resource exists.**

An ordinary local PostgreSQL URL does not work with `@neondatabase/serverless`'s HTTP client, which speaks Neon's own HTTP protocol. Two paths do.

**Option A (recommended): local PostgreSQL 17 behind a local Neon HTTP proxy.**
Docker Compose runs `postgres:17` and `ghcr.io/timowilhelm/local-neon-http-proxy` on `localhost` (ports 5432 and 4444). This is the setup Neon's own guide documents for local development ([Local development with Neon](https://neon.com/guides/local-development-with-neon)). It needs no cloud account, no credentials, and no cost, and it fits the project convention that tests do not depend on live external services.

- Caveats: the proxy is a community project (TimoWilhelm), so pin its image by digest, not `:main`. Its URLs use `*.localtest.me`, which resolves through public DNS, so offline work needs a hosts entry for `db.localtest.me`. Parity with real Neon is approximate.
- Not verified: Docker is not installed on this machine, so I could not run the proxy against `@neondatabase/serverless` 1.2.1. The first Phase 2 step would be a short spike proving one HTTP query and one WebSocket transaction before Task 10 relies on it.

**Option B: a dedicated Neon test project with throwaway branches.**
Real Neon behavior, no Docker. Neon's Free plan (per [neon.com FAQ](https://neon.com/faqs/free-plan-limits-and-quotas), checked Nov 2026) allows 100 projects, 10 branches per project, and 100 CU-hours per project per month. It needs you to create the account and project and give me a connection string for a test-only database, which creates cloud resources and a credential that must stay out of Git.

**Safety rules for either option (build into the test harness):**
- Integration tests read `TEST_DATABASE_URL`, never `DATABASE_URL`, and run through a separate `test:integration` script so `pnpm test` stays free of external services.
- The harness refuses to run unless the host is local (`localhost`, `127.0.0.1`, `db.localtest.me`) or the branch name starts with `test/`.
- The connection string lives in a git-ignored `.dev.vars` or `.env` file. Nothing is committed.

## 2. Permissions needed

| Item | Option A | Option B |
|---|---|---|
| Install a container runtime (Docker Desktop, OrbStack, or Colima; none is installed) | Yes, your choice of tool | No |
| Pull images from Docker Hub and `ghcr.io` | Yes | No |
| Bind local ports 5432 and 4444 (both free today) | Yes | No |
| Neon account, project, and test connection string | No | Yes |
| New dev dependencies: `@neondatabase/serverless`, `ws` (Node transactions), later `hono`, `marked` | Yes | Yes |
| Cloud provisioning, deployment, or publishing | No | Creates the Neon project only |

Credentials found on this machine today: none (no `DATABASE_URL`, Neon, or Cloudflare variables or config directories).

## 3. Compatible tool versions (registry lookups 2026-11-14)

| Tool | Proposed | Basis |
|---|---|---|
| Node | `^22.13.0 \|\| >=24.0.0` (tested 22.23.3 and 24.22.2) | unchanged from the Phase 1 correction |
| `@neondatabase/serverless` | 1.2.1 | `engines.node >=19`; major version 1, so confirm the API at Task 8 |
| `hono` | 4.13.18 | `engines.node >=16.9`, runs on Workers |
| `wrangler` (direct) | 4.162.0, exact | `@cloudflare/vitest-plugin@1.8.2` already pins exactly 4.162.0, so one copy is installed; `@opennextjs/cloudflare@1.20.17` declares `wrangler ^4.148.0`, which 4.162.0 satisfies |
| `marked` | 18.2.0 | not yet checked that `marked.lexer` (named in Task 15) exists unchanged in v18; check at Task 15 |
| `vitest`, plugin, TypeScript, ESLint | unchanged (4.1.12, 1.8.2, 5.9.3, 10.15.0) | Phase 1 lockfile |
| PostgreSQL image | `postgres:17`, digest-pinned | version used in Neon's guide |

**Decided 2026-11-14:** the planned direct Wrangler pin is 4.162.0, recorded in `tasks/todo.md` (Task 17), `tasks/plan.md`, and the agent config. OpenNext, Next.js, and deployment compatibility are not tested by this pin and belong to Gate 3.

## 4. Review items still to apply to the plan text on approval

These are edits to `tasks/todo.md` and `tasks/plan.md`, not code. I have not made them yet.
1. Task 10: replace "compatible local setup" with the chosen option above.
2. Task 27: replace the removed importance-score reference; the cursor must encode the real sort key plus `id` as the tie-break.
3. Keep Task 20 and Task 21 labeled as the basic feed; do not claim the full Spec 05 contract at the Phase 2 checkpoint, and note the API-key curl examples need an explicitly public local configuration.
4. Phase 3 order: 24, then 22, then 23, with review after the whole phase.
5. Reword the `IFeedEngine.importMarkdown` JSDoc: the 100 KB limit does not by itself guarantee the CPU budget; benchmark first.

## 5. Root license (decided 2026-11-14)

Decided by the user: standard MIT License, `Copyright (c) 2026 pauxiel`. Implemented in the root `LICENSE` and a `"license": "MIT"` field in the root and `@recallfeed/core` manifests. Third-party material keeps its own notice: `.kiro/skills/LICENSE-agent-skills` is Addy Osmani's original MIT license, byte for byte, and `.kiro/skills/README.md` records which upstream commit each skill copy matches.

Contest context comes from Firstmate's verified 2026 rules check (`firstmate/data/recallfeed/kiroween-2026-rules-check.md`): a public repository with a detectable open-source license file, a root `.kiro` directory, and disclosure of incorporated pre-existing work. This replaces the earlier "unverified" note, which was based on a failed fetch. The repository stays private until public visibility is approved separately.

Installed-dependency licenses (220 packages, checked 2026-11-14): 166 MIT, 20 Apache-2.0, 11 ISC, 11 BSD, 4 dual MIT/Apache, 3 BlueOak, plus `lightningcss` (MPL-2.0), `@img/sharp-libvips-darwin-arm64` (LGPL-3.0-or-later), and `caniuse-lite` (CC-BY-4.0). None is copied into this repository.

## 6. Decisions requested

*Status 2026-11-14: decisions 1 (Option A, with Colima), 4 (MIT, `Copyright (c) 2026 pauxiel`) and 5 in part are made. Decisions 2 (Wrangler 4.162.0) and 3 (plan-text edits) remain open, and Tasks 11-21 are not authorized.*

1. Option A or B for the test database (and, for A, which container runtime to install).
2. Wrangler 4.162.0 as the direct pin.
3. Approve the plan-text edits in section 4.
4. The license and copyright holder in section 5.
5. Phase 2 start, separately and explicitly.
