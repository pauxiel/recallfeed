import type { FeedItem, IResurfacingStrategy } from "@recallfeed/core";

/** The strategies this phase implements. `due_review` is not implemented yet. */
export type PageableStrategyName = "recency" | "importance";

/**
 * A resurfacing strategy whose order can be paged with a keyset cursor (Spec 04 clarification).
 *
 * `keys` returns the item's ordering keys, every key except the final `id` tie-breaker, in order. The
 * database applies the same order in SQL. `rank` applies it in memory, and a test proves the two agree.
 */
export interface IPageableStrategy extends IResurfacingStrategy {
  readonly name: PageableStrategyName;
  /** How many integer keys precede `id`: 1 for recency, 2 for importance. */
  readonly keyCount: number;
  /** The item's ordering keys, all integers, excluding `id`. */
  keys(item: FeedItem): number[];
}

/**
 * The effective time of a card: `lastReviewedAt ?? createdAt`, in whole milliseconds since the epoch.
 *
 * This equals the database's `floor(EXTRACT(EPOCH FROM COALESCE(last_reviewed_at, created_at)) * 1000)`
 * for every value, including dates before 1970. The driver truncates the stored microseconds to
 * milliseconds, which for an instant is the same as rounding down.
 *
 * @param item - A card.
 * @returns Milliseconds since 1970-01-01T00:00:00Z, rounded down.
 */
export function effectiveTime(item: Pick<FeedItem, "lastReviewedAt" | "createdAt">): number {
  return (item.lastReviewedAt ?? item.createdAt).getTime();
}

/** True if a card is snoozed past `now` and must not appear in a feed. */
export function isSnoozed(item: Pick<FeedItem, "snoozedUntil">, now: Date): boolean {
  return item.snoozedUntil !== null && item.snoozedUntil.getTime() > now.getTime();
}

/**
 * Compares two cards by key tuple, then by `id`, all ascending.
 *
 * `id` is compared as a string. PostgreSQL compares UUIDs byte by byte, which for canonical lowercase
 * UUIDs is the same order as comparing the strings.
 */
export function compareByKeys(strategy: Pick<IPageableStrategy, "keys">, a: FeedItem, b: FeedItem): number {
  const ka = strategy.keys(a);
  const kb = strategy.keys(b);
  for (let i = 0; i < ka.length; i += 1) {
    const difference = (ka[i] as number) - (kb[i] as number);
    if (difference !== 0) {
      return difference;
    }
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The shared `rank` behavior: drops snoozed cards, then sorts by the strategy's keys and `id`.
 * The input array is not changed.
 */
export function rankByKeys(strategy: Pick<IPageableStrategy, "keys">, candidates: readonly FeedItem[], now: Date): FeedItem[] {
  return candidates.filter((item) => !isSnoozed(item, now)).sort((a, b) => compareByKeys(strategy, a, b));
}
