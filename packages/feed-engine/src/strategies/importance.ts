import type { FeedConfig, FeedItem } from "@recallfeed/core";
import { effectiveTime, rankByKeys } from "./ordering";
import type { IPageableStrategy } from "./ordering";

/**
 * Importance (Spec 04, Task 26): the least-reviewed card comes first, so unreviewed cards get attention.
 *
 * Order: `reviewCount` ascending, then effective time (`lastReviewedAt ?? createdAt`, in milliseconds)
 * ascending, then `id` ascending. There is no computed score. Cards snoozed past `now` are left out.
 */
export class ImportanceStrategy implements IPageableStrategy {
  readonly name = "importance" as const;
  readonly keyCount = 2;

  keys(item: FeedItem): number[] {
    return [item.reviewCount, effectiveTime(item)];
  }

  rank(candidates: FeedItem[], _config: FeedConfig, now: Date): FeedItem[] {
    return rankByKeys(this, candidates, now);
  }
}
