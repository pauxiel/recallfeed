/**
 * Public API of `@recallfeed/feed-engine`.
 *
 * Scope so far: Markdown import, original-card creation, review actions (Phase 3), and the recency and
 * importance strategies with keyset cursor pagination (Phase 4). Notion, due_review, and AI are later work.
 */

export { DEFAULT_FEED_LIMIT, DEFAULT_SNOOZE_HOURS, FeedEngine, MAX_FEED_LIMIT } from "./feed-engine";
export type { FeedItemsPage, ListFeedOptions, MarkdownImportResult } from "./feed-engine";
export { MAX_CURSOR_LENGTH, decodeCursor, encodeCursor } from "./cursor";
export {
  DEFAULT_STRATEGY,
  ImportanceStrategy,
  RecencyStrategy,
  effectiveTime,
  getStrategy,
  isPageableStrategyName,
} from "./strategies";
export type { IPageableStrategy, PageableStrategyName } from "./strategies";
export { generateFeedItems } from "./card-generator";
export { generateHighlightCard, extractHighlight } from "./generators/highlight";
export { generateOriginalCard } from "./generators/original";
export { DEFAULT_SOURCE_NAME, MAX_SOURCE_NAME_LENGTH, assertValidImport } from "./validation";
export type { ValidImportInput } from "./validation";
