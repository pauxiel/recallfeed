import { ValidationError, type FeedItem } from "@recallfeed/core";
import { isUuid } from "@recallfeed/database";
import type { CandidatePosition } from "@recallfeed/database";
import type { IPageableStrategy, PageableStrategyName } from "./strategies";

/** The longest cursor accepted. A real one is about 120 characters; this bounds what a caller can send. */
export const MAX_CURSOR_LENGTH = 512;

/** The cursor format version (Spec 04 clarification). */
const VERSION = 1;

/** The decoded cursor: format version, the strategy it was issued for, the item's keys, and its id. */
type CursorData = { v: typeof VERSION; s: PageableStrategyName; k: number[]; id: string };

function invalid(): ValidationError {
  return new ValidationError("cursor is not a valid feed cursor for this feed", "VALIDATION_CURSOR");
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) {
    throw invalid();
  }
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw invalid();
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    throw invalid();
  }
}

/**
 * Encodes the position after `item` in `strategy`'s order as an opaque cursor (Spec 04 clarification):
 * unpadded base64url of `{"v":1,"s":<strategy>,"k":[<keys>],"id":<uuid>}`. Works in Workers, where
 * `Buffer` does not exist.
 *
 * @param strategy - The strategy the page was read in.
 * @param item - The last item of the page.
 * @returns The cursor for the next page.
 */
export function encodeCursor(strategy: IPageableStrategy, item: FeedItem): string {
  const data: CursorData = { v: VERSION, s: strategy.name, k: strategy.keys(item), id: item.id };
  return toBase64Url(JSON.stringify(data));
}

/**
 * Decodes a cursor into a keyset position for `strategy`.
 *
 * Strict: the cursor must be at most {@link MAX_CURSOR_LENGTH} characters of base64url, decode to
 * UTF-8 JSON with exactly the fields `v`, `s`, `k` and `id`, have version 1, name `strategy`, carry
 * exactly the strategy's number of keys as safe integers, and an `id` that is a UUID. Range checks on
 * the key values are left to the database layer, which knows each column's type. A cursor issued for
 * a different strategy is refused because its keys mean something else.
 *
 * @param cursor - The cursor a client sent back.
 * @param strategy - The strategy the feed is read in now.
 * @returns The position to read after.
 * @throws ValidationError `VALIDATION_CURSOR` for anything else. The cursor is never echoed.
 */
export function decodeCursor(cursor: string, strategy: IPageableStrategy): CandidatePosition {
  if (typeof cursor !== "string" || cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) {
    throw invalid();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(cursor));
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw invalid();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw invalid();
  }
  const fields = Object.keys(parsed).sort();
  if (fields.join(",") !== "id,k,s,v") {
    throw invalid();
  }
  const { v, s, k, id } = parsed as Record<string, unknown>;
  if (v !== VERSION || s !== strategy.name) {
    throw invalid();
  }
  if (!Array.isArray(k) || k.length !== strategy.keyCount || !k.every((key) => Number.isSafeInteger(key))) {
    throw invalid();
  }
  if (typeof id !== "string" || !isUuid(id)) {
    throw invalid();
  }
  return { keys: k as number[], id };
}
