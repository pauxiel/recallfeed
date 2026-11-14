import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { createDb } from "../client";
import type { DbClient } from "../client";
import { configureLocalNeonHttp } from "../local-proxy";

const databaseUrl = env.TEST_DATABASE_URL;

/** Runs a query that must fail and returns what the database reported. */
async function failure(query: Promise<unknown>): Promise<{ message: string; code?: string; constraint?: string }> {
  try {
    await query;
  } catch (error) {
    const e = error as { message?: string; code?: string; constraint?: string };
    return { message: String(e.message), code: e.code, constraint: e.constraint };
  }
  throw new Error("expected the query to be rejected by the database");
}

describe.skipIf(databaseUrl === "")("schema, migrations, and named constraints (HTTP driver, workerd)", () => {
  let sql: DbClient;

  beforeAll(() => {
    configureLocalNeonHttp(databaseUrl);
    sql = createDb(databaseUrl);
  });

  /** Inserts a source and returns its id. */
  async function newSource(): Promise<string> {
    const rows = await sql`INSERT INTO sources (name, type) VALUES ('test source', 'markdown') RETURNING id`;
    return String(rows[0]?.id);
  }

  async function newNote(sourceId: string, hash: string): Promise<string> {
    const rows = await sql`
      INSERT INTO notes (source_id, content, content_hash) VALUES (${sourceId}, 'body', ${hash}) RETURNING id`;
    return String(rows[0]?.id);
  }

  describe("migration path", () => {
    it("applied 001_initial.sql on the first run and nothing on the second", () => {
      const runs = inject("migrationRuns");
      expect(runs).not.toBeNull();
      expect(runs?.first).toEqual({ applied: ["001_initial.sql"], skipped: [] });
      expect(runs?.second).toEqual({ applied: [], skipped: ["001_initial.sql"] });
    });

    it("recorded 001_initial.sql exactly once in _schema_migrations", async () => {
      const rows = await sql`SELECT filename, applied_at FROM _schema_migrations`;
      expect(rows.map((r) => r.filename)).toEqual(["001_initial.sql"]);
    });

    it("created all five tables", async () => {
      const rows = await sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`;
      expect(rows.map((r) => r.table_name)).toEqual([
        "_schema_migrations",
        "feed_items",
        "notes",
        "review_events",
        "sources",
      ]);
    });
  });

  describe("PostgreSQL features", () => {
    it("reports PostgreSQL 17", async () => {
      const rows = await sql`SHOW server_version`;
      expect(String(rows[0]?.server_version)).toMatch(/^17\./);
    });

    it("uses UUID, JSONB, and TIMESTAMPTZ column types from Spec 02", async () => {
      const rows = await sql`
        SELECT table_name, column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (
            ('sources','id'), ('sources','config'), ('sources','last_synced_at'), ('sources','created_at'),
            ('notes','id'), ('notes','source_id'), ('notes','metadata'), ('notes','imported_at'),
            ('feed_items','id'), ('feed_items','snoozed_until'), ('feed_items','saved_at'),
            ('review_events','id'), ('review_events','feed_item_id'), ('review_events','created_at'))`;
      const types = Object.fromEntries(rows.map((r) => [`${r.table_name}.${r.column_name}`, r.data_type]));
      expect(types).toEqual({
        "sources.id": "uuid",
        "sources.config": "jsonb",
        "sources.last_synced_at": "timestamp with time zone",
        "sources.created_at": "timestamp with time zone",
        "notes.id": "uuid",
        "notes.source_id": "uuid",
        "notes.metadata": "jsonb",
        "notes.imported_at": "timestamp with time zone",
        "feed_items.id": "uuid",
        "feed_items.snoozed_until": "timestamp with time zone",
        "feed_items.saved_at": "timestamp with time zone",
        "review_events.id": "uuid",
        "review_events.feed_item_id": "uuid",
        "review_events.created_at": "timestamp with time zone",
      });
    });

    it("round-trips JSONB and timestamptz values", async () => {
      const config = { databaseId: "abc", nested: { n: 1, list: ["a", "b"] } };
      const rows = await sql`
        INSERT INTO sources (name, type, config, last_synced_at)
        VALUES ('roundtrip', 'notion', ${JSON.stringify(config)}::jsonb, '2026-11-14T10:00:00-05:00')
        RETURNING config, last_synced_at`;
      expect(rows[0]?.config).toEqual(config);
      expect(new Date(String(rows[0]?.last_synced_at)).toISOString()).toBe("2026-11-14T15:00:00.000Z");
    });

    it("applies column defaults from Spec 02", async () => {
      const sourceId = await newSource();
      const noteId = await newNote(sourceId, "defaults-hash");
      const rows = await sql`
        INSERT INTO feed_items (note_id, source_id, card_type, content)
        VALUES (${noteId}, ${sourceId}, 'original', 'card') RETURNING is_published, is_ai_generated, review_count`;
      expect(rows[0]).toEqual({ is_published: false, is_ai_generated: false, review_count: 0 });
    });

    it("accepts parameters through sql.query() as the query layer will", async () => {
      const rows = await sql.query("SELECT $1::int + $2::int AS total", [2, 3]);
      expect(rows[0]?.total).toBe(5);
    });
  });

  describe("named indexes from Spec 02", () => {
    it("created every index with the exact name and shape", async () => {
      const rows = await sql`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname LIKE '%\\_idx' ORDER BY indexname`;
      const defs = Object.fromEntries(rows.map((r) => [r.indexname, String(r.indexdef)]));
      expect(Object.keys(defs)).toEqual([
        "feed_items_is_published_idx",
        "feed_items_last_reviewed_at_idx",
        "feed_items_note_card_type_idx",
        "feed_items_note_id_idx",
        "feed_items_snoozed_until_idx",
        "feed_items_source_id_idx",
        "notes_imported_at_idx",
        "notes_source_content_hash_idx",
        "notes_source_id_idx",
        "review_events_created_at_idx",
        "review_events_feed_item_id_idx",
      ]);
      expect(defs.notes_source_content_hash_idx).toContain("CREATE UNIQUE INDEX");
      expect(defs.notes_source_content_hash_idx).toContain("(source_id, content_hash)");
      expect(defs.feed_items_note_card_type_idx).toContain("CREATE UNIQUE INDEX");
      expect(defs.feed_items_note_card_type_idx).toContain("(note_id, card_type)");
      // PostgreSQL stores predicates in canonical form, so `WHERE is_published = TRUE`
      // in the migration is reported as `WHERE (is_published = true)`.
      expect(defs.feed_items_is_published_idx).toContain("WHERE (is_published = true)");
      expect(defs.feed_items_snoozed_until_idx).toContain("WHERE (snoozed_until IS NOT NULL)");
      expect(defs.feed_items_last_reviewed_at_idx).toContain("NULLS FIRST");
      expect(defs.notes_imported_at_idx).toContain("imported_at DESC");
    });
  });

  describe("constraint violations name the constraint", () => {
    it("rejects a duplicate (source_id, content_hash) with notes_source_content_hash_idx", async () => {
      const sourceId = await newSource();
      await newNote(sourceId, "same-hash");
      const error = await failure(newNote(sourceId, "same-hash"));
      expect(error.code).toBe("23505");
      expect(error.constraint).toBe("notes_source_content_hash_idx");
      expect(error.message).toContain("notes_source_content_hash_idx");
    });

    it("allows the same content_hash in a different source", async () => {
      const [a, b] = [await newSource(), await newSource()];
      await newNote(a, "shared-hash");
      await expect(newNote(b, "shared-hash")).resolves.toBeTypeOf("string");
    });

    it("rejects a second card of the same type with feed_items_note_card_type_idx", async () => {
      const sourceId = await newSource();
      const noteId = await newNote(sourceId, "card-hash");
      await sql`INSERT INTO feed_items (note_id, source_id, card_type, content) VALUES (${noteId}, ${sourceId}, 'summary', 'one')`;
      const error = await failure(
        sql`INSERT INTO feed_items (note_id, source_id, card_type, content) VALUES (${noteId}, ${sourceId}, 'summary', 'two')`,
      );
      expect(error.code).toBe("23505");
      expect(error.constraint).toBe("feed_items_note_card_type_idx");
      expect(error.message).toContain("feed_items_note_card_type_idx");
    });

    it("rejects values outside the CHECK lists (auto-named by PostgreSQL)", async () => {
      const sourceId = await newSource();
      const noteId = await newNote(sourceId, "check-hash");
      const badType = await failure(sql`INSERT INTO sources (name, type) VALUES ('x', 'rss')`);
      const badCard = await failure(
        sql`INSERT INTO feed_items (note_id, source_id, card_type, content) VALUES (${noteId}, ${sourceId}, 'poem', 'x')`,
      );
      const itemId = String(
        (await sql`INSERT INTO feed_items (note_id, source_id, card_type, content) VALUES (${noteId}, ${sourceId}, 'original', 'x') RETURNING id`)[0]?.id,
      );
      const badAction = await failure(
        sql`INSERT INTO review_events (feed_item_id, action) VALUES (${itemId}, 'deleted')`,
      );
      expect([badType.code, badCard.code, badAction.code]).toEqual(["23514", "23514", "23514"]);
      expect([badType.constraint, badCard.constraint, badAction.constraint]).toEqual([
        "sources_type_check",
        "feed_items_card_type_check",
        "review_events_action_check",
      ]);
    });

    it("rejects a note whose source does not exist (foreign key)", async () => {
      const error = await failure(newNote("00000000-0000-0000-0000-000000000000", "orphan"));
      expect(error.code).toBe("23503");
      expect(error.constraint).toBe("notes_source_id_fkey");
    });
  });

  describe("cascading deletes", () => {
    it("deleting a source removes its notes, feed items, and review events", async () => {
      const sourceId = await newSource();
      const noteId = await newNote(sourceId, "cascade-hash");
      const itemId = String(
        (await sql`INSERT INTO feed_items (note_id, source_id, card_type, content) VALUES (${noteId}, ${sourceId}, 'original', 'x') RETURNING id`)[0]?.id,
      );
      await sql`INSERT INTO review_events (feed_item_id, action) VALUES (${itemId}, 'reviewed')`;

      await sql`DELETE FROM sources WHERE id = ${sourceId}`;

      const [notes, items, events] = await Promise.all([
        sql`SELECT 1 FROM notes WHERE id = ${noteId}`,
        sql`SELECT 1 FROM feed_items WHERE id = ${itemId}`,
        sql`SELECT 1 FROM review_events WHERE feed_item_id = ${itemId}`,
      ]);
      expect([notes.length, items.length, events.length]).toEqual([0, 0, 0]);
    });
  });
});
