# Spec 01 — Core Domain Types and Interfaces

**Package:** `@recallfeed/core`
**Status:** Awaiting review
**Depends on:** Nothing

---

## Purpose

`@recallfeed/core` is the foundation of the entire RecallFeed skeleton. It defines the five domain types, four interface contracts, and the base error class that every other package depends on. It has zero runtime dependencies and must remain a pure TypeScript package.

Everything downstream — the database schema, the connector implementations, the feed engine, the API — is built to satisfy these contracts. The contracts must not be designed around a specific implementation.

---

## Domain Types

### `Source`

A connected knowledge source owned by a deployment.

```ts
type Source = {
  id: string;                        // UUID
  name: string;                      // Human-readable label, e.g. "Sermon Notes"
  type: SourceType;                  // "notion" | "markdown"
  config: Record<string, string>;    // Source-specific config (e.g. notion database ID)
  isActive: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SourceType = "notion" | "markdown";
```

`config` stores non-secret, per-source configuration such as the Notion database ID. Secrets (API keys) live in Worker environment bindings, never in `config`.

### `Note`

A single piece of imported content in its normalized form. The original content is always preserved.

```ts
type Note = {
  id: string;                        // UUID
  sourceId: string;                  // Foreign key → sources.id
  title: string | null;
  content: string;                   // Original content, never modified after import
  contentHash: string;               // SHA-256 of content — used for deduplication
  metadata: NoteMetadata;
  importedAt: Date;
  updatedAt: Date;
};

type NoteMetadata = {
  externalId?: string;               // ID in the source system (e.g. Notion page ID)
  externalUrl?: string;              // URL to the original content
  author?: string;
  tags?: string[];
  sourceCreatedAt?: string;          // ISO 8601 — when the note was created in the source
  sourceUpdatedAt?: string;          // ISO 8601 — last modified in the source
  [key: string]: unknown;            // Connector-specific extensions
};
```

### `FeedItem`

A surfaced card derived from a `Note`. One note can produce multiple feed items of different types. AI-generated content is explicitly flagged.

```ts
type FeedItem = {
  id: string;                        // UUID
  noteId: string;                    // Foreign key → notes.id
  sourceId: string;                  // Denormalized for efficient feed queries
  cardType: CardType;
  content: string;                   // The displayed card content
  isAiGenerated: boolean;            // Always false for "original" card type
  isPublished: boolean;              // Controls public visibility in public mode
  reviewCount: number;               // Number of times marked reviewed
  lastReviewedAt: Date | null;
  savedAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CardType = "original" | "highlight" | "summary" | "reflection_prompt" | "code_snippet";
```

`isPublished` is the gate for public-mode visibility. It defaults to `false`. An authorized user explicitly publishes a card to make it visible to anonymous visitors in `FEED_VISIBILITY=public` deployments.

### `ReviewEvent`

An immutable log of a user interaction with a feed item. Never updated or deleted after creation.

```ts
type ReviewEvent = {
  id: string;                        // UUID
  feedItemId: string;                // Foreign key → feed_items.id
  action: ReviewAction;
  createdAt: Date;
};

type ReviewAction = "reviewed" | "saved" | "unsaved" | "snoozed" | "published" | "unpublished";
```

### `FeedConfig`

Configures what the resurfacing engine surfaces and how. Defaults are set by environment variables; users can override per-deployment.

```ts
type FeedConfig = {
  enabledCardTypes: CardType[];
  resurfacingStrategy: ResurfacingStrategyName;
  pageSize: number;                  // Cards per feed request, max 50
  snoozeDefaultHours: number;        // Default snooze duration in hours
};

type ResurfacingStrategyName = "recency" | "importance" | "due_review";
```

---

## Interface Contracts

### `IConnector`

Implemented by every knowledge source connector. Each connector normalizes source content into `Note` objects without knowledge of the database or feed engine.

```ts
interface IConnector {
  readonly type: SourceType;

  /**
   * Validates that the connector can reach the source with the provided config.
   * Does not import any data.
   * Returns a human-readable description of what was found (e.g. "Notion database: My Notes, 42 pages").
   */
  validate(config: Record<string, string>, credentials: ConnectorCredentials): Promise<ConnectorValidationResult>;

  /**
   * Fetches all notes from the source.
   * Must be idempotent — calling import twice with identical source content returns identical Note objects.
   * Content deduplication is handled by the caller using Note.contentHash.
   */
  import(source: Source, credentials: ConnectorCredentials): Promise<NormalizedNote[]>;
}

type ConnectorCredentials = {
  apiKey?: string;                   // e.g. NOTION_API_KEY from Worker env
  content?: string;                  // Markdown content passed explicitly (not from database)
  [key: string]: string | undefined; // Future credential types
};

type ConnectorValidationResult = {
  valid: boolean;
  description: string;
  error?: string;
};

type NormalizedNote = Omit<Note, "id" | "importedAt" | "updatedAt">;
```

### `IResurfacingStrategy`

Implemented by each resurfacing algorithm. Receives the full list of eligible feed items and returns them in the desired order.

```ts
interface IResurfacingStrategy {
  readonly name: ResurfacingStrategyName;

  /**
   * Selects and orders feed items for the user's feed.
   * Must not perform database queries — receives pre-fetched candidates.
   * Must respect snoozedUntil: exclude items where snoozedUntil > now.
   */
  rank(candidates: FeedItem[], config: FeedConfig, now: Date): FeedItem[];
}
```

### `IAIProvider`

Implemented by AI adapters. Called asynchronously after notes are imported. The interface is intentionally narrow — AI enrichment is additive, never blocking.

```ts
interface IAIProvider {
  readonly name: string;

  /**
   * Generates a summary of the given note content.
   * Returns null if the provider is unavailable or the content is unsuitable.
   */
  summarize(content: string, options?: AIOptions): Promise<string | null>;

  /**
   * Generates a reflection prompt for the given note content.
   * Returns null if the provider is unavailable or the content is unsuitable.
   */
  generateReflectionPrompt(content: string, options?: AIOptions): Promise<string | null>;
}

type AIOptions = {
  maxTokens?: number;
  model?: string;
};
```

### `IFeedEngine`

The primary facade over the feed generation pipeline. This is what the API layer interacts with.

```ts
interface IFeedEngine {
  /**
   * Returns the next page of feed items for the current deployment.
   * In public mode, only returns items where isPublished = true.
   * Respects FeedConfig for card types, strategy, and page size.
   */
  getFeed(options: GetFeedOptions): Promise<FeedPage>;

  /**
   * Records a review action against a feed item.
   * Updates the feed item state (reviewCount, savedAt, snoozedUntil, etc.).
   */
  recordReview(feedItemId: string, action: ReviewAction): Promise<FeedItem>;

  /**
   * Imports Markdown content directly.
   * Content is passed explicitly as a parameter, not retrieved from database.
   * Always synchronous (within CPU budget via 100 KB size limit).
   * Creates or updates a Source record with type="markdown".
   */
  importMarkdown(content: string, sourceMetadata: { name: string }): Promise<ImportResult>;

  /**
   * Triggers note import from a Notion source.
   * Source must exist in database with type="notion" and valid config.
   * Async via Inngest if configured, else synchronous with 50-page limit.
   */
  importNotionSource(sourceId: string): Promise<ImportResult>;
}

type GetFeedOptions = {
  config: FeedConfig;
  cursor?: string;                   // Opaque pagination cursor
  isPublicRequest: boolean;          // true = only show published items
};

type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
  total: number;
};

type ImportResult = {
  queued: boolean;                   // true if enqueued via Inngest
  notesImported?: number;            // populated for synchronous imports
  feedItemsCreated?: number;
};
```

---

## Error Hierarchy

All domain errors extend `RecallFeedError`. This allows callers to distinguish RecallFeed errors from unexpected runtime errors.

```ts
class RecallFeedError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "RecallFeedError";
    this.code = code;
  }
}

class ConnectorError extends RecallFeedError {}       // code: "CONNECTOR_*"
class ValidationError extends RecallFeedError {}      // code: "VALIDATION_*"
class NotFoundError extends RecallFeedError {}        // code: "NOT_FOUND_*"
class AuthorizationError extends RecallFeedError {}   // code: "AUTH_*"
class RateLimitError extends RecallFeedError {}       // code: "RATE_LIMIT"
```

---

## Package Constraints

- Zero runtime dependencies. `devDependencies` for TypeScript only.
- No `fetch`, no `crypto`, no Node.js built-ins. Pure type definitions and class declarations.
- All types are exported from `src/index.ts`.
- The package must be tree-shakeable — no side effects.

---

## File Layout

```
packages/core/
├── src/
│   ├── types.ts          ← Source, Note, FeedItem, ReviewEvent, FeedConfig and variants
│   ├── interfaces.ts     ← IConnector, IResurfacingStrategy, IAIProvider, IFeedEngine
│   ├── errors.ts         ← RecallFeedError and subclasses
│   └── index.ts          ← Barrel export of all above
├── package.json
├── tsconfig.json
└── README.md
```

---

## Acceptance Criteria

- [ ] All five domain types are defined with the exact shape specified above.
- [ ] All four interfaces are defined with documented method signatures.
- [ ] `RecallFeedError` and its four subclasses are defined and exported.
- [ ] `packages/core/package.json` lists zero `dependencies`.
- [ ] Every exported symbol has a JSDoc comment.
- [ ] TypeScript compilation passes with `strict: true`.
