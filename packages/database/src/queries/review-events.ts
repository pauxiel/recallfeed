import { NotFoundError, ValidationError, isReviewAction } from "@recallfeed/core";
import type { FeedItem, ReviewAction, ReviewEvent } from "@recallfeed/core";
import type { DbClient } from "../client";
import { isUuid, toFeedItem, toReviewEvent } from "./rows";

/** The foreign key from `review_events` to `feed_items` (migration 001). */
const FEED_ITEM_FOREIGN_KEY = "review_events_feed_item_id_fkey";

/**
 * The longest snooze `applyReviewAction` accepts: one year, in hours. It keeps the interval
 * arithmetic far from any overflow and rejects a nonsensical value instead of storing it.
 */
export const MAX_SNOOZE_HOURS = 8760;

/** True when `error` is PostgreSQL's foreign-key violation on the review-events link to a card. */
function isMissingFeedItem(error: unknown): boolean {
  const failure = error as { code?: unknown; constraint?: unknown } | null;
  return failure?.code === "23503" && failure.constraint === FEED_ITEM_FOREIGN_KEY;
}

function assertAction(action: unknown): asserts action is ReviewAction {
  if (!isReviewAction(action)) {
    throw new ValidationError("Unknown review action", "VALIDATION_REVIEW_ACTION");
  }
}

/**
 * Appends one entry to the review log.
 *
 * The log is immutable: this module deliberately has no function that updates or deletes an event.
 * A card's own state is changed by {@link applyReviewAction}, which also logs, in one statement.
 * This function is the plain log insert, for callers that record an event without changing a card.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param event - The card the action was taken on, and the action.
 * @returns The stored event.
 * @throws ValidationError if the ID is not a UUID or the action is not one of the six approved ones.
 * @throws NotFoundError if no card has that ID (the foreign key refuses the row).
 */
export async function insertReviewEvent(
  db: DbClient,
  event: { feedItemId: string; action: ReviewAction },
): Promise<ReviewEvent> {
  if (!isUuid(event.feedItemId)) {
    throw new ValidationError("feedItemId must be a UUID", "VALIDATION_FEED_ITEM_ID");
  }
  assertAction(event.action);
  try {
    const [row] = await db.query(
      "INSERT INTO review_events (feed_item_id, action) VALUES ($1, $2) RETURNING *",
      [event.feedItemId, event.action],
    );
    if (row === undefined) {
      throw new Error("review event insert returned no row");
    }
    return toReviewEvent(row);
  } catch (error) {
    if (isMissingFeedItem(error)) {
      throw new NotFoundError("Feed item not found", "NOT_FOUND_FEED_ITEM");
    }
    throw error;
  }
}

/**
 * Lists a card's review events, oldest first.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param feedItemId - The card's ID. A malformed ID has no events.
 * @returns The events, in the order they were recorded (`created_at`, then `id`).
 */
export async function listReviewEventsByFeedItem(db: DbClient, feedItemId: string): Promise<ReviewEvent[]> {
  if (!isUuid(feedItemId)) {
    return [];
  }
  const rows = await db.query(
    "SELECT * FROM review_events WHERE feed_item_id = $1 ORDER BY created_at ASC, id ASC",
    [feedItemId],
  );
  return rows.map(toReviewEvent);
}

/**
 * The change each action makes to its card. These are fixed fragments, one per action, so request
 * data never becomes SQL text; the `Record` type makes a missing action a compile error. Times come
 * from the database clock (`NOW()`), the same source as every `created_at`, so a card's
 * `last_reviewed_at` equals its event's `created_at`.
 */
const STATE_CHANGE: Record<ReviewAction, string> = {
  reviewed: "review_count = review_count + 1, last_reviewed_at = NOW()",
  saved: "saved_at = NOW()",
  unsaved: "saved_at = NULL",
  snoozed: "snoozed_until = NOW() + make_interval(hours => $3::int)",
  published: "is_published = TRUE",
  unpublished: "is_published = FALSE",
};

/**
 * Applies a review action to a card and logs it, atomically.
 *
 * One statement updates the card and inserts the event, so either both happen or neither does. A card
 * that does not exist changes nothing and logs nothing, and the caller learns that from `null` instead
 * of a foreign-key error. Counters use `review_count + 1` in SQL, so concurrent reviews all count.
 *
 * Actions: `reviewed` adds one to `review_count` and sets `last_reviewed_at`; `saved` sets `saved_at`;
 * `unsaved` clears it; `snoozed` sets `snoozed_until` to now plus `snoozeHours`; `published` and
 * `unpublished` set `is_published`. Repeating an action is allowed and logs again.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param feedItemId - The card's ID. A malformed ID is simply not found.
 * @param action - One of the six approved actions.
 * @param options - `snoozeHours` is the snooze length for `snoozed`, a whole number from 1 to
 * {@link MAX_SNOOZE_HOURS}. It is ignored by other actions.
 * @returns The updated card, or null if there is no card with that ID.
 * @throws ValidationError for an unknown action, or for a `snoozed` call with an invalid `snoozeHours`.
 */
export async function applyReviewAction(
  db: DbClient,
  feedItemId: string,
  action: ReviewAction,
  options: { snoozeHours: number },
): Promise<FeedItem | null> {
  assertAction(action);
  const params: unknown[] = [feedItemId, action];
  if (action === "snoozed") {
    const hours = options.snoozeHours;
    if (!Number.isInteger(hours) || hours < 1 || hours > MAX_SNOOZE_HOURS) {
      throw new ValidationError(
        `snoozeHours must be a whole number from 1 to ${MAX_SNOOZE_HOURS}`,
        "VALIDATION_SNOOZE_HOURS",
      );
    }
    params.push(hours);
  }
  if (!isUuid(feedItemId)) {
    return null;
  }
  const rows = await db.query(
    `WITH changed AS (
       UPDATE feed_items SET ${STATE_CHANGE[action]}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
     ), logged AS (
       INSERT INTO review_events (feed_item_id, action)
       SELECT id, $2::text FROM changed
       RETURNING id
     )
     SELECT * FROM changed`,
    params,
  );
  const [row] = rows;
  return row === undefined ? null : toFeedItem(row);
}
