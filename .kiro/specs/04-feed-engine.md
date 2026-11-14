# Spec 04 — Feed Engine

**Package:** `@recallfeed/api` (part of the Worker application)
**Status:** Awaiting review
**Depends on:** `@recallfeed/core`, `@recallfeed/database`, `@recallfeed/connectors`, `@recallfeed/ai`

---

## Purpose

The Feed Engine is the orchestrator. It implements `IFeedEngine` and coordinates:
1. **Note import** — delegates to connectors, persists to database, optionally enqueues AI enrichment.
2. **Feed generation** — fetches candidate feed items, applies resurfacing strategy, returns paginated results.
3. **Review tracking** — records user actions and updates feed item state.

The Feed Engine lives inside `packages/api/src/engine/` and is not a separate package. It is the business logic layer of the Worker.

---

## Core Responsibilities

### 1. Import Orchestration

**Markdown Import:**

```ts
async importMarkdown(content: string, sourceMetadata: { name: string }): Promise<ImportResult> {
  // 1. Validate content size (10 bytes min, 100 KB max)
  const sizeBytes = new TextEncoder().encode(content).length;
  if (sizeBytes < 10 || sizeBytes > 100 * 1024) {
    throw new ValidationError("Content size out of bounds", "VALIDATION_SIZE");
  }

  // 2. Create or update Source record
  const source = await upsertSource(this.env.DATABASE_URL, {
    name: sourceMetadata.name,
    type: "markdown",
    config: {},
    isActive: true
  });

  // 3. Get Markdown connector and import
  const connector = connectorRegistry.get("markdown");
  const normalizedNotes = await connector.import(source, { content }); // Pass content in credentials object

  // 4. Persist notes
  let notesImported = 0;
  for (const note of normalizedNotes) {
    await upsertNote(this.env.DATABASE_URL, note);
    notesImported++;
  }

  // 5. Generate feed items (non-AI types only)
  const feedItemsCreated = await generateFeedItems(this.env.DATABASE_URL, source.id, this.env);

  // 6. Optionally trigger AI enrichment
  if (this.inngestClient && (this.env.ANTHROPIC_API_KEY || this.env.AI_BINDING)) {
    await this.inngestClient.send({
      name: "recallfeed/notes.enrich",
      data: { sourceId: source.id, timestamp: new Date().toISOString() }
    });
  }

  return { queued: false, notesImported, feedItemsCreated };
}
```

**Notion Import:**

```ts
async importNotionSource(sourceId: string): Promise<ImportResult> {
  const source = await getSourceById(this.env.DATABASE_URL, sourceId);
  if (!source || source.type !== "notion") {
    throw new NotFoundError(`Notion source not found: ${sourceId}`, "SOURCE_NOT_FOUND");
  }

  // Async via Inngest if configured
  if (this.inngestClient && this.env.INNGEST_EVENT_KEY) {
    await this.inngestClient.send({
      name: "recallfeed/source.ingest",
      data: { sourceId, timestamp: new Date().toISOString() }
    });
    return { queued: true };
  }

  // Synchronous fallback: 50-page limit
  const connector = connectorRegistry.get("notion");
  const credentials = { apiKey: this.env.NOTION_API_KEY };
  const normalizedNotes = await connector.import(source, credentials);
  const limitedNotes = normalizedNotes.slice(0, 50);

  let notesImported = 0;
  for (const note of limitedNotes) {
    await upsertNote(this.env.DATABASE_URL, note);
    notesImported++;
  }

  const feedItemsCreated = await generateFeedItems(this.env.DATABASE_URL, sourceId, this.env);

  return { queued: false, notesImported, feedItemsCreated };
}
```

### 2. Feed Generation

When `getFeed(options)` is called:

1. Extract `config`, `cursor`, and `isPublicRequest` from options.
2. Query database for candidate feed items:
   - Filter by `enabledCardTypes` from config.
   - If `isPublicRequest === true`, filter by `isPublished = true`.
   - Exclude items where `snoozedUntil > now`.
   - Apply cursor-based pagination.
3. Load the configured `IResurfacingStrategy` implementation.
4. Call `strategy.rank(candidates, config, now)` to order results.
5. Slice the first `config.pageSize` items.
6. Generate opaque `nextCursor` from the last item's `id` and sort key.
7. Return `{ items, nextCursor }`.

**Cursor format:**

```ts
type CursorData = {
  id: string;
  sortKey: string | number | null; // e.g., lastReviewedAt timestamp or importance score
};

function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeCursor(cursor: string): CursorData {
  return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
}
```

**Important:** The `sortKey` depends on the resurfacing strategy. For `recency`, it's `lastReviewedAt` or `createdAt`. For `importance`, it might be a computed score.

### 3. Review Recording

When `recordReview(feedItemId, action)` is called:

1. Insert a `ReviewEvent` record (immutable log).
2. Update the `FeedItem` record:
   - `reviewed` → increment `reviewCount`, set `lastReviewedAt = now`.
   - `saved` → set `savedAt = now`.
   - `unsaved` → set `savedAt = null`.
   - `snoozed` → set `snoozedUntil = now + config.snoozeDefaultHours`.
   - `published` → set `isPublished = true`.
   - `unpublished` → set `isPublished = false`.
3. Return the updated `FeedItem`.

---

## Implementation

### File: `packages/api/src/engine/feed-engine.ts`

```ts
import {
  IFeedEngine,
  GetFeedOptions,
  FeedPage,
  ImportResult,
  ReviewAction,
  FeedItem,
  ConnectorCredentials,
  ConnectorError,
  NotFoundError
} from "@recallfeed/core";
import { connectorRegistry } from "@recallfeed/connectors";
import { getSourceById, upsertNote, insertReviewEvent, updateFeedItem, getFeedItemById, getFeedItemCandidates } from "@recallfeed/database";
import { getResurfacingStrategy } from "./strategies";
import { generateFeedItems } from "./feed-item-generator";
import type { Env } from "../types";

export class FeedEngine implements IFeedEngine {
  constructor(private env: Env, private inngestClient?: any) {}

  async importMarkdown(content: string, sourceMetadata: { name: string }): Promise<ImportResult> {
    // 1. Validate content size (10 bytes min, 100 KB max)
    const sizeBytes = new TextEncoder().encode(content).length;
    if (sizeBytes < 10 || sizeBytes > 100 * 1024) {
      throw new ValidationError("Content size out of bounds", "VALIDATION_SIZE");
    }

    // 2. Create or update Source record
    const source = await upsertSource(this.env.DATABASE_URL, {
      name: sourceMetadata.name,
      type: "markdown",
      config: {},
      isActive: true
    });

    // 3. Get Markdown connector and import
    const connector = connectorRegistry.get("markdown");
    const normalizedNotes = await connector.import(source, { content }); // Pass content in credentials

    // 4. Persist notes
    let notesImported = 0;
    for (const note of normalizedNotes) {
      await upsertNote(this.env.DATABASE_URL, note);
      notesImported++;
    }

    // 5. Generate feed items (non-AI types only)
    const feedItemsCreated = await generateFeedItems(this.env.DATABASE_URL, source.id, this.env);

    // 6. Optionally trigger AI enrichment
    if (this.inngestClient && (this.env.ANTHROPIC_API_KEY || this.env.AI_BINDING)) {
      await this.inngestClient.send({
        name: "recallfeed/notes.enrich",
        data: { sourceId: source.id, timestamp: new Date().toISOString() }
      });
    }

    return { queued: false, notesImported, feedItemsCreated };
  }

  async importNotionSource(sourceId: string): Promise<ImportResult> {
    const source = await getSourceById(this.env.DATABASE_URL, sourceId);
    if (!source || source.type !== "notion") {
      throw new NotFoundError(`Notion source not found: ${sourceId}`, "SOURCE_NOT_FOUND");
    }

    // Async via Inngest if configured
    if (this.inngestClient && this.env.INNGEST_EVENT_KEY) {
      await this.inngestClient.send({
        name: "recallfeed/source.ingest",
        data: { sourceId, timestamp: new Date().toISOString() }
      });
      return { queued: true };
    }

    // Synchronous fallback: 50-page limit
    const connector = connectorRegistry.get("notion");
    const credentials = { apiKey: this.env.NOTION_API_KEY };
    const normalizedNotes = await connector.import(source, credentials);
    const limitedNotes = normalizedNotes.slice(0, 50);

    let notesImported = 0;
    for (const note of limitedNotes) {
      await upsertNote(this.env.DATABASE_URL, note);
      notesImported++;
    }

    const feedItemsCreated = await generateFeedItems(this.env.DATABASE_URL, sourceId, this.env);

    return { queued: false, notesImported, feedItemsCreated };
  }

  async getFeed(options: GetFeedOptions): Promise<FeedPage> {
    const { config, cursor, isPublicRequest } = options;
    const now = new Date();

    // Decode cursor if present
    let afterId: string | undefined;
    let afterSortKey: string | number | null | undefined;
    
    if (cursor) {
      const decoded = decodeCursor(cursor);
      afterId = decoded.id;
      afterSortKey = decoded.sortKey;
    }

    // Fetch candidates from database
    const candidates = await getFeedItemCandidates(this.env.DATABASE_URL, {
      cardTypes: config.enabledCardTypes,
      onlyPublished: isPublicRequest,
      excludeSnoozed: true,
      afterId,
      afterSortKey,
      limit: config.pageSize * 2 // Fetch more for strategy to rank
    });

    // Apply resurfacing strategy
    const strategy = getResurfacingStrategy(config.resurfacingStrategy);
    const ranked = strategy.rank(candidates, config, now);

    // Paginate
    const items = ranked.slice(0, config.pageSize);
    const hasMore = ranked.length > config.pageSize;

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      const sortKey = this.extractSortKey(lastItem, config.resurfacingStrategy);
      nextCursor = encodeCursor({ id: lastItem.id, sortKey });
    }

    return { items, nextCursor };
  }

  async recordReview(feedItemId: string, action: ReviewAction): Promise<FeedItem> {
    const now = new Date();

    // Insert immutable review event
    await insertReviewEvent(this.env.DATABASE_URL, {
      feedItemId,
      action,
      createdAt: now
    });

    // Compute state updates
    const updates: Partial<FeedItem> = {};

    switch (action) {
      case "reviewed":
        updates.reviewCount = { increment: 1 };
        updates.lastReviewedAt = now;
        break;
      case "saved":
        updates.savedAt = now;
        break;
      case "unsaved":
        updates.savedAt = null;
        break;
      case "snoozed":
        const snoozeHours = parseInt(this.env.SNOOZE_DEFAULT_HOURS || "24", 10);
        updates.snoozedUntil = new Date(now.getTime() + snoozeHours * 60 * 60 * 1000);
        break;
      case "published":
        updates.isPublished = true;
        break;
      case "unpublished":
        updates.isPublished = false;
        break;
    }

    // Apply updates
    await updateFeedItem(this.env.DATABASE_URL, feedItemId, updates);

    // Return updated item
    const updated = await getFeedItemById(this.env.DATABASE_URL, feedItemId);
    if (!updated) {
      throw new NotFoundError(`Feed item not found: ${feedItemId}`, "FEED_ITEM_NOT_FOUND");
    }

    return updated;
  }

  private extractSortKey(item: FeedItem, strategyName: string): string | number | null {
    switch (strategyName) {
      case "recency":
        return item.lastReviewedAt?.toISOString() || item.createdAt.toISOString();
      case "importance":
        // Importance score would be computed in the strategy and stored as metadata
        return item.reviewCount; // Simplified — real implementation would use computed score
      case "due_review":
        return item.lastReviewedAt?.toISOString() || null;
      default:
        return null;
    }
  }
}

function encodeCursor(data: { id: string; sortKey: string | number | null }): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

function decodeCursor(cursor: string): { id: string; sortKey: string | number | null } {
  return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
}
```

---

## Feed Item Generation

When notes are imported, the engine generates feed items for each enabled card type.

### File: `packages/api/src/engine/feed-item-generator.ts`

```ts
import { FeedItem, CardType, Note } from "@recallfeed/core";
import { getNotesBySource, insertFeedItem, getFeedItemByNoteAndType } from "@recallfeed/database";
import type { Env } from "../types";

export async function generateFeedItems(
  databaseUrl: string,
  sourceId: string,
  env: Env
): Promise<number> {
  const notes = await getNotesBySource(databaseUrl, sourceId);
  
  // Only create non-AI card types during sync import
  // AI types (summary, reflection_prompt) are created by enrichment workflow
  const syncCardTypes = (env.DEFAULT_CARD_TYPES || "original")
    .split(",")
    .filter(type => !["summary", "reflection_prompt"].includes(type)) as CardType[];

  let created = 0;

  for (const note of notes) {
    for (const cardType of syncCardTypes) {
      // Check if feed item already exists
      const existing = await getFeedItemByNoteAndType(databaseUrl, note.id, cardType);
      if (existing) continue;

      // Generate content based on card type
      const content = await generateCardContent(note, cardType, env);
      const isAiGenerated = false; // Sync types are not AI-generated

      await insertFeedItem(databaseUrl, {
        noteId: note.id,
        sourceId: note.sourceId,
        cardType,
        content,
        isAiGenerated,
        isPublished: false, // Default: not published
        reviewCount: 0,
        lastReviewedAt: null,
        savedAt: null,
        snoozedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      created++;
    }
  }

  return created;
}

async function generateCardContent(note: Note, cardType: CardType, env: Env): Promise<string> {
  switch (cardType) {
    case "original":
      return note.content;
    case "highlight":
      // Extract first meaningful paragraph or code block
      return extractHighlight(note.content);
    case "code_snippet":
      return extractCodeSnippet(note.content);
    case "summary":
    case "reflection_prompt":
      // AI-generated types are NOT created during sync import
      // They are created only after successful AI enrichment via Inngest
      throw new Error(`Card type "${cardType}" requires AI enrichment`);
    default:
      return note.content;
  }
}

function extractHighlight(content: string): string {
  // Extract first paragraph > 50 chars or first code block
  const paragraphs = content.split("\n\n").filter(p => p.trim().length > 50);
  if (paragraphs.length > 0) return paragraphs[0];

  const codeBlockMatch = content.match(/```[\s\S]+?```/);
  if (codeBlockMatch) return codeBlockMatch[0];

  return content.slice(0, 200);
}

function extractCodeSnippet(content: string): string {
  const codeBlockMatch = content.match(/```[\s\S]+?```/);
  return codeBlockMatch ? codeBlockMatch[0] : content;
}
```

---

## Resurfacing Strategies

### File: `packages/api/src/engine/strategies/index.ts`

```ts
import { IResurfacingStrategy, ResurfacingStrategyName } from "@recallfeed/core";
import { RecencyStrategy } from "./recency";
import { ImportanceStrategy } from "./importance";
import { DueReviewStrategy } from "./due-review";

const strategies = new Map<ResurfacingStrategyName, IResurfacingStrategy>([
  ["recency", new RecencyStrategy()],
  ["importance", new ImportanceStrategy()],
  ["due_review", new DueReviewStrategy()]
]);

export function getResurfacingStrategy(name: ResurfacingStrategyName): IResurfacingStrategy {
  const strategy = strategies.get(name);
  if (!strategy) {
    throw new Error(`Unknown resurfacing strategy: ${name}`);
  }
  return strategy;
}
```

### File: `packages/api/src/engine/strategies/recency.ts`

```ts
import { IResurfacingStrategy, FeedItem, FeedConfig } from "@recallfeed/core";

export class RecencyStrategy implements IResurfacingStrategy {
  readonly name = "recency" as const;

  rank(candidates: FeedItem[], config: FeedConfig, now: Date): FeedItem[] {
    return candidates
      .filter(item => !item.snoozedUntil || item.snoozedUntil <= now)
      .sort((a, b) => {
        const aTime = a.lastReviewedAt || a.createdAt;
        const bTime = b.lastReviewedAt || b.createdAt;
        return aTime.getTime() - bTime.getTime(); // Oldest first
      });
  }
}
```

### File: `packages/api/src/engine/strategies/importance.ts`

```ts
import { IResurfacingStrategy, FeedItem, FeedConfig } from "@recallfeed/core";

export class ImportanceStrategy implements IResurfacingStrategy {
  readonly name = "importance" as const;

  rank(candidates: FeedItem[], config: FeedConfig, now: Date): FeedItem[] {
    return candidates
      .filter(item => !item.snoozedUntil || item.snoozedUntil <= now)
      .sort((a, b) => {
        // Lower review count = higher importance (less reviewed = needs attention)
        return a.reviewCount - b.reviewCount;
      });
  }
}
```

### File: `packages/api/src/engine/strategies/due-review.ts`

```ts
import { IResurfacingStrategy, FeedItem, FeedConfig } from "@recallfeed/core";

export class DueReviewStrategy implements IResurfacingStrategy {
  readonly name = "due_review" as const;

  rank(candidates: FeedItem[], config: FeedConfig, now: Date): FeedItem[] {
    // Simple spaced repetition: prioritize items reviewed longest ago
    return candidates
      .filter(item => !item.snoozedUntil || item.snoozedUntil <= now)
      .sort((a, b) => {
        const aTime = a.lastReviewedAt?.getTime() || 0;
        const bTime = b.lastReviewedAt?.getTime() || 0;
        return aTime - bTime; // Oldest review first
      });
  }
}
```

---

## Acceptance Criteria

- [ ] `importMarkdown()` validates content size and creates/updates Source record
- [ ] `importMarkdown()` passes content via credentials parameter to connector
- [ ] `importNotionSource()` enqueues Inngest event if configured, else runs synchronously with 50-page limit
- [ ] `getFeed()` returns only `isPublished = true` items when `isPublicRequest = true`
- [ ] `getFeed()` excludes items where `snoozedUntil > now`
- [ ] `getFeed()` applies the configured resurfacing strategy
- [ ] `getFeed()` returns correct `nextCursor` for pagination
- [ ] `recordReview()` inserts an immutable `ReviewEvent`
- [ ] `recordReview()` updates `FeedItem` state correctly for all `ReviewAction` types
- [ ] `generateFeedItems()` does not create duplicate `(note_id, card_type)` feed items
- [ ] `generateFeedItems()` creates only non-AI card types during sync import
- [ ] Cursor encoding/decoding is stable and opaque
