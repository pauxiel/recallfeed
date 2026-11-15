/**
 * Public API of `@recallfeed/feed-engine`.
 *
 * Scope so far: Markdown import, original-card creation, intermediate feed reads, and review actions
 * (Phase 3). Resurfacing strategies, cursor pagination, Notion, and AI are later work.
 */

export { DEFAULT_FEED_LIMIT, DEFAULT_SNOOZE_HOURS, FeedEngine, MAX_FEED_LIMIT } from "./feed-engine";
export type { ListFeedOptions, MarkdownImportResult } from "./feed-engine";
export { generateFeedItems } from "./card-generator";
export { generateOriginalCard } from "./generators/original";
export { DEFAULT_SOURCE_NAME, MAX_SOURCE_NAME_LENGTH, assertValidImport } from "./validation";
export type { ValidImportInput } from "./validation";
