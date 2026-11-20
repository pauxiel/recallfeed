import type { FeedConfig, FeedItem } from "@recallfeed/core";
import { effectiveTime, rankByKeys } from "./ordering";
import type { IPageableStrategy } from "./ordering";

/**
 * Recency (Spec 04, Task 25): the card reviewed longest ago comes first, and a card never reviewed
 * counts from when it was created.
 *
 * Order: effective time (`lastReviewedAt ?? createdAt`, in milliseconds) ascending, then `id` ascending.
 * Cards snoozed past `now` are left out. This is the order the feed has used since Phase 2.
 */
export class RecencyStrategy implements IPageableStrategy {
  readonly name = "recency" as const;
  readonly keyCount = 1;

  keys(item: FeedItem): number[] {
    return [effectiveTime(item)];
  }

  rank(candidates: FeedItem[], _config: FeedConfig, now: Date): FeedItem[] {
    return rankByKeys(this, candidates, now);
  }
}
