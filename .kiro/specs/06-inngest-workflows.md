# Spec 06 — Inngest Workflows

**Package:** `@recallfeed/api` (Inngest functions live alongside the Worker)
**Status:** Awaiting review
**Depends on:** `@recallfeed/core`, `@recallfeed/connectors`, `@recallfeed/ai`, `@recallfeed/database`

---

## Purpose

Inngest orchestrates long-running asynchronous workflows that cannot fit within Cloudflare Workers' 10 ms free-tier CPU limit:

1. **Notion source ingestion** — fetch potentially hundreds of pages, persist notes, generate feed items, optionally trigger AI enrichment.
2. **Scheduled resurfacing** — cron-triggered review of all sources, re-import changed content.
3. **AI enrichment** — generate summaries and reflection prompts for imported notes (optional, triggered after note persistence).

Inngest is **optional**. If `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are not configured, the Worker falls back to synchronous processing with page limits.

---

## Inngest Client Setup

### File: `packages/api/src/inngest/client.ts`

```ts
import { Inngest } from "inngest";
import type { Env } from "../types";

export function createInngestClient(env: Env): Inngest | null {
  if (!env.INNGEST_EVENT_KEY || !env.INNGEST_SIGNING_KEY) {
    return null; // Inngest not configured
  }

  return new Inngest({
    id: env.APP_NAME || "recallfeed",
    eventKey: env.INNGEST_EVENT_KEY,
    isDev: env.INNGEST_DEV === "1"
  });
}
```

---

## Environment Binding Middleware

Inngest SDK v4 creates a fresh middleware instance per request. This pattern is concurrency-safe and replaces the module-level singleton used in older codebases.

### File: `packages/api/src/inngest/middleware.ts`

```ts
import { Middleware } from "inngest";
import type { Env } from "../types";

export class WorkersBindingsMiddleware extends Middleware.BaseMiddleware {
  readonly id = "workers-bindings";
  private env!: Env;

  async wrapRequest({ next, requestArgs }: Middleware.WrapRequestArgs) {
    // requestArgs[1] is the Workers env binding — per-instance, not global
    this.env = requestArgs[1] as Env;
    return await next();
  }

  transformFunctionInput(args: Middleware.TransformFunctionInputArgs) {
    // Inject env into function context
    return {
      ...args,
      ctx: {
        ...args.ctx,
        env: this.env
      }
    };
  }
}
```

Register this middleware when creating the Inngest function client:

```ts
import { createInngestClient } from "./client";
import { WorkersBindingsMiddleware } from "./middleware";

const inngest = createInngestClient(env);
if (inngest) {
  inngest.use(new WorkersBindingsMiddleware());
}
```

---

## Workflows

### 1. Source Ingestion (`recallfeed/source.ingest`)

**Trigger:** Fired by `FeedEngine.importSource()` for Notion sources when Inngest is configured.

**Event payload:**
```ts
{
  name: "recallfeed/source.ingest",
  data: {
    sourceId: string;
    timestamp: string; // ISO 8601
  }
}
```

**Function:**

```ts
import { inngest } from "./client";
import { connectorRegistry } from "@recallfeed/connectors";
import { getSourceById, upsertNote } from "@recallfeed/database";
import { generateFeedItems } from "../engine/feed-item-generator";
import type { Env } from "../types";

export const ingestSourceFunction = inngest.createFunction(
  {
    id: "ingest-source",
    name: "Ingest Source Content"
  },
  { event: "recallfeed/source.ingest" },
  async ({ event, step, ctx }) => {
    const env = ctx.env as Env;
    const { sourceId } = event.data;

    // Step 1: Fetch source from database
    const source = await step.run("fetch-source", async () => {
      return await getSourceById(env.DATABASE_URL, sourceId);
    });

    if (!source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    // Step 2: Get connector (no credential resolution in step result)
    const connector = connectorRegistry.get(source.type);

    // Step 3: Import notes
    const notesImported = await step.run("import-notes", async () => {
      // Resolve credentials inside the step — not returned
      const credentials = {
        apiKey: source.type === "notion" ? env.NOTION_API_KEY : undefined
      };

      let count = 0; // Declare outside try for catch-block access

      try {
        const normalizedNotes = await connector.import(source, credentials);

        for (const note of normalizedNotes) {
          // upsertNote is idempotent via contentHash
          await upsertNote(env.DATABASE_URL, note);
          count++;
        }

        return count; // Return count only, not credentials or note content
      } catch (error: any) {
        // Map to allowlisted error code
        const allowlistedErrors = new Set([
          "MARKDOWN_TOO_LARGE",
          "MARKDOWN_NO_CONTENT",
          "NOTION_INVALID_CONFIG",
          "NOTION_NO_API_KEY",
          "NOTION_IMPORT_ERROR",
          "CONNECTOR_NOT_FOUND",
          "SOURCE_NOT_FOUND"
        ]);

        const errorCode = allowlistedErrors.has(error.code) 
          ? error.code 
          : "IMPORT_ERROR";

        // Log only safe fields: no error.message, error.stack, note content, or credentials
        console.error("Note import failed:", {
          code: errorCode,
          sourceId,
          sourceType: source.type,
          noteCount: count
        });
        
        // Re-throw with allowlisted code to trigger SDK retry
        throw new Error(`Import failed: ${errorCode}`);
      }
    });

    // Step 4: Generate feed items
    const feedItemsCreated = await step.run("generate-feed-items", async () => {
      return await generateFeedItems(env.DATABASE_URL, sourceId, env);
    });

    // Step 5: Optionally trigger AI enrichment
    if (env.ANTHROPIC_API_KEY || env.AI_BINDING) {
      await step.run("trigger-ai-enrichment", async () => {
        await inngest.send({
          name: "recallfeed/notes.enrich",
          data: {
            sourceId,
            timestamp: new Date().toISOString()
          }
        });
      });
    }

    return { notesImported, feedItemsCreated }; // Counts only, no credentials
  }
);
```

**Key points:**
- Credentials are resolved **inside** the `import-notes` step, not as a separate step.
- Step results contain only counts and non-sensitive identifiers (never credentials or note content).
- Retry behavior: If `upsertNote` fails partway through, the step retries from the beginning. `upsertNote` is idempotent via `contentHash`, so duplicate inserts are ignored.
- Error messages are sanitized to prevent logging private note content or connector internal state.

---

### 2. Scheduled Resurfacing (`recallfeed/scheduled.resurface`)

**Trigger:** Cloudflare Workers Cron Trigger (configured in `wrangler.toml`).

**Event payload:**
```ts
{
  name: "recallfeed/scheduled.resurface",
  data: {
    timestamp: string; // ISO 8601
  }
}
```

**Function:**

```ts
export const scheduledResurfaceFunction = inngest.createFunction(
  {
    id: "scheduled-resurface",
    name: "Scheduled Resurfacing"
  },
  { event: "recallfeed/scheduled.resurface" },
  async ({ event, step, ctx }) => {
    const env = ctx.env as Env;

    // Step 1: Get all active sources
    const sources = await step.run("fetch-active-sources", async () => {
      return await getActiveSources(env.DATABASE_URL);
    });

    // Step 2: Wake up sources not synced recently
    const wokenCount = await step.run("wake-sources", async () => {
      const now = new Date();
      const wakeThreshold = 24 * 60 * 60 * 1000; // 24 hours
      
      let count = 0;
      for (const source of sources) {
        const lastSynced = source.lastSyncedAt?.getTime() || 0;
        const shouldWake = (now.getTime() - lastSynced) > wakeThreshold;

        if (shouldWake) {
          await inngest.send({
            name: "recallfeed/source.ingest",
            data: { sourceId: source.id, timestamp: now.toISOString() }
          });
          count++;
        }
      }

      return count;
    });

    return { wokenCount, sourcesQueued: wokenCount };
  }
);
```

**Cron configuration in `wrangler.toml`:**

```toml
[triggers]
crons = ["0 6 * * *"]  # Daily at 6 AM UTC
```

**Workers `scheduled()` handler:**

```ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const inngest = createInngestClient(env);
    if (!inngest) return; // Inngest not configured

    await inngest.send({
      name: "recallfeed/scheduled.resurface",
      data: { timestamp: new Date().toISOString() }
    });
  }
};
```

**Key points:**
- The `scheduled()` handler cannot use middleware-injected env because it runs outside an HTTP request.
- The handler fires a non-sensitive event to Inngest.
- The triggered function reads credentials from `ctx.env` via middleware when Inngest Cloud calls the Worker's HTTP endpoint.

---

### 3. AI Enrichment (`recallfeed/notes.enrich`)

**Trigger:** Fired by `ingestSourceFunction` after notes are persisted.

**Event payload:**
```ts
{
  name: "recallfeed/notes.enrich",
  data: {
    sourceId: string;
    timestamp: string;
  }
}
```

**Function:**

```ts
import { NonRetriableError } from "inngest";
import { getAIProvider } from "@recallfeed/ai";
import { getNotesBySource, getNoteById, insertFeedItem, getFeedItemByNoteAndType } from "@recallfeed/database";

// Allowlisted error codes for safe classification
const TRANSIENT_AI_ERRORS = new Set([
  "AI_PROVIDER_UNAVAILABLE",
  "AI_QUOTA_EXCEEDED",
  "AI_TIMEOUT"
]);

// PostgreSQL/Neon transient error codes  
// Source: @neondatabase/serverless driver and Node.js net module
const TRANSIENT_DATABASE_ERRORS = new Set([
  "ETIMEDOUT",      // Connection timeout
  "ECONNREFUSED",   // Connection refused
  "ENOTFOUND",      // DNS lookup failed
  "ECONNRESET",     // Connection reset
  "57P01",          // PostgreSQL: admin shutdown
  "57P02",          // PostgreSQL: crash shutdown
  "57P03",          // PostgreSQL: cannot connect now
  "08006",          // PostgreSQL: connection failure
  "08003"           // PostgreSQL: connection does not exist
]);

// Target unique constraint for (note_id, card_type)
const TARGET_CONSTRAINT = "feed_items_note_card_type_idx";

function classifyDatabaseError(error: any): { code: string; retry: boolean } {
  const code = error.code;
  
  if (TRANSIENT_DATABASE_ERRORS.has(code)) {
    return { code: "DB_CONNECTION_ERROR", retry: true };
  }
  
  // Constraint violations are not transient (handled separately by caller)
  if (code === "23505") {
    return { code: "DB_CONSTRAINT_VIOLATION", retry: false };
  }
  
  // All other database errors treated as permanent
  return { code: "DB_ERROR", retry: false };
}

export const enrichNotesFunction = inngest.createFunction(
  {
    id: "enrich-notes",
    name: "AI Enrichment",
    retries: 4  // 4 retries after initial attempt = 5 total attempts
  },
  { event: "recallfeed/notes.enrich" },
  async ({ event, step, ctx }) => {
    const env = ctx.env as Env;
    const { sourceId } = event.data;

    // Step 2: Fetch note IDs only (not full content)
    const noteIds = await step.run("fetch-note-ids", async () => {
      try {
        const notes = await getNotesBySource(env.DATABASE_URL, sourceId);
        // Return IDs only - do not serialize note content as step result
        return notes.map(note => note.id);
      } catch (error: any) {
        const classification = classifyDatabaseError(error);
        if (classification.retry) {
          throw new Error(classification.code);
        }
        // Permanent database error: use NonRetriableError to prevent retries
        throw new NonRetriableError("DB_QUERY_FAILED");
      }
    });

    // Step 3: Enrich each note independently per card type
    const results = {
      summariesCreated: 0,
      summariesExisted: 0,
      promptsCreated: 0,
      promptsExisted: 0,
      skipped: 0,
      failed: 0
    };

    for (const noteId of noteIds) {
      // Step 3a: Generate summary (independent, conflict-safe)
      const summaryResult = await step.run(`enrich-summary-${noteId}`, async () => {
        try {
          const aiProvider = getAIProvider({
            anthropicApiKey: env.ANTHROPIC_API_KEY,
            aiBinding: env.AI_BINDING
          });

          if (!aiProvider) {
            return { result: "skipped", reason: "no_provider" };
          }

          // Check if summary already exists (idempotent)
          let existing;
          try {
            existing = await getFeedItemByNoteAndType(env.DATABASE_URL, noteId, "summary");
          } catch (error: any) {
            const classification = classifyDatabaseError(error);
            if (classification.retry) {
              throw new Error(classification.code);
            }
            console.error("Existence check failed:", { code: classification.code, noteId });
            return { result: "failed", code: classification.code };
          }
          
          if (existing) {
            return { result: "already_exists" };
          }

          // Load note content
          let note;
          try {
            note = await getNoteById(env.DATABASE_URL, noteId);
          } catch (error: any) {
            const classification = classifyDatabaseError(error);
            if (classification.retry) {
              throw new Error(classification.code);
            }
            console.error("Note lookup failed:", { code: classification.code, noteId });
            return { result: "failed", code: classification.code };
          }
          
          if (!note) {
            // Note deliberately deleted - terminal status, no retry
            console.error("Note not found (deleted):", { noteId });
            return { result: "failed", code: "NOTE_DELETED" };
          }

          // Generate AI summary
          let summary: string;
          try {
            summary = await aiProvider.summarize(note.content);
          } catch (aiError: any) {
            const errorCode = aiError.code && TRANSIENT_AI_ERRORS.has(aiError.code)
              ? aiError.code
              : "AI_ERROR";

            // Transient AI failures: throw safe error to trigger retry
            if (TRANSIENT_AI_ERRORS.has(errorCode)) {
              throw new Error(errorCode);
            }

            // Permanent AI failures: log sanitized error, return terminal
            console.error("Summary generation failed:", {
              code: errorCode,
              noteId
            });
            return { result: "failed", code: errorCode };
          }

          if (!summary) {
            return { result: "failed", code: "EMPTY_SUMMARY" };
          }

          // Insert with error classification
          try {
            await insertFeedItem(env.DATABASE_URL, {
              noteId: note.id,
              sourceId: note.sourceId,
              cardType: "summary",
              content: summary,
              isAiGenerated: true,
              isPublished: false,
              reviewCount: 0,
              lastReviewedAt: null,
              savedAt: null,
              snoozedUntil: null,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            return { result: "created" };
          } catch (insertError: any) {
            const classification = classifyDatabaseError(insertError);
            
            // Target constraint violation: race condition with (note_id, card_type), treat as success
            if (classification.code === "DB_CONSTRAINT_VIOLATION" && 
                insertError.constraint === TARGET_CONSTRAINT) {
              return { result: "already_exists" };
            }
            
            // Other unique violations: log and terminal
            if (classification.code === "DB_CONSTRAINT_VIOLATION") {
              console.error("Unexpected constraint violation:", {
                code: "DB_CONSTRAINT_VIOLATION",
                noteId
              });
              return { result: "failed", code: "DB_CONSTRAINT_VIOLATION" };
            }
            
            // Transient: throw safe error
            if (classification.retry) {
              throw new Error(classification.code);
            }
            
            // Permanent: log and return terminal
            console.error("Summary insert failed:", {
              code: classification.code,
              noteId
            });
            return { result: "failed", code: classification.code };
          }
        } catch (error: any) {
          // Only safe errors should reach here
          // Construct fresh error with allowlisted message only (don't rethrow external object)
          const safeRetryErrors = new Set([
            "DB_CONNECTION_ERROR",
            "AI_PROVIDER_UNAVAILABLE",
            "AI_QUOTA_EXCEEDED",
            "AI_TIMEOUT"
          ]);
          
          if (safeRetryErrors.has(error.message)) {
            // Throw fresh error with safe message only
            throw new Error(error.message);
          }
          
          // Unexpected error: log sanitized and terminal
          console.error("Summary enrichment failed:", {
            noteId,
            code: "UNEXPECTED_ERROR"
          });
          return { result: "failed", code: "UNEXPECTED_ERROR" };
        }
      });

      if (summaryResult.result === "created") results.summariesCreated++;
      if (summaryResult.result === "already_exists") results.summariesExisted++;
      if (summaryResult.result === "skipped") results.skipped++;
      if (summaryResult.result === "failed") results.failed++;

      // Step 3b: Generate reflection prompt (independent, conflict-safe)
      const promptResult = await step.run(`enrich-prompt-${noteId}`, async () => {
        try {
          const aiProvider = getAIProvider({
            anthropicApiKey: env.ANTHROPIC_API_KEY,
            aiBinding: env.AI_BINDING
          });

          if (!aiProvider) {
            return { result: "skipped", reason: "no_provider" };
          }

          // Check if prompt already exists
          let existing;
          try {
            existing = await getFeedItemByNoteAndType(env.DATABASE_URL, noteId, "reflection_prompt");
          } catch (error: any) {
            const classification = classifyDatabaseError(error);
            if (classification.retry) {
              throw new Error(classification.code);
            }
            console.error("Existence check failed:", { code: classification.code, noteId });
            return { result: "failed", code: classification.code };
          }
          
          if (existing) {
            return { result: "already_exists" };
          }

          // Load note content
          let note;
          try {
            note = await getNoteById(env.DATABASE_URL, noteId);
          } catch (error: any) {
            const classification = classifyDatabaseError(error);
            if (classification.retry) {
              throw new Error(classification.code);
            }
            console.error("Note lookup failed:", { code: classification.code, noteId });
            return { result: "failed", code: classification.code };
          }
          
          if (!note) {
            console.error("Note not found (deleted):", { noteId });
            return { result: "failed", code: "NOTE_DELETED" };
          }

          // Generate AI prompt
          let prompt: string;
          try {
            prompt = await aiProvider.generateReflectionPrompt(note.content);
          } catch (aiError: any) {
            const errorCode = aiError.code && TRANSIENT_AI_ERRORS.has(aiError.code)
              ? aiError.code
              : "AI_ERROR";

            if (TRANSIENT_AI_ERRORS.has(errorCode)) {
              throw new Error(errorCode);
            }

            console.error("Prompt generation failed:", {
              code: errorCode,
              noteId
            });
            return { result: "failed", code: errorCode };
          }

          if (!prompt) {
            return { result: "failed", code: "EMPTY_PROMPT" };
          }

          // Insert with error classification
          try {
            await insertFeedItem(env.DATABASE_URL, {
              noteId: note.id,
              sourceId: note.sourceId,
              cardType: "reflection_prompt",
              content: prompt,
              isAiGenerated: true,
              isPublished: false,
              reviewCount: 0,
              lastReviewedAt: null,
              savedAt: null,
              snoozedUntil: null,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            return { result: "created" };
          } catch (insertError: any) {
            const classification = classifyDatabaseError(insertError);
            
            // Target constraint violation: race condition with (note_id, card_type), treat as success
            if (classification.code === "DB_CONSTRAINT_VIOLATION" && 
                insertError.constraint === TARGET_CONSTRAINT) {
              return { result: "already_exists" };
            }
            
            // Other unique violations: log and terminal
            if (classification.code === "DB_CONSTRAINT_VIOLATION") {
              console.error("Unexpected constraint violation:", {
                code: "DB_CONSTRAINT_VIOLATION",
                noteId
              });
              return { result: "failed", code: "DB_CONSTRAINT_VIOLATION" };
            }
            
            if (classification.retry) {
              throw new Error(classification.code);
            }
            
            console.error("Prompt insert failed:", {
              code: classification.code,
              noteId
            });
            return { result: "failed", code: classification.code };
          }
        } catch (error: any) {
          // Only safe errors should reach here
          // Construct fresh error with allowlisted message only (don't rethrow external object)
          const safeRetryErrors = new Set([
            "DB_CONNECTION_ERROR",
            "AI_PROVIDER_UNAVAILABLE",
            "AI_QUOTA_EXCEEDED",
            "AI_TIMEOUT"
          ]);
          
          if (safeRetryErrors.has(error.message)) {
            // Throw fresh error with safe message only
            throw new Error(error.message);
          }
          
          console.error("Prompt enrichment failed:", {
            noteId,
            code: "UNEXPECTED_ERROR"
          });
          return { result: "failed", code: "UNEXPECTED_ERROR" };
        }
      });

      if (promptResult.result === "created") results.promptsCreated++;
      if (promptResult.result === "already_exists") results.promptsExisted++;
      if (promptResult.result === "skipped") results.skipped++;
      if (promptResult.result === "failed") results.failed++;
    }

    return results;
  }
);
```

**Error Classification:**

- **Transient AI Errors:** `AI_PROVIDER_UNAVAILABLE`, `AI_QUOTA_EXCEEDED`, `AI_TIMEOUT` → throw safe error → Inngest SDK retry
- **Transient Database Errors:** Node transport codes (`ETIMEDOUT`, `ECONNREFUSED`, `ENOTFOUND`, `ECONNRESET`) plus PostgreSQL/Neon connection codes (`57P01`, `57P02`, `57P03`, `08006`, `08003`) → throw `"DB_CONNECTION_ERROR"` → Inngest SDK retry
- **Target Constraint Violations:** `23505` with constraint `feed_items_note_card_type_idx` → treat as `already_exists` (race condition on note/card pair)
- **Other Constraint Violations:** `23505` with unrelated constraints → terminal failure (log unexpected violation)
- **Deleted Notes:** Missing note after lookup → `"NOTE_DELETED"` terminal status (deliberate deletion, not transient)
- **Permanent Errors:** All other DB/AI errors → log allowlisted code → terminal status

**Retry Configuration:**
- Explicitly configured: `retries: 4` (4 retries after initial attempt = 5 total attempts)
- Inngest SDK default: 4 retries (changed from earlier 3-retry documentation)
- After all retries exhausted: Function fails with last thrown error
- Observable in Inngest dashboard; no manual UI retry needed
- Reference: [Inngest Retries Documentation](https://www.inngest.com/docs/features/inngest-functions/error-retries/retries)

**Privacy Contract:**
- All logged errors use only allowlisted codes
- All thrown errors use fixed safe messages (`"DB_CONNECTION_ERROR"`, `"AI_TIMEOUT"`, etc.)
- No arbitrary error.message, error.stack, connection strings, or provider details
- Original external errors never thrown/logged; only safe classified errors

---

## Inngest Serve Handler

The Worker exposes a single endpoint for Inngest Cloud to call back:

### File: `packages/api/src/inngest/serve.ts`

```ts
import { serve } from "inngest/cloudflare";
import { createInngestClient } from "./client";
import { WorkersBindingsMiddleware } from "./middleware";
import { ingestSourceFunction, scheduledResurfaceFunction, enrichNotesFunction } from "./functions";
import type { Env } from "../types";

export function createInngestHandler(env: Env) {
  const inngest = createInngestClient(env);
  if (!inngest) {
    return null; // Inngest not configured
  }

  inngest.use(new WorkersBindingsMiddleware());

  return serve({
    client: inngest,
    functions: [
      ingestSourceFunction,
      scheduledResurfaceFunction,
      enrichNotesFunction
    ],
    signingKey: env.INNGEST_SIGNING_KEY
  });
}
```

**Worker entry point:**

```ts
import { createInngestHandler } from "./inngest/serve";
import { honoApp } from "./app";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Route /api/inngest to Inngest handler (exact path match)
    if (url.pathname === "/api/inngest") {
      const inngestHandler = createInngestHandler(env);
      if (!inngestHandler) {
        return new Response("Inngest not configured", { status: 503 });
      }
      return inngestHandler(request, env, ctx);
    }

    // All other routes to Hono
    return honoApp.fetch(request, env, ctx);
  }
};
```

---

## Error Handling and Retries

- **Inngest SDK default:** 4 retries with exponential backoff (5 total attempts including initial).
- **Idempotent operations:** `upsertNote` uses `contentHash` to avoid duplicate inserts. Re-running `ingestSourceFunction` after partial persistence completes successfully without creating duplicates.
- **Non-idempotent operations:** `insertFeedItem` checks for existing `(noteId, cardType)` before inserting. This is application-level deduplication. For database-level enforcement, a unique index should be added (see Spec 02 corrections).

---

## Acceptance Criteria

**Environment and Configuration:**
- [ ] `WorkersBindingsMiddleware` injects `env` into function context per-request.
- [ ] Missing `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` disable workflows gracefully without crashing.
- [ ] Inngest SDK signature verification is enabled in production (never `INNGEST_DEV=1`).

**Privacy and Error Sanitization:**
- [ ] Step results contain no private note content, credentials, or error.stack.
- [ ] Errors are mapped to allowlisted codes only (MARKDOWN_TOO_LARGE, NOTION_IMPORT_ERROR, AI_ERROR, etc.).
- [ ] Arbitrary error.message and error.code are never logged or returned.
- [ ] Private note content is loaded inside steps that need it, not passed as step results.

**Retry Safety and Conflict Handling:**
- [ ] `upsertNote()` is idempotent via contentHash; duplicate imports are safe.
- [ ] Summary and reflection prompt creation are independent steps per card type.
- [ ] PostgreSQL unique constraint `(note_id, card_type)` prevents duplicate feed items.
- [ ] Target constraint violation (constraint `feed_items_note_card_type_idx`) returns `already_exists`.
- [ ] Unrelated constraint violations (other 23505 codes) return terminal failure with logged code.
- [ ] Retrying after partial success (summary exists, prompt missing) completes the missing card.
- [ ] Results distinguish `created`, `already_exists`, and `failed` for each card type.

**Observable Outcomes:**
- [ ] Failed enrichment returns `{ failed: N }`, not zero as if successful.
- [ ] `summariesCreated`, `summariesExisted`, `promptsCreated`, `promptsExisted` accurately reflect completion state.
- [ ] Missing AI provider returns `skipped` with reason, not silent success or failure.
- [ ] `ingestSourceFunction` resolves credentials inside the `import-notes` step, not as a separate step.
- [ ] `ingestSourceFunction` step results contain only counts and non-sensitive identifiers.
- [ ] `ingestSourceFunction` retries correctly after partial note persistence (idempotency verified).
- [ ] `scheduledResurfaceFunction` is triggered by Workers cron via `scheduled()` handler.
- [ ] `scheduledResurfaceFunction` does not include credentials in event payloads.
- [ ] `enrichNotesFunction` resolves AI provider credentials inside enrichment steps (not as separate step result).
- [ ] `enrichNotesFunction` checks for existing feed items before generating new ones.
- [ ] `/api/inngest` endpoint validates `INNGEST_SIGNING_KEY`.
- [ ] Inngest is optional — Worker falls back to synchronous processing if not configured.
