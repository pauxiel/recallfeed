# RecallFeed Gate 1 Specification Corrections — Review Request

**Date:** 2026-11-12  
**Phase:** Gate 1 (Specifications Only)  
**Review Type:** Follow-up after supervisor REQUEST CHANGES verdict  
**Previous Review:** 2026-11-12T23:43:05Z  

---

## Summary

All remaining specification corrections have been completed per supervisor review feedback. This submission addresses:

1. Workflow privacy and retry semantics (P1)
2. Authentication contract reconciliation (P1)
3. Markdown content-loss defect (P1)
4. Agent configuration field correction (P1)
5. Steering document updates per brief v1.1 (P2)

No application implementation has been performed. All work remains in Gate 1 (specifications only).

---

## Changes Made

### 1. Workflow Privacy and Retry Semantics (COMPLETE)

**File:** `.kiro/specs/06-inngest-workflows.md`

**Changes:**
- Lines 161-171: Replaced arbitrary error.message/error.code with allowlisted error codes only
- Allowlisted codes: MARKDOWN_TOO_LARGE, MARKDOWN_NO_CONTENT, NOTION_INVALID_CONFIG, NOTION_NO_API_KEY, NOTION_IMPORT_ERROR, CONNECTOR_NOT_FOUND, SOURCE_NOT_FOUND, AI_PROVIDER_UNAVAILABLE, AI_QUOTA_EXCEEDED, AI_TIMEOUT, AI_INVALID_RESPONSE, AI_ERROR, IMPORT_ERROR
- Lines 326-450: Split AI enrichment into independent per-card-type steps
- Each card type (summary, reflection_prompt) has separate conflict-safe step
- Private note content loaded inside steps via getNoteById(), not passed in step results
- Insert wrapped in try/catch; PostgreSQL constraint violation (code 23505) returns already_exists
- Results distinguish created, already_exists, failed, skipped for each card type
- Observable outcomes: summariesCreated, summariesExisted, promptsCreated, promptsExisted, failed
- Lines 570-595: Added comprehensive acceptance criteria for privacy, retry, and observable outcomes

**Verification:**
```bash
grep -n "allowlistedErrors\|allowlistedAIErrors" .kiro/specs/06-inngest-workflows.md
# Returns: Line 165 (import), lines 390, 422 (enrichment)

grep -n "enrich-summary\|enrich-prompt" .kiro/specs/06-inngest-workflows.md
# Returns: Independent steps for each card type
```

### 2. Authentication Contract Reconciliation (COMPLETE)

**File:** `.kiro/specs/05-authentication.md`

**Changes:**
- Lines 750-850: Removed obsolete "Method 1/Method 2" pattern and undocumented request.cf.access references
- Added complete "Hosting Topology and Cross-Origin Considerations" section
- Worker and frontend domain examples for both ReflectionFeed and DevRecall
- Next.js SSR cookie forwarding example with explicit CF_Authorization extraction
- CORS configuration for cross-origin scenarios
- SameSite cookie considerations documented
- Inngest webhook bypass topology with path-based Access policy example
- Lines 811-860: Comprehensive acceptance criteria covering authentication, authorization, cross-origin, Inngest, owner authorization, and error cases

**What remains consistent:**
- Lines 97-240: Correct ctx.access.getIdentity() pattern (async, returns Promise) with Worker → Hono identity injection

**Verification:**
```bash
grep -n "Method 1:\|Method 2:" .kiro/specs/05-authentication.md
# Returns: Only lines 97, 126 (documented patterns), no obsolete middleware examples

grep -n "Hosting Topology" .kiro/specs/05-authentication.md
# Returns: Section added at line 750

grep -n "Next.js Route Handler Example" .kiro/specs/05-authentication.md
# Returns: SSR cookie forwarding documented
```

### 3. Markdown Content-Loss Defect (COMPLETE)

**File:** `.kiro/specs/03-connectors.md`

**Changes:**
- Lines 162-235: Fixed extractCardsFromTokens() to initialize section for leading tokens
- Paragraph, blockquote, code, list handlers now check `if (!currentSection)` and initialize before processing
- Preserves leading quotes, code blocks, lists before first heading
- Removed fallback HTML generation via marked.parser() — all content uses consistent Markdown-like representation
- Lines 242-246: Updated error handling to note 100 KB cap requires CPU verification via benchmarks
- Lines 579-598: Updated acceptance criteria to include leading-content cases, heading-free notes, consistent representation, and deferred CPU verification

**Test cases covered in acceptance criteria:**
- Leading quotes followed by heading
- Leading code blocks followed by heading
- Leading lists followed by heading
- Heading-free notes
- Headings inside fenced code blocks
- Content representation consistency

**Verification:**
```bash
grep -n "if (!currentSection)" .kiro/specs/03-connectors.md
# Returns: Lines 188, 195, 202, 209 (all token handlers initialize section)

grep -c "marked.parser" .kiro/specs/03-connectors.md
# Returns: 0 (HTML fallback removed)
```

### 4. Agent Configuration Field Correction (COMPLETE)

**File:** `.kiro/agents/recallfeed.json`

**Changes:**
- Line 5: Changed `"instructions"` → `"prompt"` per Kiro CLI v3 documentation
- Simplified agent status description to reflect active correction work

**Verification:**
```bash
jq '.prompt' .kiro/agents/recallfeed.json | head -1
# Returns: "You are implementing RecallFeed..."

kiro-cli agent validate --path .kiro/agents/recallfeed.json
# Returns: exit 0
```

**Reference:** https://kiro.dev/docs/custom-agents/configuration-reference/#prompt-field

### 5. Steering Document Updates (COMPLETE)

**Files:** `.kiro/steering/project-conventions.md`, `.kiro/steering/technology-decisions.md`

**Changes:**

**project-conventions.md:**
- Added "Source File Length Policy" section
- ESLint max-lines rule: 1,000 physical lines maximum
- Counting includes blank lines and comments
- Exclusions: generated output, node_modules, lockfiles
- Scope: handwritten JS/TS only, not Markdown specs
- Enforcement: local lint and CI from first implementation milestone
- Configuration example and exception handling documented

**technology-decisions.md:**
- Added "Repository Organization and Distribution" section
- Monorepo documented as authoritative source
- Two applications in one repository satisfies Skeleton Crew requirement
- Standalone repos documented as optional exports, not MVP requirement
- .kiro artifacts commit policy clarified (requirement documented, authorization separate)

**Verification:**
```bash
grep -n "max-lines\|1,000 physical lines" .kiro/steering/project-conventions.md
# Returns: Section starting at added content

grep -n "Authoritative Monorepo\|Standalone Application Repositories" .kiro/steering/technology-decisions.md
# Returns: Section starting at added content
```

---

## Files Modified (with hashes)

```
f0585134dca5c209103a6ed1a22793804ff9de9812f90f47c7af9fa8881c2f50  .kiro/agents/recallfeed.json
832ff9ad5905dabbdece69f1b6d5b93bd77e7e8ad4ea670433899a824983f9e2  .kiro/steering/project-conventions.md
496c03861e602b9073380f4461a24f28fee36d9fdf424c66c70886d92db7cb29  .kiro/steering/technology-decisions.md
4883b5c2129680a276756ad84d4c5e483da4bfac6536ba2963876dc0af6fd7c0  .kiro/specs/03-connectors.md
d29d857af3c4f09721a825a82ee60ebf817a6f84764dcce0dfeb4b6987840487  .kiro/specs/05-authentication.md
6e91bd8644d4b68f2f0c719df11cb44f1f116f493d395d7932d8b8c4056a7b0d  .kiro/specs/06-inngest-workflows.md
```

**Files unchanged since last review:**
- `.kiro/specs/01-core-domain.md`
- `.kiro/specs/02-database-schema.md`
- `.kiro/specs/04-feed-engine.md`
- `.kiro/specs/07-ai-pipeline.md`
- `.kiro/specs/08-reflection-feed.md`
- `.kiro/specs/09-dev-recall.md`
- `.kiro/steering/skeleton-crew-rules.md`

---

## Verification Performed

### Agent Configuration
```bash
$ kiro-cli agent list | grep recallfeed
recallfeed      Workspace     RecallFeed project agent...
✓ PASS: Agent loads

$ kiro-cli agent validate --path .kiro/agents/recallfeed.json
✓ PASS: Exit code 0, validation successful

$ jq '.prompt | length' .kiro/agents/recallfeed.json
2819
✓ PASS: Prompt field exists and contains instructions
```

### Specification Content Verification
```bash
$ grep -c "allowlistedErrors\|allowlistedAIErrors" .kiro/specs/06-inngest-workflows.md
3
✓ PASS: Allowlisted error patterns present

$ grep -c "enrich-summary\|enrich-prompt" .kiro/specs/06-inngest-workflows.md
14
✓ PASS: Independent card-type steps present

$ grep -c "if (!currentSection)" .kiro/specs/03-connectors.md
4
✓ PASS: Leading content initialization present

$ grep -c "Hosting Topology" .kiro/specs/05-authentication.md
1
✓ PASS: Cross-origin topology documented

$ grep -c "max-lines" .kiro/steering/project-conventions.md
5
✓ PASS: ESLint policy documented

$ grep -c "Authoritative Monorepo" .kiro/steering/technology-decisions.md
1
✓ PASS: Monorepo policy documented
```

---

## Stated Limitations

### What Was Verified
1. Agent loads and validates successfully with "prompt" field
2. Workflow error codes are allowlisted
3. AI enrichment uses independent per-card-type steps
4. Markdown extraction initializes sections for leading content
5. Authentication has single coherent pattern with topology documented
6. Steering documents include v1.1 policies

### What Was NOT Verified (Deferred to Implementation)
1. Agent effective-prompt loading by Kiro CLI (agent discovery confirmed, prompt application not runtime-tested)
2. Hook firing on completion (hook files exist and validate, trigger not tested)
3. Supervisor unattended pickup (delivery mechanism exists, end-to-end flow not demonstrated)
4. PostgreSQL constraint violation handling under actual retry
5. ctx.access integration with Hono in deployed Worker
6. Next.js SSR cookie forwarding in cross-origin scenario
7. Inngest webhook reachability with Worker-level Access
8. Markdown CPU consumption within 10 ms free-tier budget
9. Leading-content preservation in actual marked tokenization

### What Remains Unresolved
- None within Gate 1 specifications scope
- Implementation verification deferred to separately authorized Gate 2

---

## Acceptance Criteria Status

### Workflow Privacy and Retry (06-inngest-workflows.md:570-595)
- [x] Allowlisted error codes defined and enforced
- [x] Step results contain no private note content or credentials
- [x] Note content loaded inside steps via getNoteById()
- [x] Independent conflict-safe steps per card type
- [x] Constraint violation returns already_exists
- [x] Observable outcomes distinguish created/existed/failed/skipped
- [ ] Runtime retry behavior (deferred to implementation)

### Authentication (05-authentication.md:811-860)
- [x] Worker entry point documented with ctx.access.getIdentity() (async)
- [x] Identity injection into Hono env documented
- [x] Hosting topology documented with domain examples
- [x] Next.js SSR cookie forwarding documented
- [x] CORS configuration documented
- [x] Inngest webhook bypass topology documented
- [x] Owner authorization specified
- [x] Error cases enumerated
- [ ] Deployed runtime behavior (deferred to implementation)

### Markdown Extraction (03-connectors.md:579-598)
- [x] marked.lexer() tokenization (from previous correction)
- [x] credentials.content pattern (from previous correction)
- [x] Leading content initialization for all token types
- [x] Consistent Markdown-like representation
- [x] Acceptance cases for leading/heading-free/code-in-heading scenarios
- [x] CPU verification requirement documented
- [ ] Actual content preservation with sample inputs (deferred to implementation)

### Agent and Steering
- [x] Agent uses "prompt" field per Kiro v3 docs
- [x] Agent validates successfully
- [x] ESLint max-lines policy documented
- [x] Monorepo as authoritative source documented
- [x] Standalone repos documented as optional exports
- [ ] Agent effective-prompt loading (discovery confirmed, application not tested)

---

## Recommendation

**Request:** APPROVE FOR GATE 2 or REQUEST ADDITIONAL CHANGES

**Rationale:**
- All P1 specification issues identified in supervisor review have been addressed in actual files
- Workflow privacy uses allowlisted codes, loads content in-step, provides independent conflict-safe completion
- Authentication has single coherent documented pattern with topology and cross-origin handling
- Markdown extraction preserves leading content with consistent representation
- Agent configuration uses documented field
- Steering includes v1.1 policies

**Blocking Issues:** None within Gate 1 specifications scope

**Implementation Dependencies:** Verification of deployed behavior, constraint violation handling, hook firing, and CPU measurements deferred to separately authorized Gate 2

---

## Next Steps if Approved

1. User authorizes Gate 2 (Foundation Implementation)
2. Kiro implements shared packages (core, database, connectors)
3. Runtime verification of patterns specified here
4. Benchmark Markdown parsing for CPU budget confirmation
5. Test constraint-violation retry behavior
6. Stop at Gate 2 review boundary

**This request does not authorize application implementation, commit, deployment, or publication. Those require separate user approval after specification review.**

---

**Prepared by:** Kiro (RecallFeed custom agent)  
**For Review By:** Supervisor (Astra via Firstmate)  
**Handoff Method:** One-way notification hook (if working) or manual delivery

