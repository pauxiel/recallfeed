import { describe, expect, it } from "vitest";
import { getSourceById, updateSourceSyncedAt, upsertSource } from "../sources";
import { databaseUrl, testDb, uniqueName } from "./helpers";

describe.skipIf(databaseUrl === "")("source queries (real PostgreSQL through the proxy)", () => {
  it("creates a source with the Spec 01 shape", async () => {
    const db = testDb();
    const name = uniqueName("create");
    const source = await upsertSource(db, { name, type: "markdown" });

    expect(source).toMatchObject({
      name,
      type: "markdown",
      config: {},
      isActive: true,
      lastSyncedAt: null,
    });
    expect(source.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(source.createdAt).toBeInstanceOf(Date);
    expect(source.updatedAt).toBeInstanceOf(Date);
  });

  it("is idempotent: the same name and type returns the same id and does not add a row", async () => {
    const db = testDb();
    const name = uniqueName("idempotent");
    const first = await upsertSource(db, { name, type: "markdown" });
    const second = await upsertSource(db, { name, type: "markdown" });

    expect(second.id).toBe(first.id);
    expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
    const rows = await db.query("SELECT count(*)::int AS n FROM sources WHERE name = $1", [name]);
    expect(rows[0]?.n).toBe(1);
  });

  it("treats the same name with a different type as a different source", async () => {
    const db = testDb();
    const name = uniqueName("by-type");
    const markdown = await upsertSource(db, { name, type: "markdown" });
    const notion = await upsertSource(db, { name, type: "notion", config: { databaseId: "abc" } });

    expect(notion.id).not.toBe(markdown.id);
    expect(notion.config).toEqual({ databaseId: "abc" });
  });

  it("smoke: concurrent upserts of one new name converge on one row (load alone cannot prove race-safety)", async () => {
    const db = testDb();
    const name = uniqueName("converge");
    const results = await Promise.all(
      Array.from({ length: 8 }, () => upsertSource(db, { name, type: "markdown" })),
    );

    expect(new Set(results.map((source) => source.id)).size).toBe(1);
    const rows = await db.query("SELECT count(*)::int AS n FROM sources WHERE name = $1", [name]);
    expect(rows[0]?.n).toBe(1);
  });

  it("race protection is real: upsertSource waits for the advisory lock another transaction holds on the same source", async () => {
    // Measured without the lock, 40 to 120 parallel upserts produced a duplicate source in roughly
    // 1 run in 6, and 8 parallel calls never did, so load cannot show the lock matters. This test
    // is deterministic instead: one transaction holds the lock for 2 s, and upsertSource must queue.
    const db = testDb();
    const name = uniqueName("lock");
    const holder = db.transaction([
      db.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [`source:markdown:${name}`]),
      db.query("SELECT pg_sleep(2)"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const startedAt = Date.now();
    const source = await upsertSource(db, { name, type: "markdown" });
    const waitedMs = Date.now() - startedAt;
    await holder;

    expect(waitedMs).toBeGreaterThanOrEqual(1000);
    const rows = await db.query("SELECT count(*)::int AS n FROM sources WHERE name = $1", [name]);
    expect(rows[0]?.n).toBe(1);
    expect(source.name).toBe(name);
  });

  it("a different source is not blocked by another source's lock", async () => {
    const db = testDb();
    const held = uniqueName("held");
    const holder = db.transaction([
      db.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", [`source:markdown:${held}`]),
      db.query("SELECT pg_sleep(2)"),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const startedAt = Date.now();
    await upsertSource(db, { name: uniqueName("free"), type: "markdown" });
    const elapsedMs = Date.now() - startedAt;
    await holder;

    expect(elapsedMs).toBeLessThan(1500);
  });

  it("updates config and isActive on a repeat upsert", async () => {
    const db = testDb();
    const name = uniqueName("update");
    await upsertSource(db, { name, type: "notion", config: { databaseId: "one" } });
    const again = await upsertSource(db, {
      name,
      type: "notion",
      config: { databaseId: "two" },
      isActive: false,
    });

    expect(again.config).toEqual({ databaseId: "two" });
    expect(again.isActive).toBe(false);
  });

  it("keeps hostile names as data: SQL metacharacters and long names round-trip unchanged", async () => {
    const db = testDb();
    const name = `${uniqueName("o'brien")}"; DROP TABLE sources; --`;
    const stored = await upsertSource(db, { name, type: "markdown" });

    expect(stored.name).toBe(name);
    const table = await db.query("SELECT to_regclass('public.sources') IS NOT NULL AS present");
    expect(table[0]?.present).toBe(true);
  });

  it("getSourceById returns the source, null for an unknown id, and null for a malformed id", async () => {
    const db = testDb();
    const created = await upsertSource(db, { name: uniqueName("get"), type: "markdown" });

    expect(await getSourceById(db, created.id)).toEqual(created);
    expect(await getSourceById(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getSourceById(db, "not-a-uuid")).toBeNull();
    expect(await getSourceById(db, "1; DROP TABLE sources")).toBeNull();
  });

  it("updateSourceSyncedAt stores the time", async () => {
    const db = testDb();
    const created = await upsertSource(db, { name: uniqueName("synced"), type: "markdown" });
    const when = new Date("2026-11-14T12:00:00.000Z");

    await updateSourceSyncedAt(db, created.id, when);

    const reread = await getSourceById(db, created.id);
    expect(reread?.lastSyncedAt?.toISOString()).toBe(when.toISOString());
  });
});
