/**
 * Public API of `@recallfeed/feed-engine`.
 *
 * Phase 2 scope: Markdown import, original-card creation, and intermediate feed reads. Review
 * actions, resurfacing strategies, cursor pagination, Notion, and AI are later work.
 */

export { DEFAULT_FEED_LIMIT, FeedEngine, MAX_FEED_LIMIT } from "./feed-engine";
export type { ListFeedOptions, MarkdownImportResult } from "./feed-engine";
export { generateFeedItems } from "./card-generator";
export { generateOriginalCard } from "./generators/original";
export { DEFAULT_SOURCE_NAME, MAX_SOURCE_NAME_LENGTH, assertValidImport } from "./validation";
export type { ValidImportInput } from "./validation";
