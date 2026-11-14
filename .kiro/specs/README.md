# RecallFeed Specifications

**Status:** All specifications "Awaiting review" — Implementation blocked

---

## Specification Files

| Spec | Title | File | Status | Notes |
|---|---|---|---|---|
| **01** | Core Domain Types | `01-core-domain.md` | Awaiting review | Updated with `transientContent` |
| **02** | Database Schema | `02-database-schema.md` | Awaiting review | Needs `is_placeholder` column decision |
| **03** | Connectors | ~~Two files~~ | ⚠️ DUPLICATE | `03-connector-interface.md` + `03-connectors.md` |
| **04** | Feed Engine | `04-feed-engine.md` | Awaiting review | Needs placeholder card solution |
| **05** | API & Auth | ~~Two files~~ | ⚠️ DUPLICATE | `05-api-contract.md` + `05-authentication.md` |
| **06** | Inngest Workflows | `06-inngest-workflows.md` | Awaiting review | Credentials fixed |
| **07** | AI Pipeline | `07-ai-pipeline.md` | Awaiting review | - |
| **08** | ReflectionFeed | ~~Two files~~ | ⚠️ DUPLICATE | `08-reflection-feed-app.md` + `08-reflection-feed.md` |
| **09** | DevRecall | ~~Two files~~ | ⚠️ DUPLICATE | `09-dev-recall-app.md` + `09-dev-recall.md` |

---

## Current Issues (See FINAL-ISSUES.md)

### Blockers (Must Resolve Before Implementation)

1. **Duplicate specifications** — Four spec numbers have conflicting files
2. **Markdown import API contract** — POST /import/markdown endpoint undocumented
3. **Access identity propagation** — Mechanism for Hono context injection unverified
4. **Placeholder AI cards** — Current pattern blocks enrichment; needs redesign

### Documented Uncertainties (Mark for Verification)

5. **Cloudflare Access + Hono** — Three possible approaches documented, none verified
6. **Next.js cookie forwarding** — `SameSite` and adapter requirements need testing
7. **Performance: N+1 queries** — Documented as known issue for MVP
8. **Migration concurrency** — Documented as known issue; needs advisory locks

---

## Files

### Primary Specifications
- `01-core-domain.md` — Domain types and interfaces ✅ Updated
- `02-database-schema.md` — PostgreSQL schema and migrations ⚠️ Needs column decision
- `03-connectors.md` — Connector implementations (NEWER) ✅ Updated
- `03-connector-interface.md` — Original connector spec (SUPERSEDED) ⚠️ To be merged and deleted
- `04-feed-engine.md` — Feed generation and import orchestration ⚠️ Needs placeholder solution
- `05-authentication.md` — Auth middleware and access control (NEWER) ✅ Updated
- `05-api-contract.md` — API endpoints (SUPERSEDED) ⚠️ To be merged and deleted
- `06-inngest-workflows.md` — Async workflows ✅ Updated
- `07-ai-pipeline.md` — AI enrichment pipeline
- `08-reflection-feed.md` — Private Next.js demo (NEWER) ✅ Updated
- `08-reflection-feed-app.md` — Original app spec (SUPERSEDED) ⚠️ To be merged and deleted
- `09-dev-recall.md` — Public React demo (NEWER) ✅ Updated
- `09-dev-recall-app.md` — Original app spec (SUPERSEDED) ⚠️ To be merged and deleted

### Meta Documents
- `AUDIT-REPORT.md` — Initial audit findings (claims corrected)
- `ISSUES-CHECKLIST.md` — Detailed issue breakdown
- `FINAL-ISSUES.md` — **Concise issue-to-file-and-line checklist** ⭐
- `README.md` — This file

---

## Next Steps (Specifications Only)

1. **Merge duplicates:**
   - Combine 03-connector-interface + 03-connectors → single `03-connectors.md`
   - Combine 05-api-contract + 05-authentication → single `05-api-authentication.md`
   - Combine 08-reflection-feed-app + 08-reflection-feed → single `08-reflection-feed.md`
   - Combine 09-dev-recall-app + 09-dev-recall → single `09-dev-recall.md`
   - Delete superseded originals

2. **Resolve placeholder card blocker:**
   - Choose Option A (no AI cards at import) OR Option B (is_placeholder column)
   - Update Specs 02, 04, 06 accordingly

3. **Add Markdown import API spec:**
   - Document POST /import/markdown endpoint in merged Spec 05
   - Include transientContent population flow

4. **Document Access uncertainty:**
   - Mark Access identity propagation for verification before implementation
   - Note that three approaches are hypothetical, none proven

5. **Add Known Issues sections:**
   - Spec 02: Migration concurrency
   - Spec 04: N+1 queries, cursor instability

---

## Implementation Status

❌ **BLOCKED** — All specifications remain "Awaiting review"

Implementation cannot begin until:
- Duplicate specs reconciled into single authoritative versions
- Placeholder card pattern resolved
- Markdown import API contract documented
- Access identity propagation mechanism verified or documented as requiring test deployment

---

**Last Updated:** November 7, 2026
