import { ValidationError } from "@recallfeed/core";
import { ImportanceStrategy } from "./importance";
import type { IPageableStrategy, PageableStrategyName } from "./ordering";
import { RecencyStrategy } from "./recency";

const STRATEGIES: Record<PageableStrategyName, IPageableStrategy> = {
  recency: new RecencyStrategy(),
  importance: new ImportanceStrategy(),
};

/** The strategy used when a deployment does not choose one. It keeps the Phase 2 feed order. */
export const DEFAULT_STRATEGY: PageableStrategyName = "recency";

/** True for a strategy name this phase implements, matched exactly. */
export function isPageableStrategyName(value: unknown): value is PageableStrategyName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(STRATEGIES, value);
}

/**
 * Looks up an implemented strategy by name.
 *
 * @param name - `recency` or `importance`.
 * @returns The strategy.
 * @throws ValidationError `VALIDATION_STRATEGY` for any other name, including `due_review`, which is
 * not implemented yet.
 */
export function getStrategy(name: string): IPageableStrategy {
  if (!isPageableStrategyName(name)) {
    throw new ValidationError("Unknown or unimplemented resurfacing strategy", "VALIDATION_STRATEGY");
  }
  return STRATEGIES[name];
}

export { ImportanceStrategy } from "./importance";
export { RecencyStrategy } from "./recency";
export { compareByKeys, effectiveTime, isSnoozed } from "./ordering";
export type { IPageableStrategy, PageableStrategyName } from "./ordering";
