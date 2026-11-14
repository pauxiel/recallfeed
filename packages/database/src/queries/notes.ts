import { ValidationError } from "@recallfeed/core";
import type { CardType, NormalizedNote, Note } from "@recallfeed/core";
import type { DbClient } from "../client";
import { isUuid, toNote } from "./rows";

/** A stored note and whether this call created it. */
export type UpsertedNote = {
  note: Note;
  /** True if the note is new; false if a note with the same `(sourceId, contentHash)` already existed. */
  created: boolean;
};

/**
 * Stores notes for one source in a single statement, deduplicating by `(source_id, content_hash)`.
 *
 * An existing note keeps its `content` forever (imported content is immutable). On a repeat import
 * only `title`, `metadata`, `imported_at`, and `updated_at` change. The same hash in a *different*
 * source is a different note, because deduplication is scoped to the source.
 *
 * One statement for any number of notes keeps a large import under the Workers subrequest limit.
 * Notes in the batch that share a hash are collapsed to the first, because PostgreSQL refuses to
 * update one row twice in a single statement.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param sourceId - The source every note belongs to.
 * @param notes - Normalized notes from a connector. Each `sourceId` must equal `sourceId`.
 * @returns One entry per distinct note, in input order.
 * @throws ValidationError if a note names a different source or `sourceId` is not a UUID.
 */
export async function upsertNotes(
  db: DbClient,
  sourceId: string,
  notes: readonly NormalizedNote[],
): Promise<UpsertedNote[]> {
  if (!isUuid(sourceId)) {
    throw new ValidationError("sourceId must be a UUID", "VALIDATION_SOURCE_ID");
  }
  const distinct = new Map<string, NormalizedNote>();
  for (const note of notes) {
    if (note.sourceId !== sourceId) {
      throw new ValidationError("Every note must belong to the source being imported", "VALIDATION_NOTE_SOURCE");
    }
    if (!distinct.has(note.contentHash)) {
      distinct.set(note.contentHash, note);
    }
  }
  if (distinct.size === 0) {
    return [];
  }
  const payload = JSON.stringify(
    [...distinct.values()].map((note) => ({
      title: note.title,
      content: note.content,
      content_hash: note.contentHash,
      metadata: note.metadata,
    })),
  );
  const rows = await db.query(
    `INSERT INTO notes (source_id, title, content, content_hash, metadata)
     SELECT $1::uuid, r.title, r.content, r.content_hash, r.metadata
       FROM jsonb_to_recordset($2::jsonb)
            AS r(title text, content text, content_hash text, metadata jsonb)
     ON CONFLICT (source_id, content_hash) DO UPDATE
        SET title = EXCLUDED.title,
            metadata = EXCLUDED.metadata,
            imported_at = NOW(),
            updated_at = NOW()
     RETURNING *, (xmax = 0) AS created`,
    [sourceId, payload],
  );
  const byHash = new Map(rows.map((row) => [String(row.content_hash), row]));
  const result: UpsertedNote[] = [];
  for (const hash of distinct.keys()) {
    const row = byHash.get(hash);
    if (row === undefined) {
      throw new Error("upsertNotes did not return a row for every note");
    }
    result.push({ note: toNote(row), created: row.created === true });
  }
  return result;
}

/**
 * Stores one note. See {@link upsertNotes} for the deduplication and immutability rules.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param note - A normalized note from a connector.
 * @returns The stored note and whether this call created it.
 */
export async function upsertNote(db: DbClient, note: NormalizedNote): Promise<UpsertedNote> {
  const [first] = await upsertNotes(db, note.sourceId, [note]);
  if (first === undefined) {
    throw new Error("upsertNote returned no row");
  }
  return first;
}

/**
 * Lists every note of a source, oldest import first.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param sourceId - The source UUID. A malformed ID returns an empty list.
 */
export async function getNotesBySourceId(db: DbClient, sourceId: string): Promise<Note[]> {
  if (!isUuid(sourceId)) {
    return [];
  }
  const rows = await db.query(
    "SELECT * FROM notes WHERE source_id = $1 ORDER BY imported_at ASC, id ASC",
    [sourceId],
  );
  return rows.map(toNote);
}

/**
 * Lists the notes of a source that do not yet have a card of the given type.
 *
 * This makes card generation idempotent and cheap: a repeat import returns an empty list.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param sourceId - The source UUID. A malformed ID returns an empty list.
 * @param cardType - The card type to look for.
 */
export async function getNotesMissingCardType(
  db: DbClient,
  sourceId: string,
  cardType: CardType,
): Promise<Note[]> {
  if (!isUuid(sourceId)) {
    return [];
  }
  const rows = await db.query(
    `SELECT n.*
       FROM notes n
      WHERE n.source_id = $1
        AND NOT EXISTS (
              SELECT 1 FROM feed_items f WHERE f.note_id = n.id AND f.card_type = $2
            )
      ORDER BY n.imported_at ASC, n.id ASC`,
    [sourceId, cardType],
  );
  return rows.map(toNote);
}
