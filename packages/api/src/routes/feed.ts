import { Hono } from "hono";
import { ValidationError } from "@recallfeed/core";
import { DEFAULT_FEED_LIMIT, FeedEngine, MAX_FEED_LIMIT } from "@recallfeed/feed-engine";
import { getDb } from "../db";
import { errorResponse } from "../middleware/errors";
import { requireReadAccess } from "../middleware/auth";
import { sanitizeFeedItem } from "../middleware/response-filter";
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
 * The intermediate feed reads (Tasks 20 and 21): `GET /feed` and `GET /feed/:id`.
 *
 * `GET /feed` returns `{ items }` with no cursor. Cursor pagination and strategy ordering are
 * Phase 4 work, and the `cursor` query parameter is not accepted yet.
 */
export const feedRoutes = new Hono<AppEnv>();

feedRoutes.get("/feed", requireReadAccess, async (c) => {
  if (c.req.query("cursor") !== undefined) {
    // Ignoring it would hand the client the same first page forever and look like an endless feed.
    throw new ValidationError(
      "Cursor pagination is not available yet; this endpoint returns one page",
      "VALIDATION_CURSOR_UNSUPPORTED",
    );
  }
  const limit = parseLimit(c.req.query("limit"));
  const isPublicRequest = c.get("isPublicRequest");
  const items = await new FeedEngine(getDb(c)).listFeedItems({ limit, isPublicRequest });
  return c.json({ items: items.map((item) => sanitizeFeedItem(item, isPublicRequest)) });
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
