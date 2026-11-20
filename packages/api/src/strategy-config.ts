import { RecallFeedError } from "@recallfeed/core";
import { DEFAULT_STRATEGY, isPageableStrategyName } from "@recallfeed/feed-engine";
import type { PageableStrategyName } from "@recallfeed/feed-engine";
import type { Env } from "./types";

/**
 * Reads which resurfacing strategy orders `GET /feed`, from `DEFAULT_RESURFACING_STRATEGY`.
 *
 * Unset or blank means `recency`, the order the feed has used since Phase 2. `importance` is the other
 * implemented strategy. Any other value, including `due_review` (not implemented yet) and differently
 * cased names, is a deployment mistake: it fails with a generic 500 instead of silently using an order
 * nobody chose. The value is never echoed or logged.
 *
 * @param env - The Worker environment.
 * @returns The strategy name.
 * @throws RecallFeedError `INTERNAL_CONFIG` if the variable is set to anything else.
 */
export function getStrategyName(env: Pick<Env, "DEFAULT_RESURFACING_STRATEGY">): PageableStrategyName {
  const raw = env.DEFAULT_RESURFACING_STRATEGY;
  if (raw === undefined || raw === "") {
    return DEFAULT_STRATEGY;
  }
  if (!isPageableStrategyName(raw)) {
    throw new RecallFeedError("DEFAULT_RESURFACING_STRATEGY is not an implemented strategy", "INTERNAL_CONFIG");
  }
  return raw;
}
