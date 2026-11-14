# RecallFeed Implementation Plan — Gate 2 (Revised)

**Status:** Planning revision complete, awaiting user approval  
**Based on:** Gate 1 approved specifications (cycle 10) + planning review feedback  
**Scope:** Foundation with early working path, real authorization, PostgreSQL verification  
**Out of scope:** AI enrichment, Notion connector, Inngest workflows, demo applications (Gates 3-4)

---

## Overview

This plan implements the RecallFeed foundation from approved Gate 1 specifications, organized as small functional slices that can be independently verified. We prioritize an early working path: minimal bootstrap → Markdown import with real authorization → PostgreSQL persistence → deterministic card generation → API response. Each slice delivers testable functionality before expanding horizontally.

The plan addresses planning review feedback:
- **Functional slices**, not layer-by-layer: Early Markdown-to-API path with real authorization
- **PostgreSQL verification**: Database checks use local PostgreSQL or authorized Neon test instance
- **Approved contracts only**: Tasks reconciled against Specs 01-09, no invented requirements
- **Native skill installation**: Proper Kiro `.kiro/skills/<name>/SKILL.md` structure with discovery
- **Explicit state tracking**: Each task records implemented, verified, reviewed with evidence

---

## Architecture Decisions

### Technology Stack (from approved specs)

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Cloudflare Workers | Free tier compatible, no cold starts |
| HTTP Framework | Hono | Purpose-built for edge, minimal footprint |
| Database | Neon PostgreSQL | Serverless, HTTP+WebSocket, Workers-compatible |
| Database Client | `@neondatabase/serverless` | Raw SQL, no ORM overhead |
| Monorepo | pnpm + Turborepo | Fast, deterministic, workspace protocol support |
| Testing | Vitest + `@cloudflare/vitest-pool-workers` | Runs in actual Workers runtime |
| Type checking | TypeScript strict mode | Catch errors before runtime |

### Package Structure (Skeleton Crew requirement)

```
packages/
├── core/          → Domain types, interfaces (zero runtime dependencies)
├── database/      → Neon client, queries, migrations
├── connectors/    → Markdown parser (Notion deferred to Gate 4)
├── feed-engine/   → Resurfacing strategies, card generation
└── api/           → Hono Worker, routes, middleware
```

### Implementation Order

1. **Foundation first:** Core types → Database schema → Basic queries
2. **Deterministic path:** Markdown connector → Note persistence → Feed generation
3. **Horizontal expansion:** Additional connectors, AI, Inngest (Gate 4)
4. **Demo applications last:** After foundation verified (Gate 3)

### Key Design Constraints

- **Fail-closed security:** Default `FEED_VISIBILITY=private`, explicit opt-in to public
- **No credentials in browser:** API keys server-side only
- **Skeleton Crew discipline:** Shared packages know nothing about ReflectionFeed or DevRecall
- **Cloudflare Workers limits:** 10ms CPU on free tier, async AI only
- **Test-driven:** Every feature has tests before merging

---

## Dependency Graph

```
Git init + ESLint setup
    │
    ├── TypeScript + Vitest foundation
    │       │
    │       ├── Core types (Source, Note, FeedItem)
    │       │       │
    │       │       ├── Database client + migrations
    │       │       │       │
    │       │       │       ├── Basic queries (sources, notes, feed_items)
    │       │       │       │       │
    │       │       │       │       ├── Markdown parser
    │       │       │       │       │       │
    │       │       │       │       │       ├── Visibility middleware + auth guards
    │       │       │       │       │       │       │
    │       │       │       │       │       │       ├── SLICE 1: Protected Markdown import → PostgreSQL → Response
    │       │       │       │       │       │       │       [Early working path with real authorization]
    │       │       │       │       │       │       │
    │       │       │       │       │       │       ├── SLICE 2: Card generation + deterministic feed
    │       │       │       │       │       │       │
    │       │       │       │       │       │       ├── SLICE 3: Review/publish mutations
    │       │       │       │       │       │       │
    │       │       │       │       │       │       └── SLICE 4: Additional strategies + pagination
    │       │       │       │
    │       │       │       └── PostgreSQL test setup
    │       │
    │       └── Native Kiro skill installation
```

**Implementation follows small functional slices:** Bootstrap → Early protected path → Expand features

---

## Task List

Tasks recorded in `tasks/todo.md` following revised functional-slice strategy.

### Phase 1: Bootstrap & Foundation (Tasks 1-7)

Establish Git, linting, TypeScript, tests, and core types. Verify toolchain before feature work.

**Tasks:**
- Task 1: Initialize Git repository, stage existing specs/planning, verify no secrets/private data
- Task 2: Configure ESLint with max-lines rule (1000 physical lines for all handwritten JS/TS including tests)
- Task 3: Initialize pnpm workspace with Turborepo
- Task 4: Configure TypeScript strict mode and create root tsconfig.json
- Task 5: Set up Vitest with Workers runtime pool and create smoke test
- Task 6: Verify Kiro skills installation (already complete, document evidence)
- Task 7: Create `@recallfeed/core` with domain types (zero runtime deps, no Zod)

**Checkpoint:** Bootstrap complete with working toolchain verified, ready for functional slices

### Phase 2: Early Working Path - Protected Markdown Import (Tasks 8-21)

**Slice 1:** Minimal Markdown import with real authorization → PostgreSQL → deterministic card → feed response

**Tasks:**
- Task 8: Create `@recallfeed/database` with Neon client (request-scoped factory, HTTP connection)
- Task 9: Write forward-only migration 001 (sources, notes, feed_items, review_events per Spec 02)
- Task 10: Set up PostgreSQL test transport (local PostgreSQL or documented Neon HTTP test config)
- Task 11: Implement source queries (upsert, getById)
- Task 12: Implement note queries (upsert by source-scoped contentHash, getBySource)
- Task 13: Implement feed_item queries (insert, getCandidates with isPublished filter)
- Task 14: Create `@recallfeed/connectors` with IConnector interface (`import(source, credentials)` per Spec 01/03)
- Task 15: Implement Markdown connector (parses text/markdown, returns NormalizedNote[])
- Task 16: Create `@recallfeed/feed-engine` with FeedEngine class and original card generator
- Task 17: Create `@recallfeed/api` with Hono app, visibility middleware, and minimal Worker entry
- Task 18: Implement real authorization guards (requireOwner, requireApiKey) plus Origin/CSRF and Cache-Control headers
- Task 19: Implement POST /import/markdown (Spec 05 contract: sourceId, queued, notesImported, feedItemsCreated)
- Task 20: Implement GET /feed with owner authorization and isPublished filtering (basic, pagination in Phase 4)
- Task 21: Implement GET /feed/:id with owner authorization and public DTO omissions (Spec 05)

**Checkpoint:** Complete protected path works end-to-end: POST /import/markdown → PostgreSQL → original cards → GET /feed, negative auth tests pass, CSRF/cache protection verified

### Phase 3: Review & Publish Mutations (Tasks 22-24)

**Slice 2:** Review/publish state management per Spec 05 approved contract

**Tasks:**
- Task 22: Implement PUT /feed/:id/review (all 6 actions per Spec 05, requires review_events queries from Task 24)
- Task 23: Write integration tests for all review actions with state transitions and invalid-action tests
- Task 24: Implement review_events queries (provides insertReviewEvent for Task 22)

**Note:** Task 24 dependency corrected - it must come before Task 22 uses its queries

**Checkpoint:** All Spec 05 review/publish actions work, invalid actions rejected

### Phase 4: Expanded Features (Tasks 25-28)

**Slice 3:** Additional resurfacing strategies, pagination, card types

**Tasks:**
- Task 25: Implement recency resurfacing strategy (oldest effective reviewed time first per Spec 04)
- Task 26: Implement importance resurfacing strategy (lower reviewCount first, filter snoozed per Spec 04)
- Task 27: Implement strategy-dependent pagination cursors (sortKey + id per Spec 04)
- Task 28: Implement highlight card generator

**Checkpoint:** Multiple strategies work, pagination handles strategy-specific sort keys

### Phase 5: Source Management (Tasks 29-30)

**Slice 4:** Source CRUD (CSRF protection moved to Task 18, Phase 2)

**Tasks:**
- Task 29: Implement POST /sources (Notion source creation per Spec 05)
- Task 30: Implement POST /sources/:id/import stub (returns 501 until Notion connector in Gate 4)

**Checkpoint:** All foundation features complete, ready for demo apps (Gate 3)

**Note:** Task 31 (CSRF/cache) consolidated into Task 18 earlier in the plan

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PostgreSQL integration untested until Task 10 | High | Set up test database early in Phase 2; verify schema compatibility |
| Authorization logic bypassed by placeholders | Critical | Implement real guards before protected endpoints; negative auth tests required |
| Contracts drift from approved specs | High | Every task cross-referenced to spec sections; no invented requirements |
| Functional slices blocked by missing dependencies | Medium | Bootstrap phase establishes all foundations; slices are self-contained after Task 7 |
| Worker runtime differences from local tests | Medium | Use `@cloudflare/vitest-pool-workers` for actual runtime; defer deployment to user approval |
| Task state tracking ambiguous | Low | Explicit "Implemented / Verified / Reviewed" sections per task in todo.md |

---

## Open Questions

_None at this stage — all architectural decisions resolved in Gate 1._

---

## Verification Strategy

Each task follows the Incremental Implementation discipline:

1. **Implement** the smallest complete piece
2. **Test** with the repository's test command
3. **Verify** tests pass, build succeeds, types check
4. **Commit** with atomic, descriptive message
5. **Move to next slice**

### Repository Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm build                # Build all packages
pnpm test                 # Run all tests
pnpm lint                 # Lint all packages
pnpm typecheck            # Check TypeScript types

# Per-package
pnpm --filter @recallfeed/core test
pnpm --filter @recallfeed/database build
```

### Success Criteria (Gate 2 Acceptance)

- [ ] All packages build without errors
- [ ] All tests pass (target: 80%+ coverage for core/database/feed-engine)
- [ ] TypeScript strict mode enabled, core package has zero runtime dependencies
- [ ] **Early protected path verified:** POST /import/markdown with real authorization → PostgreSQL → GET /feed response
- [ ] **Authorization enforced:** Negative tests prove non-owners/missing keys rejected before logic
- [ ] `isPublished` filtering verified with PostgreSQL queries
- [ ] Review and publish mutations work with state transitions
- [ ] No credentials in code or logs
- [ ] Migrations run forward-only (per Spec 02, no down migrations)
- [ ] **PostgreSQL integration checks pass** (not SQLite mocks)
- [ ] **Kiro skills properly installed** (`.kiro/skills/<name>/SKILL.md` structure with discovery evidence)
- [ ] Code follows project conventions (max-lines ESLint enforced on handwritten JS/TS)
- [ ] All functions have JSDoc comments
- [ ] Git repository initialized with clean history
- [ ] **Each task tracks:** Implemented (with commit ref) / Verified (with command output) / Reviewed (independent check)

---

## Out of Scope (Deferred to Later Gates)

**Gate 3 — Demo Applications:**
- ReflectionFeed (Next.js + Cloudflare Access)
- DevRecall (React + Vite + API keys)

**Gate 4 — Optional Features:**
- Notion connector (`@recallfeed/connectors/notion`)
- AI enrichment pipeline (`@recallfeed/ai`)
- Inngest workflows (async processing)
- Reflection prompt generation

**Gate 5 — Launch Readiness:**
- Documentation polish
- Hackathon submission materials
- Performance optimization
- Optional standalone repos

---

## Execution Discipline

### Workflow: Define → Plan → Build → Verify → Review → Ship

1. **This plan** = Define + Plan phases (complete, awaiting approval)
2. **Build** = Implement 30 tasks incrementally
3. **Verify** = Run tests after every increment, checkpoint after every phase
4. **Review** = Submit Gate 2 completion request with hashes and evidence
5. **Ship** = Deploy foundation after user approval

### Task Update Protocol

After completing each task:
- [ ] Update `tasks/todo.md` with checkmarks and verification results
- [ ] Record actual commands run and their output
- [ ] Note any blockers or deviations from plan
- [ ] Commit atomically with descriptive message

### Stopping Conditions

**Stop and ask before:**
- Advancing to next phase without completing checkpoint
- Making architectural decisions not covered in specs
- Adding dependencies beyond approved stack
- Implementing features explicitly deferred to later gates

**Never:**
- Mark work complete solely because code exists
- Skip tests to move faster
- Implement multiple tasks in one commit
- Deploy without user approval

---

## Source Evidence

**Planning skills used:**
- `.kiro/skills/planning-and-task-breakdown/SKILL.md` (Addy Osmani, MIT license, https://github.com/addyosmani/agent-skills)
- `.kiro/skills/incremental-implementation/SKILL.md` (Addy Osmani, MIT license, https://github.com/addyosmani/agent-skills)
- `.kiro/skills/spec-driven-development/SKILL.md` (Addy Osmani, consulted for phase boundaries)

**Native skill setup complete:** See `.kiro/skills/DISCOVERY-EVIDENCE.md` for verification

**Approved specifications:**
- `.kiro/specs/01-core-domain.md` (domain types)
- `.kiro/specs/02-database-schema.md` (schema and migrations)
- `.kiro/specs/03-connectors.md` (Markdown parsing)
- `.kiro/specs/04-feed-engine.md` (resurfacing strategies, API routes)
- `.kiro/specs/05-authentication.md` (authorization middleware, full API contracts)
- `.kiro/steering/technology-decisions.md` (stack constraints)
- `.kiro/steering/skeleton-crew-rules.md` (boundary discipline)

**Governed by:** User's supervisor master brief and Gate 1 approval boundaries

**Dependencies verified:**
- OpenNext ^1.20.0 + Wrangler ^4.148.0 + Next.js ^15.5.29 (compatible per Gate 1 cycle 10)
- All other dependencies follow approved specs

---

## Next Steps

1. **User review** this corrected plan
2. **User approval** to proceed with Phase 1 implementation (tasks 1-7)
3. **Implement** Phase 1 with stop for review after Task 7
4. **Verify** Phase 1 checkpoint
5. **Continue** to Phase 2 only after Phase 1 independently reviewed

**Authorization boundary:** This plan requires user approval before any implementation begins. No packages will be scaffolded, no dependencies installed, no code written until explicit "proceed with Phase 1" instruction. Phase-by-phase advancement requires explicit approval at each checkpoint, not blanket authorization for all of Gate 2.

**Checkpoint review:** Human review at each phase boundary (not task-by-task). Implemented/Verified/Reviewed tracking within each task distinguishes code existence from passing tests from independent verification.

