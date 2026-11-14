import { ValidationError } from "@recallfeed/core";
import type { FeedItem, ImportResult } from "@recallfeed/core";
import { connectorRegistry } from "@recallfeed/connectors";
import {
  MAX_CANDIDATE_LIMIT,
  getFeedItemById,
  getFeedItemCandidates,
  updateSourceSyncedAt,
  upsertNotes,
  upsertSource,
} from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";
import { generateFeedItems } from "./card-generator";
import { assertValidImport } from "./validation";

/** The most cards one intermediate feed request returns (Spec 05). */
export const MAX_FEED_LIMIT = 50;

/** The page size when a request does not give one (Spec 05 and Task 20). */
export const DEFAULT_FEED_LIMIT = 10;

/**
 * What a Markdown import returns. It is Spec 05's response: core's `ImportResult` plus the
 * `sourceId`, which `ImportResult` does not carry. The result stays assignable to `ImportResult`.
 */
export type MarkdownImportResult = ImportResult & {
  sourceId: string;
  /** False: Markdown imports always run synchronously, and no queue exists in this phase. */
  queued: false;
  /** Notes now stored for this import, new and already-existing ones alike. */
  notesImported: number;
  /** Cards this import created. Zero when every note already had its card. */
  feedItemsCreated: number;
};

/** Options for {@link FeedEngine.listFeedItems}. */
export type ListFeedOptions = {
  /** Page size, 1 to {@link MAX_FEED_LIMIT}. Defaults to {@link DEFAULT_FEED_LIMIT}. */
  limit?: number;
  /** True restricts the result to published cards (public requests). */
  isPublicRequest: boolean;
};

/**
 * Coordinates Markdown import and the intermediate feed reads.
 *
 * This is a request-scoped object: build one per request from `createDb(env.DATABASE_URL)`. It
 * implements the `importMarkdown` part of core's `IFeedEngine`. The review, Notion, and strategy
 * based `getFeed` methods arrive in later phases, and no AI or queue is involved here.
 */
export class FeedEngine {
  constructor(private readonly db: DbClient) {}

  /**
   * Imports Markdown: source, notes, then original cards.
   *
   * Each step is idempotent, so a request that fails partway is safe to retry and a repeat import
   * of the same text changes nothing but timestamps. The whole import uses a fixed handful of
   * database requests however many notes the text holds, which keeps it under the Workers
   * subrequest limit.
   *
   * @param content - The Markdown text, 10 bytes to 100 KB.
   * @param metadata - `name` identifies the source. Importing under the same name again reuses it,
   * so notes deduplicate within that source and not across sources.
   * @returns Spec 05's `{ sourceId, queued, notesImported, feedItemsCreated }`.
   * @throws ValidationError for input that fails {@link assertValidImport}.
   */
  async importMarkdown(content: string, metadata: { name?: string }): Promise<MarkdownImportResult> {
    const input = assertValidImport(content, metadata.name);

    const source = await upsertSource(this.db, { name: input.name, type: "markdown" });
    const notes = await connectorRegistry.get("markdown").import(source, { content: input.content });
    const stored = await upsertNotes(this.db, source.id, notes);
    const feedItemsCreated = await generateFeedItems(this.db, source.id, ["original"]);
    await updateSourceSyncedAt(this.db, source.id, new Date());

    return { sourceId: source.id, queued: false, notesImported: stored.length, feedItemsCreated };
  }

  /**
   * Lists cards for the intermediate feed.
   *
   * Cards hidden by a snooze are excluded for everyone, and a public request sees published cards
   * only. The order is fixed and there is no cursor: cursor pagination is Phase 4 work, so this is
   * deliberately narrower than core's `IFeedEngine.getFeed`.
   *
   * @param options - Page size and whether the request is public.
   * @returns Up to `limit` cards.
   * @throws ValidationError if `limit` is not an integer from 1 to {@link MAX_FEED_LIMIT}.
   */
  async listFeedItems(options: ListFeedOptions): Promise<FeedItem[]> {
    const limit = options.limit ?? DEFAULT_FEED_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEED_LIMIT || limit > MAX_CANDIDATE_LIMIT) {
      throw new ValidationError(`limit must be an integer from 1 to ${MAX_FEED_LIMIT}`, "VALIDATION_LIMIT");
    }
    return getFeedItemCandidates(this.db, {
      onlyPublished: options.isPublicRequest,
      excludeSnoozed: true,
      limit,
    });
  }

  /**
   * Reads one card.
   *
   * @param id - The card UUID. A malformed ID is simply not found.
   * @param options - `isPublicRequest` makes an unpublished card look like it does not exist.
   * @returns The card, or null.
   */
  async getFeedItem(id: string, options: { isPublicRequest: boolean }): Promise<FeedItem | null> {
    return getFeedItemById(this.db, id, { onlyPublished: options.isPublicRequest });
  }
}
