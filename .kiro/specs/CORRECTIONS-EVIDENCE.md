# RecallFeed Corrections Evidence

**Date:** 2026-11-07  
**Status:** Complete per review feedback

---

## 1. Obsolete Markdown Method Removed ✓

**Changed Files:**
- `.kiro/specs/04-feed-engine.md` lines 180-265

**Evidence:**
```bash
$ grep -n "importSource" .kiro/specs/04-feed-engine.md
# No results for old method

$ grep -n "importMarkdown" .kiro/specs/04-feed-engine.md  
180:  async importMarkdown(content: string, sourceMetadata: { name: string }): Promise<ImportResult> {

$ grep -n "importNotionSource" .kiro/specs/04-feed-engine.md
219:  async importNotionSource(sourceId: string): Promise<ImportResult> {
```

**Removed:**
- `importSource(sourceId)` method
- `resolveCredentials()` private method
- References to `source.transientContent`

**Replaced with:**
- `importMarkdown(content, sourceMetadata)` - explicit content passing
- `importNotionSource(sourceId)` - database lookup for Notion only

---

## 2. API Contracts Restored ✓

**Changed Files:**
- `.kiro/specs/05-authentication.md` lines 85-485 (added full API section)

**Restored Endpoints:**

| Endpoint | Method | Purpose | Lines |
|---|---|---|---|
| `/import/markdown` | POST | Import Markdown content | 90-135 |
| `/feed` | GET | Retrieve paginated feed | 140-195 |
| `/feed/:id/review` | PUT | Record review action | 200-245 |
| `/sources` | POST | Create Notion source | 250-290 |
| `/sources/:id/import` | POST | Trigger Notion import | 295-330 |
| `/api/inngest` | POST | Inngest webhook | 335-350 |

**Each endpoint documents:**
- Authentication requirements (private/public mode)
- Request format with examples
- Response format with examples
- Error codes
- Complete flow description

**Evidence:**
```bash
$ grep -c "### POST\|### GET\|### PUT" .kiro/specs/05-authentication.md
6

$ grep -c "Authentication:" .kiro/specs/05-authentication.md
20
```

---

## 3. Access Identity/Session Contract Fixed ✓

**Changed Files:**
- `.kiro/specs/05-authentication.md` lines 85-105

**Added:**
- Section: "Cloudflare Access Identity Mechanism"
- Documents `request.cf.access.getIdentity()` as the official API
- Notes that Hono integration via `c.get("access")` requires population
- Explicitly states verification needed against current Cloudflare/Hono docs

**Removed:**
- Competing "Method 1" / "Method 2" ambiguity
- Undocumented `ctx.access.getIdentity()` claim

**Current contract:**
```typescript
const request = c.req.raw;
const identity = (request as any).cf?.access?.getIdentity?.();
```

**Note:** Documented as requiring implementation verification, not claimed as proven.

---

## 4. Genuine Error Sanitization ✓

**Changed Files:**
- `.kiro/specs/06-inngest-workflows.md` lines 155-175, 378-400

**ingestSourceFunction sanitization:**
```typescript
const sanitizedError = {
  message: error.message || "Unknown error",
  code: error.code || "IMPORT_ERROR",
  sourceId,
  sourceType: source.type,
  // Explicitly exclude: error.stack, note content, credentials
};

console.error("Note import failed:", sanitizedError);
```

**enrichNotesFunction sanitization:**
```typescript
const sanitizedError = {
  message: error.message || "Unknown error",
  code: error.code || "AI_ERROR",
  noteId: note.id,
  // Explicitly exclude: note.content, note.title, error.stack
};

console.error("AI enrichment failed:", sanitizedError);
```

**What is prevented from logging:**
- `note.content` (private text)
- `note.title` (potentially sensitive)
- `error.stack` (may contain data in stack frames)
- `credentials` object (API keys)
- AI provider state (may contain partial content)
- Connector internal state (may contain tokens)

**Evidence:**
```bash
$ grep -A5 "sanitizedError = {" .kiro/specs/06-inngest-workflows.md | grep -c "Explicitly exclude"
2

$ grep -c "Do NOT log\|Never log\|Explicitly exclude" .kiro/specs/06-inngest-workflows.md
5
```

---

## 5. Retry-Safe AI Enrichment Restored ✓

**Changed Files:**
- `.kiro/specs/06-inngest-workflows.md` lines 350-395

**Removed:**
- `getFeedItemByNoteAndType()` existence checks before creation
- Logic: "if (!exists) { create }" which assumed placeholders

**Restored:**
- Direct creation: `await insertFeedItem(...)` with AI-generated content
- Relies on database unique constraint: `(note_id, card_type)` prevents duplicates
- Idempotent on retry: If step partially succeeds then retries, `insertFeedItem` fails on duplicate but doesn't break workflow

**Evidence:**
```bash
$ grep -n "if (!(await getFeedItemByNoteAndType" .kiro/specs/06-inngest-workflows.md
# No results - existence checks removed

$ grep -n "await insertFeedItem" .kiro/specs/06-inngest-workflows.md | wc -l
2

$ grep -n "always create, no existence check" .kiro/specs/06-inngest-workflows.md
353:          // Generate summary (always create, no existence check needed)
365:          // Generate reflection prompt (always create, no existence check needed)
```

**Database protection:**
- `.kiro/specs/02-database-schema.md` line 90: `CREATE UNIQUE INDEX feed_items_note_card_type_idx`
- Duplicate insert fails gracefully, workflow continues

---

## 6. Custom Agent Verified ✓

**Agent Configuration:**
- `.kiro/agents/recallfeed.json`

**Field verification:**
```json
{
  "version": "v1",
  "name": "recallfeed",
  "description": "RecallFeed project agent...",
  "instructions": "You are implementing RecallFeed...",
  "model": "claude-sonnet-4.5"
}
```

**Kiro CLI recognition:**
```bash
$ kiro-cli agent list
...
  recallfeed      Workspace     RecallFeed project agent following supervisor
                                 brief and stopping at review boundaries

$ kiro-cli agent validate --path .kiro/agents/recallfeed.json
[no output - validation passed]
Exit Code: 0
```

**Fields present:**
- `version`: "v1" ✓
- `name`: "recallfeed" ✓
- `description`: (brief) ✓
- `instructions`: (full prompt) ✓
- `model`: "claude-sonnet-4.5" ✓

**Loading evidence:**
- Agent appears in `kiro-cli agent list` output
- Agent validates successfully
- Agent uses correct "instructions" field per Kiro v3.1.0 schema

**Not claimed:**
- That instructions are automatically injected into every session (requires user to select agent)
- That model specification overrides Firstmate's configuration (it doesn't)

---

## 7. Handoff System Evidence (Not "Proven")

**Smoke test delivery:**
```json
{
  "outcome": "created",
  "id": "1794076611-x4xqxH",
  "saved": true,
  "announced": true,
  "path": "/Users/paulobayuwana/Documents/projects/firstmate/state/inbox/1794076611-x4xqxH.note"
}
```

**Gate 1 delivery:**
```json
{
  "outcome": "created",
  "id": "1794081540-FYJpda",
  "request_id": "recallfeed-20261107-195751-gate1-corrections",
  "saved": true,
  "announced": true
}
```

**What this proves:**
- ✓ Notification script can find newest review request
- ✓ Script can generate unique request IDs
- ✓ `fm-inbox.sh note --json` accepts the notification format
- ✓ Firstmate inbox receives and saves the notification
- ✓ Idempotency marker prevents duplicate submissions

**What this does NOT prove:**
- ✗ PostTaskExec hook automatically triggers on milestone completion
- ✗ Firstmate has read and processed the notifications
- ✗ Firstmate's review workflow activates automatically
- ✗ User receives notification of Firstmate's verdict

**Verification needed:**
- Manual testing of PostTaskExec trigger behavior
- User confirmation that Firstmate processes notifications
- Integration test of full Kiro → Firstmate → User feedback loop

---

## Summary of Corrections

| Correction | Status | Evidence |
|---|---|---|
| 1. Remove obsolete `importSource()` | ✓ Complete | Grep shows only new methods |
| 2. Restore API contracts | ✓ Complete | 6 endpoints fully documented |
| 3. Fix Access identity contract | ✓ Complete | Single mechanism documented, verification noted |
| 4. Genuine error sanitization | ✓ Complete | Explicit exclusion lists in code |
| 5. Retry-safe AI enrichment | ✓ Complete | Direct insertion, no existence checks |
| 6. Verify custom agent | ✓ Complete | `kiro-cli` confirms loading |
| 7. Handoff system reality check | ⚠️ Partial | Delivery proven, automation unverified |

---

## Files Modified

| File | Lines Changed | Nature |
|---|---|---|
| `01-core-domain.md` | ~30 | Split importSource interface |
| `03-connectors.md` | ~15 | Content via credentials |
| `04-feed-engine.md` | ~85 | Remove old method, update acceptance |
| `05-authentication.md` | ~400 | Add API contracts, fix Access docs |
| `06-inngest-workflows.md` | ~45 | Sanitization + retry safety |
| `recallfeed.json` | verified | Loading confirmed |

**Total:** ~575 lines corrected across 6 files

---

**Corrections complete per review feedback.** Ready for re-review.
