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

/** The orders the feed can be read in (the Spec 04 clarification). `due_review` is not implemented. */
export type CandidateOrder = "recency" | "importance";

/**
 * A keyset position: the ordering keys and `id` of the last card of the previous page. The next page
 * starts strictly after it. `keys` has one integer for recency (effective time in milliseconds) and
 * two for importance (`reviewCount`, then effective time).
 */
export type CandidatePosition = { keys: readonly number[]; id: string };

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
  /** The order. Defaults to `recency`, the order the feed has used since Phase 2. */
  order?: CandidateOrder;
  /** Return only cards that come strictly after this position in `order`. */
  after?: CandidatePosition;
};

/**
 * The effective time of a row in whole milliseconds, rounded down. TypeScript's
 * `(lastReviewedAt ?? createdAt).getTime()` gives the same value for every row (Spec 04 clarification).
 */
const EFFECTIVE_MS = "floor(EXTRACT(EPOCH FROM COALESCE(last_reviewed_at, created_at)) * 1000)::bigint";

/**
 * Each order's key expressions, in order, before the final `id`. These are fixed SQL fragments: no
 * request data ever becomes SQL text, and the cursor's values are bound as parameters.
 */
const ORDER_KEYS: Record<CandidateOrder, readonly { sql: string; type: "bigint" | "int"; min: number; max: number }[]> = {
  recency: [{ sql: EFFECTIVE_MS, type: "bigint", min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }],
  importance: [
    // review_count is a 32-bit integer and never negative.
    { sql: "review_count", type: "int", min: 0, max: 2147483647 },
    { sql: EFFECTIVE_MS, type: "bigint", min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
  ],
};

function assertPosition(order: CandidateOrder, after: CandidatePosition): void {
  const keys = ORDER_KEYS[order];
  const expected = keys.length;
  if (
    after.keys.length !== expected ||
    !after.keys.every((key, i) => Number.isSafeInteger(key) && key >= (keys[i]?.min ?? 0) && key <= (keys[i]?.max ?? 0)) ||
    !isUuid(after.id)
  ) {
    throw new ValidationError(`A ${order} position needs ${expected} integer keys and a UUID`, "VALIDATION_CURSOR");
  }
}

/**
 * Lists cards in a strategy's order, one keyset page at a time.
 *
 * `recency` orders by effective time (`lastReviewedAt ?? createdAt`, whole milliseconds) then `id`;
 * `importance` by `review_count`, then effective time, then `id`. All ascending, so each order is
 * total and repeatable. With `after`, only cards whose key tuple is strictly greater than the given
 * position are returned, using a row comparison, so a page boundary never skips or repeats a card
 * even when many cards tie on the leading keys.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param options - Filters, page size, order and position.
 * @returns Up to `limit` cards, in order.
 * @throws ValidationError if `limit` is not an integer from 1 to {@link MAX_CANDIDATE_LIMIT}, or
 * `after` does not fit the order.
 */
export async function getFeedItemCandidates(db: DbClient, options: CandidateOptions): Promise<FeedItem[]> {
  const { limit } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDIDATE_LIMIT) {
    throw new ValidationError(
      `limit must be an integer from 1 to ${MAX_CANDIDATE_LIMIT}`,
      "VALIDATION_LIMIT",
    );
  }
  const order = options.order ?? "recency";
  const keys = ORDER_KEYS[order];
  if (keys === undefined) {
    throw new ValidationError("Unknown feed order", "VALIDATION_STRATEGY");
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
  if (options.after !== undefined) {
    assertPosition(order, options.after);
    const placeholders = options.after.keys.map((value, i) => {
      params.push(String(value));
      return `$${params.length}::${keys[i]?.type ?? "bigint"}`;
    });
    params.push(options.after.id);
    placeholders.push(`$${params.length}::uuid`);
    conditions.push(`(${[...keys.map((key) => key.sql), "id"].join(", ")}) > (${placeholders.join(", ")})`);
  }
  params.push(limit);
  const where = conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`;
  const orderBy = [...keys.map((key) => `${key.sql} ASC`), "id ASC"].join(", ");
  const rows = await db.query(
    `SELECT * FROM feed_items
      ${where}
      ORDER BY ${orderBy}
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
