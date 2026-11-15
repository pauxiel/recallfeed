import type { Source, SourceType } from "@recallfeed/core";
import type { DbClient } from "../client";
import { isUuid, toSource } from "./rows";

/** The fields `upsertSource` accepts. */
export type SourceInput = {
  name: string;
  type: SourceType;
  /** Non-secret, source-specific configuration. Defaults to an empty object. */
  config?: Record<string, string>;
  /** Defaults to true. */
  isActive?: boolean;
};

/**
 * Creates the source named `name` of type `type`, or updates it if it already exists.
 *
 * Spec 02 gives `sources` no unique index on `(name, type)`, so "upsert by name" cannot use
 * `ON CONFLICT`. Instead both statements run in one transaction behind a transaction-scoped
 * advisory lock keyed on the type and name. Concurrent upserts of the same source queue up
 * and all return the same row; no duplicate is created.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param input - The source to create or refresh.
 * @returns The stored source. Calling this twice with the same name and type returns the same `id`.
 */
export async function upsertSource(db: DbClient, input: SourceInput): Promise<Source> {
  const config = JSON.stringify(input.config ?? {});
  const isActive = input.isActive ?? true;
  const [, result] = await db.transaction([
    db.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [
      `source:${input.type}:${input.name}`,
    ]),
    db.query(
      `WITH existing AS (
         SELECT id FROM sources WHERE name = $1 AND type = $2 ORDER BY created_at, id LIMIT 1
       ), updated AS (
         UPDATE sources
            SET config = $3::jsonb, is_active = $4, updated_at = NOW()
          WHERE id = (SELECT id FROM existing)
          RETURNING *
       ), inserted AS (
         INSERT INTO sources (name, type, config, is_active)
         SELECT $1, $2, $3::jsonb, $4
          WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING *
       )
       SELECT * FROM updated UNION ALL SELECT * FROM inserted`,
      [input.name, input.type, config, isActive],
    ),
  ]);
  const row = result?.[0];
  if (row === undefined) {
    throw new Error("upsertSource returned no row");
  }
  return toSource(row);
}

/**
 * Reads one source by ID.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param id - The source UUID. A malformed ID returns null instead of failing in SQL.
 * @returns The source, or null if it does not exist.
 */
export async function getSourceById(db: DbClient, id: string): Promise<Source | null> {
  if (!isUuid(id)) {
    return null;
  }
  const rows = await db.query("SELECT * FROM sources WHERE id = $1", [id]);
  const row = rows[0];
  return row === undefined ? null : toSource(row);
}

/**
 * Records when a source was last imported.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param id - The source UUID.
 * @param syncedAt - The sync time to store.
 */
export async function updateSourceSyncedAt(db: DbClient, id: string, syncedAt: Date): Promise<void> {
  if (!isUuid(id)) {
    return;
  }
  await db.query("UPDATE sources SET last_synced_at = $2, updated_at = NOW() WHERE id = $1", [
    id,
    syncedAt.toISOString(),
  ]);
}
