import { ValidationError } from "@recallfeed/core";
import type { CardType, FeedItem } from "@recallfeed/core";
import type { DbClient } from "../client";
import { isUuid, toFeedItem } from "./rows";

/** The fields needed to create a card. New cards are unpublished, unreviewed, and unsnoozed. */
export type NewFeedItem = {
  noteId: string;
  sourceId: string;
  cardType: CardType;
  content: string;
  /** Always false for the "original" card type. */
  isAiGenerated: boolean;
};

/** The largest page `getFeedItemCandidates` returns. The API allows at most 50 (Spec 05). */
export const MAX_CANDIDATE_LIMIT = 200;

/**
 * Creates cards in a single statement. A card that already exists for its
 * `(note_id, card_type)` is left alone, so calling this again is safe.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param items - Cards to create.
 * @returns Only the cards this call created, which is empty on a repeat call.
 * @throws ValidationError if an "original" card is marked AI-generated, or an ID is not a UUID.
 */
export async function insertFeedItems(db: DbClient, items: readonly NewFeedItem[]): Promise<FeedItem[]> {
  if (items.length === 0) {
    return [];
  }
  for (const item of items) {
    if (!isUuid(item.noteId) || !isUuid(item.sourceId)) {
      throw new ValidationError("noteId and sourceId must be UUIDs", "VALIDATION_FEED_ITEM_ID");
    }
    if (item.cardType === "original" && item.isAiGenerated) {
      throw new ValidationError("An original card is never AI-generated", "VALIDATION_FEED_ITEM_AI");
    }
  }
  const payload = JSON.stringify(
    items.map((item) => ({
      note_id: item.noteId,
      source_id: item.sourceId,
      card_type: item.cardType,
      content: item.content,
      is_ai_generated: item.isAiGenerated,
    })),
  );
  const rows = await db.query(
    `INSERT INTO feed_items (note_id, source_id, card_type, content, is_ai_generated)
     SELECT r.note_id, r.source_id, r.card_type, r.content, r.is_ai_generated
       FROM jsonb_to_recordset($1::jsonb)
            AS r(note_id uuid, source_id uuid, card_type text, content text, is_ai_generated boolean)
     ON CONFLICT (note_id, card_type) DO NOTHING
     RETURNING *`,
    [payload],
  );
  return rows.map(toFeedItem);
}

/**
 * Creates one card. See {@link insertFeedItems}.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param item - The card to create.
 * @returns The new card, or null if the note already had a card of that type.
 */
export async function insertFeedItem(db: DbClient, item: NewFeedItem): Promise<FeedItem | null> {
  const [created] = await insertFeedItems(db, [item]);
  return created ?? null;
}

/** Filters for {@link getFeedItemCandidates}. */
export type CandidateOptions = {
  /** Only these card types. Omit for all types. */
  cardTypes?: readonly CardType[];
  /** True returns only `is_published = true` rows (public requests). */
  onlyPublished?: boolean;
  /** True hides cards whose `snoozed_until` is in the future. */
  excludeSnoozed?: boolean;
  /** Page size, 1 to {@link MAX_CANDIDATE_LIMIT}. */
  limit: number;
};

/**
 * Lists cards for the intermediate feed.
 *
 * Order is fixed and total: oldest effective review time first
 * (`COALESCE(last_reviewed_at, created_at)`), then `id`. This is the recency order of Spec 04
 * and exists so the same data always returns the same page. It is not strategy selection, and
 * there is no cursor: `afterId` and `afterSortKey` are deliberately absent until Task 27 settles
 * the cursor shape for multi-key orderings.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param options - Filters and page size.
 * @returns Up to `limit` cards.
 * @throws ValidationError if `limit` is not an integer from 1 to {@link MAX_CANDIDATE_LIMIT}.
 */
export async function getFeedItemCandidates(db: DbClient, options: CandidateOptions): Promise<FeedItem[]> {
  const { limit } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDIDATE_LIMIT) {
    throw new ValidationError(
      `limit must be an integer from 1 to ${MAX_CANDIDATE_LIMIT}`,
      "VALIDATION_LIMIT",
    );
  }
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.cardTypes !== undefined) {
    params.push([...options.cardTypes]);
    conditions.push(`card_type = ANY($${params.length}::text[])`);
  }
  if (options.onlyPublished === true) {
    conditions.push("is_published = TRUE");
  }
  if (options.excludeSnoozed === true) {
    conditions.push("(snoozed_until IS NULL OR snoozed_until <= NOW())");
  }
  params.push(limit);
  const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
  const rows = await db.query(
    `SELECT * FROM feed_items
      ${where}
      ORDER BY COALESCE(last_reviewed_at, created_at) ASC, id ASC
      LIMIT $${params.length}`,
    params,
  );
  return rows.map(toFeedItem);
}

/**
 * Reads one card by ID.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param id - The card UUID. A malformed ID returns null instead of failing in SQL.
 * @param options - `onlyPublished: true` makes an unpublished card look like it does not exist.
 * @returns The card, or null.
 */
export async function getFeedItemById(
  db: DbClient,
  id: string,
  options: { onlyPublished?: boolean } = {},
): Promise<FeedItem | null> {
  if (!isUuid(id)) {
    return null;
  }
  const rows = await db.query(
    options.onlyPublished === true
      ? "SELECT * FROM feed_items WHERE id = $1 AND is_published = TRUE"
      : "SELECT * FROM feed_items WHERE id = $1",
    [id],
  );
  const row = rows[0];
  return row === undefined ? null : toFeedItem(row);
}
