# RecallFeed Gate 1 Final Corrections

**Date:** November 7, 2026  
**Supervisor Brief:** Version 1.1  
**Status:** IN PROGRESS

---

## Correction Areas

### 1. Reconcile Markdown Contract ✅ STARTED

**Issues Found:**
- `03-connectors.md` line 67: Still references `source.transientContent`
- `03-connectors.md` line 76-88: Documents content via `credentials.content` (correct)
- Competing patterns in documentation
- Need to use `marked` tokenization, not just parsing
- Card-selection rules must be reusable, not demo-specific

**Required Actions:**
- [ ] Remove all `transientContent` references from 03-connectors.md
- [ ] Document marked tokenization usage (not just parsing)
- [ ] Define card-selection rules that don't mention ReflectionFeed/DevRecall
- [ ] Verify 04-feed-engine.md uses credentials.content pattern
- [ ] Remove transientContent from AUDIT-REPORT.md historical references

### 2. Repair Authentication Specification ❌ NOT STARTED

**Issues Found:**
- `05-authentication.md` lines 88-95: Uses `request.cf.access.getIdentity()` (undocumented pattern)
- `05-authentication.md` lines 126-140: References `c.get("access")` without defining how it gets there
- No documentation of middleware order
- No hosting topology diagram
- No cookie/session handling for Next.js SSR
- Missing acceptance cases for owner/non-owner/anonymous/missing-config

**Required Actions:**
- [ ] Replace with documented Cloudflare Workers Access API patterns
- [ ] Document await for getIdentity() per official API
- [ ] Define middleware order for Hono
- [ ] Add hosting topology section with diagram
- [ ] Document Next.js cookie forwarding requirements
- [ ] Add acceptance test cases for all auth scenarios
- [ ] Remove competing examples, keep single verified pattern

### 3. Repair Workflow Privacy and Retry Semantics ❌ NOT STARTED

**Issues Found:**
- `06-inngest-workflows.md` lines 358-364: Uses `error.message` and `error.code` (arbitrary content)
- `06-inngest-workflows.md` lines 317-365: Returns full notes in step results
- No allowlisted error codes/fields
- AI enrichment still has `insertFeedItem()` direct calls (vulnerable to retry issues)
- Missing independent retry-by-card-type design
- No handling of partial success (summary exists, reflection failed)

**Required Actions:**
- [ ] Define allowlisted error codes (e.g., MARKDOWN_TOO_LARGE)
- [ ] Replace error.message/error.code with safe mapped values
- [ ] Remove note.content from step results
- [ ] Document where private content is loaded vs persisted
- [ ] Make AI card creation conflict-safe with try/catch on unique constraint
- [ ] Handle partial enrichment (one card type exists, another doesn't)
- [ ] Don't swallow failures; surface them properly

### 4. Finish API Contract Coverage ⚠️ PARTIAL

**Issues Found:**
- `05-authentication.md` lines 250-390: Has 6 endpoints documented
- Missing: GET /cards/:id (single card read)
- POST /sources incomplete
- POST /sources/:id/import incomplete
- POST /api/inngest incomplete

**Required Actions:**
- [ ] Add GET /cards/:id with public/private filtering
- [ ] Complete POST /sources with full contract
- [ ] Complete POST /sources/:id/import with full contract
- [ ] Complete POST /api/inngest with Inngest SDK signature verification
- [ ] Do NOT create competing 05-api-contract.md file

### 5. Reconcile with Brief Version 1.1 ❌ NOT STARTED

**Issues Found:**
- Steering files don't mention monorepo is authoritative
- No documentation that standalone repos are optional exports
- Missing ESLint max-lines 1,000 physical line policy
- No note that .kiro/ artifacts must be committed

**Required Actions:**
- [ ] Update technology-decisions.md with monorepo as authoritative source
- [ ] Document standalone repos as optional versioned exports
- [ ] Add ESLint max-lines rule spec to project-conventions.md
- [ ] Note that cleaned .kiro/ specs will be committed (not authorization to commit now)
- [ ] Record 1,000 physical line ceiling with exclusions

### 6. Verify Custom Agent and Handoff Setup ⚠️ PARTIAL

**Evidence Found:**
- ✅ Agent loads: `kiro-cli agent list` shows recallfeed
- ✅ Agent uses "instructions" field (correct per Kiro v3.1.0)
- ❌ Hook configuration not verified
- ❌ Hook firing not tested
- ❌ No evidence of actual review delivery vs delivery receipt
- ❌ Automatic review processing not verified

**Required Actions:**
- [ ] Verify .kiro/hooks/ files exist and are valid
- [ ] Test hook actually fires on appropriate trigger
- [ ] Distinguish delivery receipt from supervisor processing
- [ ] Document handoff as one-way notification only
- [ ] Don't claim automatic review works without evidence

### 7. Correct Misleading Completion Claims ❌ NOT STARTED

**Issues Found:**
- CORRECTIONS-COMPLETE.md claims corrections done
- CORRECTIONS-EVIDENCE.md shows verification commands
- But specifications still have conflicting patterns
- Checklists mark items complete that aren't resolved

**Required Actions:**
- [ ] Update AUDIT-REPORT.md with actual current status
- [ ] Mark unresolved issues as NOT VERIFIED
- [ ] Remove claims about fixed transientContent (still present)
- [ ] Create honest issue-to-file-and-line mapping
- [ ] List remaining limitations clearly

---

## Verification Strategy

For each correction:
1. Identify exact file and line numbers
2. Show before/after state
3. Provide grep/search commands to verify
4. List remaining limitations honestly

---

## Progress Tracking

- [x] Read supervisor brief v1.1
- [x] Audit current specification state
- [x] Create correction plan
- [ ] Execute corrections 1-7
- [ ] Create immutable review request
- [ ] Submit via handoff (if working)
- [ ] Stop for supervisor review

---

## Next Actions

Start with Correction 1 (Markdown Contract Reconciliation)
