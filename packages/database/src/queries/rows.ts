import type { CardType, FeedItem, Note, NoteMetadata, ReviewAction, ReviewEvent, Source, SourceType } from "@recallfeed/core";

/** A database row as the Neon driver returns it. */
export type Row = Record<string, unknown>;

/** True for a canonical UUID string. Used to answer "not found" for malformed IDs instead of failing in SQL. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function text(row: Row, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new TypeError(`Expected column "${column}" to be a string`);
  }
  return value;
}

function nullableText(row: Row, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  return text(row, column);
}

function bool(row: Row, column: string): boolean {
  const value = row[column];
  if (typeof value !== "boolean") {
    throw new TypeError(`Expected column "${column}" to be a boolean`);
  }
  return value;
}

function integer(row: Row, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new TypeError(`Expected column "${column}" to be an integer`);
  }
  return value;
}

function date(row: Row, column: string): Date {
  const value = row[column];
  if (!(value instanceof Date)) {
    throw new TypeError(`Expected column "${column}" to be a Date`);
  }
  return value;
}

function nullableDate(row: Row, column: string): Date | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  return date(row, column);
}

function jsonObject(row: Row, column: string): Record<string, unknown> {
  const value = row[column];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected column "${column}" to be a JSON object`);
  }
  return value as Record<string, unknown>;
}

/** Maps a `sources` row to the core `Source` type. */
export function toSource(row: Row): Source {
  const config: Record<string, string> = {};
  for (const [key, value] of Object.entries(jsonObject(row, "config"))) {
    config[key] = String(value);
  }
  return {
    id: text(row, "id"),
    name: text(row, "name"),
    type: text(row, "type") as SourceType,
    config,
    isActive: bool(row, "is_active"),
    lastSyncedAt: nullableDate(row, "last_synced_at"),
    createdAt: date(row, "created_at"),
    updatedAt: date(row, "updated_at"),
  };
}

/** Maps a `notes` row to the core `Note` type. */
export function toNote(row: Row): Note {
  return {
    id: text(row, "id"),
    sourceId: text(row, "source_id"),
    title: nullableText(row, "title"),
    content: text(row, "content"),
    contentHash: text(row, "content_hash"),
    metadata: jsonObject(row, "metadata") as NoteMetadata,
    importedAt: date(row, "imported_at"),
    updatedAt: date(row, "updated_at"),
  };
}

/** Maps a `feed_items` row to the core `FeedItem` type. */
export function toFeedItem(row: Row): FeedItem {
  return {
    id: text(row, "id"),
    noteId: text(row, "note_id"),
    sourceId: text(row, "source_id"),
    cardType: text(row, "card_type") as CardType,
    content: text(row, "content"),
    isAiGenerated: bool(row, "is_ai_generated"),
    isPublished: bool(row, "is_published"),
    reviewCount: integer(row, "review_count"),
    lastReviewedAt: nullableDate(row, "last_reviewed_at"),
    savedAt: nullableDate(row, "saved_at"),
    snoozedUntil: nullableDate(row, "snoozed_until"),
    createdAt: date(row, "created_at"),
    updatedAt: date(row, "updated_at"),
  };
}

/** Maps a `review_events` row to the core `ReviewEvent` type. */
export function toReviewEvent(row: Row): ReviewEvent {
  return {
    id: text(row, "id"),
    feedItemId: text(row, "feed_item_id"),
    action: text(row, "action") as ReviewAction,
    createdAt: date(row, "created_at"),
  };
}
