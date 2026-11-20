import { Hono } from "hono";
import { ValidationError } from "@recallfeed/core";
import { DEFAULT_FEED_LIMIT, FeedEngine, MAX_FEED_LIMIT } from "@recallfeed/feed-engine";
import { getDb } from "../db";
import { errorResponse } from "../middleware/errors";
import { requireReadAccess } from "../middleware/auth";
import { sanitizeFeedItem } from "../middleware/response-filter";
import { getStrategyName } from "../strategy-config";
import type { AppEnv } from "../types";

/**
 * Parses the `limit` query parameter: a plain base-10 integer from 1 to 50, default 10.
 * Anything else is a 400 and not a silent clamp, so a client learns its request was wrong.
 */
function parseLimit(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_FEED_LIMIT;
  }
  if (!/^\d{1,3}$/.test(raw)) {
    throw new ValidationError(`limit must be an integer from 1 to ${MAX_FEED_LIMIT}`, "VALIDATION_LIMIT");
  }
  const limit = Number.parseInt(raw, 10);
  if (limit < 1 || limit > MAX_FEED_LIMIT) {
    throw new ValidationError(`limit must be an integer from 1 to ${MAX_FEED_LIMIT}`, "VALIDATION_LIMIT");
  }
  return limit;
}

/**
 * The feed reads: `GET /feed` (Tasks 20 and 27) and `GET /feed/:id` (Task 21).
 *
 * `GET /feed` returns `{ items, nextCursor }` in the order `DEFAULT_RESURFACING_STRATEGY` chooses
 * (`recency` by default, or `importance`). Send `nextCursor` back as `?cursor=` for the next page; it is
 * `null` on the last page. A malformed cursor, or one issued under a different strategy, is
 * `400 VALIDATION_CURSOR`. The cursor format is defined in the Spec 04 clarification.
 */
export const feedRoutes = new Hono<AppEnv>();

feedRoutes.get("/feed", requireReadAccess, async (c) => {
  const limit = parseLimit(c.req.query("limit"));
  const cursor = c.req.query("cursor");
  const strategy = getStrategyName(c.env);
  const isPublicRequest = c.get("isPublicRequest");
  const page = await new FeedEngine(getDb(c)).listFeedItems({
    limit,
    isPublicRequest,
    strategy,
    ...(cursor === undefined ? {} : { cursor }),
  });
  return c.json({
    items: page.items.map((item) => sanitizeFeedItem(item, isPublicRequest)),
    nextCursor: page.nextCursor,
  });
});

feedRoutes.get("/feed/:id", requireReadAccess, async (c) => {
  const isPublicRequest = c.get("isPublicRequest");
  const id = c.req.param("id") ?? "";
  const item = await new FeedEngine(getDb(c)).getFeedItem(id, { isPublicRequest });
  if (item === null) {
    // The same answer for "no such card", "malformed id", and "exists but is not published", so a
    // public caller cannot learn which unpublished IDs exist.
    return errorResponse(c, 404, "Feed item not found", "NOT_FOUND_FEED_ITEM");
  }
  return c.json(sanitizeFeedItem(item, isPublicRequest));
});
