import type { ReviewAction } from "./types";

/**
 * Every {@link ReviewAction}, as a runtime list.
 *
 * Request validation and the database both need to know the allowed actions at runtime, and a type
 * alone is erased. The `satisfies` clause rejects a name that is not a `ReviewAction`, and
 * {@link AllReviewActionsListed} fails to compile if a `ReviewAction` is missing from the list, so
 * the type and this list cannot drift apart.
 */
export const REVIEW_ACTIONS = [
  "reviewed",
  "saved",
  "unsaved",
  "snoozed",
  "published",
  "unpublished",
] as const satisfies readonly ReviewAction[];

/** Resolves to `true` only when {@link REVIEW_ACTIONS} lists every `ReviewAction`. */
export type AllReviewActionsListed = Exclude<ReviewAction, (typeof REVIEW_ACTIONS)[number]> extends never
  ? true
  : never;

/**
 * Narrows an unknown value to a {@link ReviewAction}.
 *
 * @param value - Anything, for example a field from a parsed request body.
 * @returns True only for one of the six approved action names, matched exactly (case-sensitive).
 */
export function isReviewAction(value: unknown): value is ReviewAction {
  return typeof value === "string" && (REVIEW_ACTIONS as readonly string[]).includes(value);
}
