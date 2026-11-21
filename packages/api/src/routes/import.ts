import { Hono } from "hono";
import { MARKDOWN_MAX_BYTES } from "@recallfeed/connectors";
import { ValidationError } from "@recallfeed/core";
import { FeedEngine } from "@recallfeed/feed-engine";
import { getDb } from "../db";
import { getImportCardTypes } from "../card-types-config";
import { csrfProtection } from "../middleware/csrf";
import { requireWriteAccess } from "../middleware/auth";
import { decodeUtf8, readBounded } from "../request-body";
import type { AppEnv } from "../types";

/**
 * The most bytes of request body read before the import is refused.
 *
 * A JSON body escapes characters (`\n`, `\"`, `\uXXXX`), so a legal 100 KB document can be a good
 * deal larger on the wire. This hard cap stops a hostile or mistaken client from making the Worker
 * buffer an unbounded body; the exact 100 KB rule is then applied to the decoded content.
 */
const MAX_BODY_BYTES = 6 * MARKDOWN_MAX_BYTES + 4096;

type ImportBody = { content: string; name?: string };

async function parseBody(request: Request): Promise<ImportBody> {
  const type = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (type !== "text/markdown" && type !== "application/json") {
    throw new ValidationError("Content-Type must be text/markdown or application/json", "VALIDATION_CONTENT_TYPE");
  }
  const bytes = await readBounded(request, type === "text/markdown" ? MARKDOWN_MAX_BYTES + 1 : MAX_BODY_BYTES);
  if (bytes === null) {
    throw new ValidationError(
      `Content is too large (maximum ${MARKDOWN_MAX_BYTES} bytes)`,
      "VALIDATION_SIZE",
    );
  }
  const text = decodeUtf8(bytes);
  if (type === "text/markdown") {
    return { content: text };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError("Body is not valid JSON", "VALIDATION_JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError("JSON body must be an object with a content string", "VALIDATION_JSON");
  }
  const { content, name } = parsed as { content?: unknown; name?: unknown };
  if (typeof content !== "string") {
    throw new ValidationError("JSON body must include content as a string", "VALIDATION_JSON");
  }
  if (name !== undefined && typeof name !== "string") {
    throw new ValidationError("name must be a string", "VALIDATION_NAME");
  }
  return name === undefined ? { content } : { content, name };
}

/** `POST /import/markdown` (Spec 05). */
export const importRoutes = new Hono<AppEnv>();

importRoutes.post("/import/markdown", csrfProtection, requireWriteAccess, async (c) => {
  // Authorization has already passed. Nothing below runs for an unauthorized request, and the
  // body is not read for one. The card types are read first, so a misconfigured deployment writes nothing.
  const cardTypes = getImportCardTypes(c.env);
  const body = await parseBody(c.req.raw);
  const engine = new FeedEngine(getDb(c));
  const result = await engine.importMarkdown(
    body.content,
    body.name === undefined ? { cardTypes } : { name: body.name, cardTypes },
  );
  return c.json({
    sourceId: result.sourceId,
    queued: result.queued,
    notesImported: result.notesImported,
    feedItemsCreated: result.feedItemsCreated,
    // Only the caller who just passed the write check sees these. The IDs let it publish what it imported.
    feedItemIds: result.feedItemIds,
  });
});
