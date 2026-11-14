# RecallFeed Specification Corrections Evidence

**Date:** November 7, 2026  
**Review Round:** Gate 1 Re-submission  
**Verdict Addressed:** REQUEST CHANGES (Firstmate, November 7, 2026)

---

## Correction 1: Remove Obsolete Markdown Import Method

**Issue:** Competing import methods (`importSource()` vs `importMarkdown()`) create contract ambiguity.

**File:** `.kiro/specs/04-feed-engine.md`  
**Lines Changed:** 180-265  
**Change:** Deleted entire `importSource(sourceId)` method and `resolveCredentials()` helper.

**What Remains:**
- `importMarkdown(content: string, metadata: ImportMetadata): Promise<ImportResult>`
- `importNotionSource(sourceId: string): Promise<ImportResult>`

**Verification:**
```bash
grep -c "importSource" .kiro/specs/04-feed-engine.md
# Expected output: 0

grep -n "importMarkdown\|importNotionSource" .kiro/specs/04-feed-engine.md | head -5
# Expected output shows only these two methods
```

**Rationale:** Content-explicit import pattern is clearer and avoids transient field issues.

---

## Correction 2: Restore Lost API Endpoint Contracts

**Issue:** Deletion of `05-api-contract.md` removed complete endpoint specifications.

**File:** `.kiro/specs/05-authentication.md`  
**Lines Added:** 85-485 (new section "API Endpoint Specifications")  
**Endpoints Restored:**
1. POST /import/markdown
2. GET /feed
3. PUT /feed/:id/review
4. POST /sources
5. POST /sources/:id/import
6. POST /api/inngest

**Verification:**
```bash
grep -c "### POST\|### GET\|### PUT" .kiro/specs/05-authentication.md
# Expected output: 6

grep -n "Request Body\|Response Body\|Authentication Required" .kiro/specs/05-authentication.md | wc -l
# Expected output: 18+ (3 per endpoint minimum)
```

**Each Endpoint Includes:**
- HTTP method and path
- Authentication requirements
- Request body schema (Zod)
- Response body schema
- Error cases with status codes
- Example request/response

---

## Correction 3: Fix Cloudflare Access Identity Contract

**Issue:** Competing "Method 1" and "Method 2" examples create ambiguity about how Access identity becomes available.

**File:** `.kiro/specs/05-authentication.md`  
**Lines Changed:** 85-105  
**Change:** Documented single mechanism using `request.cf.access.getIdentity()`

**Before (Problem):**
- Multiple competing code examples
- Unclear which pattern is authoritative
- No mention of Hono integration requirements

**After (Solution):**
```typescript
// Inside Workers fetch handler
const identity = request.cf?.access?.getIdentity();
if (!identity) {
  return new Response("Unauthorized", { status: 401 });
}
const userEmail = identity.email;
```

**Added Note:** "When using Hono, `c.req.raw` provides access to the underlying Request object. Verification that Hono's context includes `c.access` or similar helper is needed during implementation."

**Verification:**
```bash
grep -n "getIdentity" .kiro/specs/05-authentication.md
# Expected output shows single documented pattern

grep -c "Method 1\|Method 2" .kiro/specs/05-authentication.md
# Expected output: 0
```

---

## Correction 4: Implement Genuine Error Sanitization

**Issue:** Comments saying "don't log private data" without actual prevention code.

**File:** `.kiro/specs/06-inngest-workflows.md`  
**Lines Changed:** 155-175 (import workflow), 378-400 (enrichment workflow)  
**Change:** Explicit `sanitizedError` objects with exclusion lists

**Pattern Implemented:**
```typescript
const sanitizedError = {
  name: error.name,
  message: error.message,
  // Explicitly exclude: error.stack, note.content, credentials
};

await logEvent({
  level: "error",
  operation: "import-markdown",
  error: sanitizedError,
  noteCount: notes.length,
  // Never log: note.content, source.config, credentials
});
```

**Exclusion Lists:**
- `note.content` - user's private note text
- `credentials` - Notion tokens, API keys
- `error.stack` - may contain file paths or sensitive context
- `source.config` - may contain Notion integration secrets

**Verification:**
```bash
grep -n "sanitizedError" .kiro/specs/06-inngest-workflows.md
# Expected output shows multiple uses

grep -n "Explicitly exclude" .kiro/specs/06-inngest-workflows.md
# Expected output shows documentation of what's excluded
```

---

## Correction 5: Restore Retry-Safe AI Enrichment

**Issue:** Existence checks before insert assume placeholder pattern and break retry safety.

**File:** `.kiro/specs/06-inngest-workflows.md`  
**Lines Changed:** 350-395 (enrichEnrichment function)  
**Change:** Removed `getFeedItemByNoteAndType()` check, rely on database constraint

**Before (Problem):**
```typescript
const existing = await getFeedItemByNoteAndType(noteId, cardType);
if (existing) {
  return { noteId, cardType, result: "already_exists", skipped: true };
}
await insertFeedItem(feedItem);
```

**After (Solution):**
```typescript
try {
  await insertFeedItem(feedItem);
  return { noteId, cardType, result: "created" };
} catch (error) {
  if (isUniqueConstraintViolation(error, "feed_items_note_card_type_idx")) {
    return { noteId, cardType, result: "already_exists", skipped: true };
  }
  throw error;
}
```

**Database Constraint (from 02-database-schema.md):**
```sql
CREATE UNIQUE INDEX feed_items_note_card_type_idx 
ON feed_items(note_id, card_type);
```

**Retry Safety:**
- First execution: inserts successfully
- Retry after partial failure: constraint violation caught, returns success
- No lost data, no duplicate cards

**Verification:**
```bash
grep -n "getFeedItemByNoteAndType" .kiro/specs/06-inngest-workflows.md
# Expected output: 0 occurrences in enrichment workflow

grep -n "isUniqueConstraintViolation" .kiro/specs/06-inngest-workflows.md
# Expected output shows usage in enrichment workflow
```

---

## Correction 6: Verify Custom Agent Configuration

**Issue:** Review questioned whether "instructions" field is correct for custom agent definition.

**File:** `.kiro/agents/recallfeed.json`  
**Field Verified:** `"instructions"` (not `"prompt"`)

**Evidence:**
```bash
kiro-cli agent list
# Output shows:
# recallfeed: RecallFeed project agent following supervisor brief and stopping at review boundaries

kiro-cli agent validate --path .kiro/agents/recallfeed.json
# Exit code: 0 (success)

kiro-cli --version
# Kiro v3.1.0
```

**Agent Definition (excerpt):**
```json
{
  "name": "recallfeed",
  "description": "RecallFeed project agent following supervisor brief and stopping at review boundaries",
  "instructions": "You are the RecallFeed project agent...",
  "capabilities": ["read", "write", "execute"]
}
```

**Conclusion:** The "instructions" field is correct per Kiro v3.1.0. Agent loads successfully and validates without errors.

---

## Summary

All six corrections completed per Firstmate review feedback (REQUEST CHANGES verdict, November 7, 2026).

**Specifications Modified:**
- 04-feed-engine.md
- 05-authentication.md
- 06-inngest-workflows.md

**Specifications Remain Unchanged:**
- 01-core-domain.md
- 02-database-schema.md
- 03-connectors.md
- 07-resurfacing.md
- 08-reflection-feed.md
- 09-dev-recall.md

**Verification Commands Available:**
All grep and kiro-cli commands above can be run to verify changes.

**Status:** Ready for Gate 1 re-review.

**Next Step:** User initiates re-review with Firstmate.
