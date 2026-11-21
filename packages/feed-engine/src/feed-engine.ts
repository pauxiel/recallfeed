import { NotFoundError, ValidationError, isReviewAction } from "@recallfeed/core";
import type { CardType, FeedItem, ImportResult, ReviewAction } from "@recallfeed/core";
import { connectorRegistry } from "@recallfeed/connectors";
import {
  MAX_CANDIDATE_LIMIT,
  applyReviewAction,
  getFeedItemById,
  getFeedItemCandidates,
  updateSourceSyncedAt,
  upsertNotes,
  upsertSource,
} from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";
import { assertGeneratableCardTypes, generateFeedItems } from "./card-generator";
import { decodeCursor, encodeCursor } from "./cursor";
import { DEFAULT_STRATEGY, getStrategy } from "./strategies";
import { assertValidImport } from "./validation";

/** The most cards one intermediate feed request returns (Spec 05). */
export const MAX_FEED_LIMIT = 50;

/** The page size when a request does not give one (Spec 05 and Task 20). */
export const DEFAULT_FEED_LIMIT = 10;

/** How long a `snoozed` action hides a card when the deployment does not say otherwise (Spec 04). */
export const DEFAULT_SNOOZE_HOURS = 24;

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
  /** `recency` or `importance`. Defaults to `recency`, the Phase 2 order. */
  strategy?: string;
  /** The `nextCursor` of the previous page. Omit for the first page. */
  cursor?: string;
};

/** One page of the feed. */
export type FeedItemsPage = {
  items: FeedItem[];
  /** Pass this as `cursor` to read the next page; null when there are no more cards. */
  nextCursor: string | null;
};

/**
 * Coordinates Markdown import, the intermediate feed reads, and review actions.
 *
 * This is a request-scoped object: build one per request from `createDb(env.DATABASE_URL)`. It
 * implements the `importMarkdown` and `recordReview` parts of core's `IFeedEngine`. The Notion and
 * strategy based `getFeed` methods arrive in later phases, and no AI or queue is involved here.
 */
export class FeedEngine {
  constructor(private readonly db: DbClient) {}

  /**
   * Imports Markdown: source, notes, then cards of the requested types.
   *
   * Each step is idempotent, so a request that fails partway is safe to retry and a repeat import
   * of the same text changes nothing but timestamps. The whole import uses a fixed handful of
   * database requests however many notes the text holds (one more per extra card type), which keeps
   * it under the Workers subrequest limit.
   *
   * @param content - The Markdown text, 10 bytes to 100 KB.
   * @param metadata - `name` identifies the source. Importing under the same name again reuses it,
   * so notes deduplicate within that source and not across sources. `cardTypes` is what
   * `parseImportCardTypes` returns; omitted, only `original` cards are created. Re-importing with
   * more types adds the missing cards to notes that already exist.
   * @returns Spec 05's `{ sourceId, queued, notesImported, feedItemsCreated }`.
   * @throws ValidationError for input that fails {@link assertValidImport}, or a card type without a
   * generator.
   */
  async importMarkdown(
    content: string,
    metadata: { name?: string; cardTypes?: readonly CardType[] },
  ): Promise<MarkdownImportResult> {
    const input = assertValidImport(content, metadata.name);
    const cardTypes = metadata.cardTypes ?? ["original"];
    // Checked before the first write, so an unsupported type leaves the database untouched.
    assertGeneratableCardTypes(cardTypes);

    const source = await upsertSource(this.db, { name: input.name, type: "markdown" });
    const notes = await connectorRegistry.get("markdown").import(source, { content: input.content });
    const stored = await upsertNotes(this.db, source.id, notes);
    const feedItemsCreated = await generateFeedItems(this.db, source.id, cardTypes);
    await updateSourceSyncedAt(this.db, source.id, new Date());

    return { sourceId: source.id, queued: false, notesImported: stored.length, feedItemsCreated };
  }

  /**
   * Reads one page of the feed in a strategy's order (Spec 04 clarification).
   *
   * `recency` orders by effective time then `id`; `importance` by `reviewCount`, effective time, then
   * `id`. Cards hidden by a snooze are excluded for everyone, and a public request sees published
   * cards only. The database orders and slices the page, and the cursor carries every ordering key
   * plus `id`, so walking the pages returns each card once even when many tie. It reads `limit + 1`
   * rows to know whether another page exists. This is narrower than core's `IFeedEngine.getFeed`: it
   * takes a strategy name, not a whole `FeedConfig`, and returns no `total`.
   *
   * @param options - Page size, public flag, strategy and cursor.
   * @returns The page and the cursor for the next one, or `nextCursor: null` at the end.
   * @throws ValidationError `VALIDATION_LIMIT` for a bad limit, `VALIDATION_STRATEGY` for an unknown
   * strategy, `VALIDATION_CURSOR` for a cursor that is malformed or was issued for another strategy.
   */
  async listFeedItems(options: ListFeedOptions): Promise<FeedItemsPage> {
    const limit = options.limit ?? DEFAULT_FEED_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEED_LIMIT || limit + 1 > MAX_CANDIDATE_LIMIT) {
      throw new ValidationError(`limit must be an integer from 1 to ${MAX_FEED_LIMIT}`, "VALIDATION_LIMIT");
    }
    const strategy = getStrategy(options.strategy ?? DEFAULT_STRATEGY);
    const after = options.cursor === undefined ? undefined : decodeCursor(options.cursor, strategy);
    const rows = await getFeedItemCandidates(this.db, {
      onlyPublished: options.isPublicRequest,
      excludeSnoozed: true,
      order: strategy.name,
      limit: limit + 1,
      ...(after === undefined ? {} : { after }),
    });
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last !== undefined ? encodeCursor(strategy, last) : null;
    return { items, nextCursor };
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

  /**
   * Records a review action on a card: changes the card and logs the event in one statement.
   *
   * `reviewed` counts a review, `saved` and `unsaved` set and clear the saved time, `snoozed` hides the
   * card from every feed for `snoozeHours`, and `published` and `unpublished` control whether anonymous
   * visitors can see it. Repeating an action is allowed and logged again. Authorization is the
   * caller's job: this method trusts that the request was already allowed to write.
   *
   * @param feedItemId - The card's UUID. A malformed ID is simply not found.
   * @param action - One of the six approved actions, matched exactly.
   * @param options - `snoozeHours` is the snooze length, a whole number from 1 to 8760. Only `snoozed`
   * uses it.
   * @returns The updated card.
   * @throws ValidationError for an unknown action, or an unusable `snoozeHours` with `snoozed`.
   * @throws NotFoundError if there is no such card. Nothing is changed or logged in that case.
   */
  async recordReview(feedItemId: string, action: ReviewAction, options: { snoozeHours: number }): Promise<FeedItem> {
    if (!isReviewAction(action)) {
      throw new ValidationError("Unknown review action", "VALIDATION_REVIEW_ACTION");
    }
    const updated = await applyReviewAction(this.db, feedItemId, action, options);
    if (updated === null) {
      throw new NotFoundError("Feed item not found", "NOT_FOUND_FEED_ITEM");
    }
    return updated;
  }
}
