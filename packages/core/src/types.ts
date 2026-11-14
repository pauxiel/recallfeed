/**
 * Domain types for RecallFeed (Spec 01).
 *
 * This module contains type declarations only. It has no runtime code, no
 * imports, and no knowledge of any application built on top of the skeleton.
 */

/** The kind of knowledge source a {@link Source} connects to. */
export type SourceType = "notion" | "markdown";

/**
 * A connected knowledge source owned by a deployment.
 *
 * `config` stores non-secret, per-source configuration such as a Notion
 * database ID. Secrets (API keys) live in Worker environment bindings and
 * never appear in `config`.
 */
export type Source = {
  /** UUID. */
  id: string;
  /** Human-readable label, for example "Sermon Notes". */
  name: string;
  /** Which connector handles this source. */
  type: SourceType;
  /** Source-specific, non-secret configuration. */
  config: Record<string, string>;
  /** Whether the source participates in imports. */
  isActive: boolean;
  /** When the source was last imported, or null if it never was. */
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Connector-supplied metadata attached to a {@link Note}. */
export type NoteMetadata = {
  /** ID in the source system, for example a Notion page ID. */
  externalId?: string;
  /** URL of the original content. */
  externalUrl?: string;
  author?: string;
  tags?: string[];
  /** ISO 8601 timestamp: when the note was created in the source. */
  sourceCreatedAt?: string;
  /** ISO 8601 timestamp: when the note was last modified in the source. */
  sourceUpdatedAt?: string;
  /** Connector-specific extensions. */
  [key: string]: unknown;
};

/**
 * A single piece of imported content in its normalized form.
 * The original content is always preserved.
 */
export type Note = {
  /** UUID. */
  id: string;
  /** Foreign key to `sources.id`. */
  sourceId: string;
  title: string | null;
  /** Original content. Never modified after import. */
  content: string;
  /** SHA-256 of `content`, used for deduplication. */
  contentHash: string;
  metadata: NoteMetadata;
  importedAt: Date;
  updatedAt: Date;
};

/** The presentation form of a {@link FeedItem}. */
export type CardType =
  | "original"
  | "highlight"
  | "summary"
  | "reflection_prompt"
  | "code_snippet";

/**
 * A surfaced card derived from a {@link Note}. One note can produce several
 * feed items of different card types. AI-generated content is always flagged.
 */
export type FeedItem = {
  /** UUID. */
  id: string;
  /** Foreign key to `notes.id`. */
  noteId: string;
  /** Denormalized from the note for efficient feed queries. */
  sourceId: string;
  cardType: CardType;
  /** The displayed card content. */
  content: string;
  /** Always false for the "original" card type. */
  isAiGenerated: boolean;
  /**
   * Gate for public visibility. Defaults to false; an authorized user
   * publishes a card explicitly.
   */
  isPublished: boolean;
  /** Number of times the item was marked reviewed. */
  reviewCount: number;
  lastReviewedAt: Date | null;
  savedAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** An interaction a user can record against a {@link FeedItem}. */
export type ReviewAction =
  | "reviewed"
  | "saved"
  | "unsaved"
  | "snoozed"
  | "published"
  | "unpublished";

/** An immutable log entry of a user interaction. Never updated or deleted. */
export type ReviewEvent = {
  /** UUID. */
  id: string;
  /** Foreign key to `feed_items.id`. */
  feedItemId: string;
  action: ReviewAction;
  createdAt: Date;
};

/** The name of a resurfacing algorithm. */
export type ResurfacingStrategyName = "recency" | "importance" | "due_review";

/**
 * Configures what the resurfacing engine surfaces and how. Defaults come from
 * environment variables; a deployment can override them.
 */
export type FeedConfig = {
  enabledCardTypes: CardType[];
  resurfacingStrategy: ResurfacingStrategyName;
  /** Cards per feed request. Maximum 50. */
  pageSize: number;
  /** Default snooze duration, in hours. */
  snoozeDefaultHours: number;
};

/** A {@link Note} as produced by a connector, before persistence assigns identity and timestamps. */
export type NormalizedNote = Omit<Note, "id" | "importedAt" | "updatedAt">;

/** Credentials passed to a connector. Supplied by the caller, never stored in the database. */
export type ConnectorCredentials = {
  /** For example `NOTION_API_KEY` from the Worker environment. */
  apiKey?: string;
  /** Markdown content passed explicitly, not read from the database. */
  content?: string;
  /** Future credential types. */
  [key: string]: string | undefined;
};

/** The outcome of {@link IConnector.validate}. */
export type ConnectorValidationResult = {
  valid: boolean;
  /** Human-readable summary of what was found. */
  description: string;
  error?: string;
};

/** Options accepted by an AI provider. */
export type AIOptions = {
  maxTokens?: number;
  model?: string;
};

/** Options for {@link IFeedEngine.getFeed}. */
export type GetFeedOptions = {
  config: FeedConfig;
  /** Opaque pagination cursor. */
  cursor?: string;
  /** True restricts the result to published items. */
  isPublicRequest: boolean;
};

/** One page of feed results. */
export type FeedPage = {
  items: FeedItem[];
  /** Cursor for the next page, or null at the end of the feed. */
  nextCursor: string | null;
  total: number;
};

/** The outcome of an import operation. */
export type ImportResult = {
  /** True if the import was enqueued through Inngest. */
  queued: boolean;
  /** Populated for synchronous imports. */
  notesImported?: number;
  feedItemsCreated?: number;
};
