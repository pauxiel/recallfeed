/**
 * Interface contracts for RecallFeed (Spec 01).
 *
 * Every other package is built to satisfy these contracts. They describe
 * behavior without assuming any particular implementation, database, or
 * frontend. This module contains type declarations only.
 */

import type {
  AIOptions,
  ConnectorCredentials,
  ConnectorValidationResult,
  FeedConfig,
  FeedItem,
  FeedPage,
  GetFeedOptions,
  ImportResult,
  NormalizedNote,
  ResurfacingStrategyName,
  ReviewAction,
  Source,
  SourceType,
} from "./types";

/**
 * Implemented by every knowledge source connector. A connector normalizes
 * source content into notes without knowledge of the database or feed engine.
 */
export interface IConnector {
  /** The source type this connector handles. */
  readonly type: SourceType;

  /**
   * Checks that the connector can reach the source with the given config.
   * Does not import any data.
   *
   * @returns A human-readable description of what was found, for example
   * "Notion database: My Notes, 42 pages".
   */
  validate(
    config: Record<string, string>,
    credentials: ConnectorCredentials,
  ): Promise<ConnectorValidationResult>;

  /**
   * Fetches all notes from the source.
   *
   * Must be idempotent: importing identical source content twice returns
   * identical notes. The caller deduplicates using `Note.contentHash`.
   */
  import(
    source: Source,
    credentials: ConnectorCredentials,
  ): Promise<NormalizedNote[]>;
}

/**
 * Implemented by each resurfacing algorithm. Receives the eligible feed items
 * and returns them in the desired order.
 */
export interface IResurfacingStrategy {
  /** The strategy's configuration name. */
  readonly name: ResurfacingStrategyName;

  /**
   * Selects and orders feed items for the user's feed.
   *
   * Must not perform database queries; candidates are pre-fetched. Must
   * exclude items whose `snoozedUntil` is later than `now`.
   */
  rank(candidates: FeedItem[], config: FeedConfig, now: Date): FeedItem[];
}

/**
 * Implemented by AI adapters. Called asynchronously after notes are imported.
 * AI enrichment is additive and never blocks a request.
 */
export interface IAIProvider {
  /** The provider's name, for example "workers-ai". */
  readonly name: string;

  /**
   * Generates a summary of the given note content.
   *
   * @returns The summary, or null if the provider is unavailable or the
   * content is unsuitable.
   */
  summarize(content: string, options?: AIOptions): Promise<string | null>;

  /**
   * Generates a reflection prompt for the given note content.
   *
   * @returns The prompt, or null if the provider is unavailable or the
   * content is unsuitable.
   */
  generateReflectionPrompt(
    content: string,
    options?: AIOptions,
  ): Promise<string | null>;
}

/**
 * The primary facade over the feed generation pipeline. The API layer
 * interacts with this interface.
 */
export interface IFeedEngine {
  /**
   * Returns the next page of feed items for the current deployment.
   *
   * In public mode, returns only items where `isPublished` is true. Respects
   * `FeedConfig` for card types, strategy, and page size.
   */
  getFeed(options: GetFeedOptions): Promise<FeedPage>;

  /**
   * Records a review action against a feed item and updates the item's state
   * (`reviewCount`, `savedAt`, `snoozedUntil`, and so on).
   */
  recordReview(feedItemId: string, action: ReviewAction): Promise<FeedItem>;

  /**
   * Imports Markdown content directly.
   *
   * The content is passed as a parameter, not read from the database. The
   * import is synchronous and stays within the CPU budget through the 100 KB
   * size limit. Creates or updates a Source record with type "markdown".
   */
  importMarkdown(
    content: string,
    sourceMetadata: { name: string },
  ): Promise<ImportResult>;

  /**
   * Triggers note import from a Notion source.
   *
   * The source must exist with type "notion" and valid config. The import is
   * asynchronous through Inngest when configured, otherwise synchronous with
   * a 50-page limit.
   */
  importNotionSource(sourceId: string): Promise<ImportResult>;
}
