import { Hono } from "hono";
import { ValidationError, isReviewAction } from "@recallfeed/core";
import type { ReviewAction } from "@recallfeed/core";
import { DEFAULT_SNOOZE_HOURS, FeedEngine } from "@recallfeed/feed-engine";
import { getDb } from "../db";
import { requireWriteAccess } from "../middleware/auth";
import { csrfProtection } from "../middleware/csrf";
import { decodeUtf8, readBounded } from "../request-body";
import { getSnoozeHours } from "../snooze-config";
import type { AppEnv } from "../types";

/**
 * The most body bytes read for a review request. The only field is a short action name, so 1 KB is
 * far more than any honest request needs, and it stops a caller from making the Worker buffer more.
 */
const MAX_REVIEW_BODY_BYTES = 1024;

/**
 * Reads the action from the request body: `application/json` with an `action` string naming one of
 * the six approved actions, matched exactly. Other fields are ignored.
 */
async function parseAction(request: Request): Promise<ReviewAction> {
  const type = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") {
    throw new ValidationError("Content-Type must be application/json", "VALIDATION_CONTENT_TYPE");
  }
  const bytes = await readBounded(request, MAX_REVIEW_BODY_BYTES);
  if (bytes === null) {
    throw new ValidationError(`Body is too large (maximum ${MAX_REVIEW_BODY_BYTES} bytes)`, "VALIDATION_SIZE");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(bytes));
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError("Body is not valid JSON", "VALIDATION_JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('Body must be a JSON object like {"action": "reviewed"}', "VALIDATION_JSON");
  }
  const action = (parsed as { action?: unknown }).action;
  if (!isReviewAction(action)) {
    throw new ValidationError(
      "action must be one of: reviewed, saved, unsaved, snoozed, published, unpublished",
      "VALIDATION_REVIEW_ACTION",
    );
  }
  return action;
}

/**
 * `PUT /feed/:id/review` (Spec 05): records a review action on a card and returns its new state.
 *
 * Writes are authorized exactly like import: the owner in a private deployment, an API key in a public
 * one, with the Origin check in private mode. Nothing is read from the body or the database for a
 * request that fails those checks. A repeated `reviewed` counts again, as the spec defines it, so
 * unlike most PUTs this one is not idempotent for that action.
 */
export const reviewRoutes = new Hono<AppEnv>();

reviewRoutes.put("/feed/:id/review", csrfProtection, requireWriteAccess, async (c) => {
  const action = await parseAction(c.req.raw);
  // Only `snoozed` needs the configured length, so a bad SNOOZE_DEFAULT_HOURS cannot break the other actions.
  const snoozeHours = action === "snoozed" ? getSnoozeHours(c.env) : DEFAULT_SNOOZE_HOURS;
  const item = await new FeedEngine(getDb(c)).recordReview(c.req.param("id") ?? "", action, { snoozeHours });
  return c.json({
    id: item.id,
    reviewCount: item.reviewCount,
    lastReviewedAt: item.lastReviewedAt,
    savedAt: item.savedAt,
    snoozedUntil: item.snoozedUntil,
    isPublished: item.isPublished,
  });
});
