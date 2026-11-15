import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { generateFeedItems } from "../card-generator";
import { DEFAULT_FEED_LIMIT, FeedEngine, MAX_FEED_LIMIT } from "../feed-engine";
import { countHttpRequests, databaseUrl, testDb, uniqueName } from "./helpers";

describe.skipIf(databaseUrl === "")("FeedEngine (real PostgreSQL through the proxy)", () => {
  const doc = (marker: string) =>
    `# First ${marker}\n\nBody of the first note ${marker}.\n\n# Second ${marker}\n\nBody of the second note ${marker}.\n\n- a list\n- of items`;

  async function counts(sourceId: string) {
    const db = testDb();
    const [notes, cards] = await Promise.all([
      db.query("SELECT count(*)::int AS n FROM notes WHERE source_id = $1", [sourceId]),
      db.query("SELECT count(*)::int AS n FROM feed_items WHERE source_id = $1", [sourceId]),
    ]);
    return { notes: notes[0]?.n as number, cards: cards[0]?.n as number };
  }

  describe("importMarkdown", () => {
    it("persists the source, the notes, and one original card per note, and returns Spec 05's fields", async () => {
      const db = testDb();
      const name = uniqueName("happy");
      const result = await new FeedEngine(db).importMarkdown(doc(name), { name });

      expect(Object.keys(result).sort()).toEqual(["feedItemsCreated", "notesImported", "queued", "sourceId"]);
      expect(result).toMatchObject({ queued: false, notesImported: 2, feedItemsCreated: 2 });
      expect(await counts(result.sourceId)).toEqual({ notes: 2, cards: 2 });

      const cards = await db.query(
        "SELECT card_type, is_ai_generated, is_published, review_count, content FROM feed_items WHERE source_id = $1 ORDER BY content",
        [result.sourceId],
      );
      expect(cards.every((card) => card.card_type === "original")).toBe(true);
      expect(cards.every((card) => card.is_ai_generated === false)).toBe(true);
      expect(cards.every((card) => card.is_published === false)).toBe(true);
      expect(cards.every((card) => card.review_count === 0)).toBe(true);
    });

    it("each card is a one-to-one copy of its note content", async () => {
      const db = testDb();
      const name = uniqueName("copy");
      const result = await new FeedEngine(db).importMarkdown(doc(name), { name });

      const rows = await db.query(
        "SELECT n.content AS note_content, f.content AS card_content FROM notes n JOIN feed_items f ON f.note_id = n.id WHERE n.source_id = $1",
        [result.sourceId],
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.note_content === row.card_content)).toBe(true);
    });

    it("records the source as a markdown source and stamps last_synced_at", async () => {
      const db = testDb();
      const name = uniqueName("source");
      const result = await new FeedEngine(db).importMarkdown(doc(name), { name });

      const rows = await db.query("SELECT type, name, is_active, last_synced_at FROM sources WHERE id = $1", [
        result.sourceId,
      ]);
      expect(rows[0]).toMatchObject({ type: "markdown", name, is_active: true });
      expect(rows[0]?.last_synced_at).toBeInstanceOf(Date);
    });

    it("duplicate import: the same text under the same name reuses the source and creates nothing new", async () => {
      const db = testDb();
      const name = uniqueName("dup");
      const engine = new FeedEngine(db);
      const first = await engine.importMarkdown(doc(name), { name });
      const before = await db.query("SELECT id, imported_at, content FROM notes WHERE source_id = $1 ORDER BY content", [
        first.sourceId,
      ]);

      const second = await engine.importMarkdown(doc(name), { name });

      expect(second.sourceId).toBe(first.sourceId);
      expect(second).toMatchObject({ notesImported: 2, feedItemsCreated: 0 });
      expect(await counts(first.sourceId)).toEqual({ notes: 2, cards: 2 });
      const after = await db.query("SELECT id, imported_at, content FROM notes WHERE source_id = $1 ORDER BY content", [
        first.sourceId,
      ]);
      expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
      expect(after.map((row) => row.content)).toEqual(before.map((row) => row.content));
      expect((after[0]?.imported_at as Date).getTime()).toBeGreaterThan((before[0]?.imported_at as Date).getTime());
    });

    it("an import that adds one section creates exactly one new note and one new card", async () => {
      const db = testDb();
      const name = uniqueName("grow");
      const engine = new FeedEngine(db);
      const first = await engine.importMarkdown(doc(name), { name });

      const grown = await engine.importMarkdown(`${doc(name)}\n\n# Third ${name}\n\nA brand new third note.`, { name });

      expect(grown).toMatchObject({ sourceId: first.sourceId, notesImported: 3, feedItemsCreated: 1 });
      expect(await counts(first.sourceId)).toEqual({ notes: 3, cards: 3 });
    });

    it("deduplication is source-scoped: identical text under another name makes separate notes and cards", async () => {
      const db = testDb();
      const shared = uniqueName("shared");
      const engine = new FeedEngine(db);
      const a = await engine.importMarkdown(doc(shared), { name: uniqueName("a") });
      const b = await engine.importMarkdown(doc(shared), { name: uniqueName("b") });

      expect(b.sourceId).not.toBe(a.sourceId);
      expect(b).toMatchObject({ notesImported: 2, feedItemsCreated: 2 });
      expect(await counts(a.sourceId)).toEqual({ notes: 2, cards: 2 });
      expect(await counts(b.sourceId)).toEqual({ notes: 2, cards: 2 });
    });

    it("the same section repeated inside one document is stored once", async () => {
      const db = testDb();
      const name = uniqueName("repeat");
      const text = `# Same\n\nIdentical body ${name}.\n\n# Same\n\nIdentical body ${name}.`;

      const result = await new FeedEngine(db).importMarkdown(text, { name });

      expect(result).toMatchObject({ notesImported: 1, feedItemsCreated: 1 });
    });

    it("text with nothing extractable still succeeds with zero notes and cards", async () => {
      const db = testDb();
      const name = uniqueName("empty");

      const result = await new FeedEngine(db).importMarkdown("---\n\n---\n\n---\n\n---", { name });

      expect(result).toMatchObject({ queued: false, notesImported: 0, feedItemsCreated: 0 });
    });

    it("uses the default source name when none is given, and reuses it on the next import", async () => {
      const db = testDb();
      const engine = new FeedEngine(db);
      const one = await engine.importMarkdown(`# A ${uniqueName("d")}\n\nbody of the note`, {});
      const two = await engine.importMarkdown(`# B ${uniqueName("d")}\n\nbody of another`, { name: "  " });

      expect(two.sourceId).toBe(one.sourceId);
    });

    it("stores hostile content and names as data, and leaves the tables intact", async () => {
      const db = testDb();
      const name = `${uniqueName("o'brien")}"; DROP TABLE notes; --`;
      const body = "# '); DROP TABLE feed_items; --\n\nbody with $1, \"quotes\", and 漢字 ✓ 😀";

      const result = await new FeedEngine(db).importMarkdown(body, { name });

      expect(result.notesImported).toBe(1);
      const stored = await db.query("SELECT content FROM notes WHERE source_id = $1", [result.sourceId]);
      expect(stored[0]?.content).toBe("body with $1, \"quotes\", and 漢字 ✓ 😀");
      const tables = await db.query(
        "SELECT to_regclass('public.notes') IS NOT NULL AS a, to_regclass('public.feed_items') IS NOT NULL AS b",
      );
      expect(tables[0]).toEqual({ a: true, b: true });
    });

    it("rejects invalid input before writing anything", async () => {
      const db = testDb();
      const name = uniqueName("invalid");
      const engine = new FeedEngine(db);

      await expect(engine.importMarkdown("too short", { name })).rejects.toBeInstanceOf(ValidationError);
      await expect(engine.importMarkdown("a".repeat(100 * 1024 + 1), { name })).rejects.toBeInstanceOf(ValidationError);
      await expect(engine.importMarkdown("has a \u0000 NUL char", { name })).rejects.toBeInstanceOf(ValidationError);

      const rows = await db.query("SELECT count(*)::int AS n FROM sources WHERE name = $1", [name]);
      expect(rows[0]?.n).toBe(0);
    });

    it("an import of 300 sections uses a fixed handful of database requests, not one per note", async () => {
      // Each request is a Worker subrequest in production, where the free tier allows 50.
      const db = testDb();
      const name = uniqueName("many");
      const text = Array.from({ length: 300 }, (_, i) => `# Section ${i} ${name}\n\nBody number ${i} of ${name}.`).join("\n\n");
      const engine = new FeedEngine(db);

      const first = await countHttpRequests(() => engine.importMarkdown(text, { name }));
      const second = await countHttpRequests(() => engine.importMarkdown(text, { name }));

      expect(first.result).toMatchObject({ notesImported: 300, feedItemsCreated: 300 });
      expect(second.result).toMatchObject({ notesImported: 300, feedItemsCreated: 0 });
      console.log(`SUBREQUESTS: first import of 300 notes = ${first.requests} HTTP requests; repeat import = ${second.requests}`);
      expect(first.requests).toBeLessThanOrEqual(6);
      expect(second.requests).toBeLessThanOrEqual(6);
    });
  });

  describe("generateFeedItems", () => {
    it("creates missing cards once and reports zero on a repeat", async () => {
      const db = testDb();
      const name = uniqueName("gen");
      const { sourceId } = await new FeedEngine(db).importMarkdown(doc(name), { name });
      await db.query("DELETE FROM feed_items WHERE source_id = $1", [sourceId]);

      expect(await generateFeedItems(db, sourceId, ["original"])).toBe(2);
      expect(await generateFeedItems(db, sourceId, ["original"])).toBe(0);
      expect(await generateFeedItems(db, sourceId, ["original", "original"])).toBe(0);
    });

    it.each([["highlight"], ["summary"], ["code_snippet"], ["reflection_prompt"]] as const)(
      "refuses %s, which has no generator yet, instead of silently skipping it",
      async (type) => {
        await expect(generateFeedItems(testDb(), "11111111-1111-4111-8111-111111111111", [type])).rejects.toBeInstanceOf(
          ValidationError,
        );
      },
    );
  });

  describe("intermediate feed reads", () => {
    async function seeded(published: boolean) {
      const db = testDb();
      const name = uniqueName("read");
      const result = await new FeedEngine(db).importMarkdown(`# Only ${name}\n\nBody for ${name}.`, { name });
      const cards = await db.query("SELECT id FROM feed_items WHERE source_id = $1", [result.sourceId]);
      const id = cards[0]?.id as string;
      // The feed is capped at one page and ordered oldest-first, and the shared database holds
      // many cards, some seeded by other suites. A review time older than every card seeded before
      // this one (the clock only moves forward, so each later card is older still) puts this card at
      // the front of every list, whatever else is in the database. A fixed date would not: another
      // suite's cards can sort ahead of it.
      await db.query(
        `UPDATE feed_items
            SET last_reviewed_at = TIMESTAMPTZ '1900-01-01' - EXTRACT(EPOCH FROM clock_timestamp()) * interval '1 second',
                is_published = $2
          WHERE id = $1`,
        [id, published],
      );
      return { db, id, engine: new FeedEngine(db) };
    }

    it("a public request sees published cards only; an owner request sees both", async () => {
      const published = await seeded(true);
      const hidden = await seeded(false);

      const publicList = (await published.engine.listFeedItems({ isPublicRequest: true, limit: MAX_FEED_LIMIT })).map((c) => c.id);
      const ownerList = (await published.engine.listFeedItems({ isPublicRequest: false, limit: MAX_FEED_LIMIT })).map((c) => c.id);

      expect(publicList).toContain(published.id);
      expect(publicList).not.toContain(hidden.id);
      expect(ownerList).toContain(published.id);
      expect(ownerList).toContain(hidden.id);
    });

    it("getFeedItem hides an unpublished card from public requests only", async () => {
      const { engine, id } = await seeded(false);

      expect(await engine.getFeedItem(id, { isPublicRequest: true })).toBeNull();
      expect((await engine.getFeedItem(id, { isPublicRequest: false }))?.id).toBe(id);
      expect(await engine.getFeedItem("not-a-uuid", { isPublicRequest: false })).toBeNull();
    });

    it("a snoozed card is hidden from every list", async () => {
      const { db, engine, id } = await seeded(true);
      await db.query("UPDATE feed_items SET snoozed_until = NOW() + interval '1 day' WHERE id = $1", [id]);

      const publicList = (await engine.listFeedItems({ isPublicRequest: true, limit: MAX_FEED_LIMIT })).map((c) => c.id);
      const ownerList = (await engine.listFeedItems({ isPublicRequest: false, limit: MAX_FEED_LIMIT })).map((c) => c.id);

      expect(publicList).not.toContain(id);
      expect(ownerList).not.toContain(id);

      // And the same card is visible again once the snooze has ended, so the absence above is the snooze.
      await db.query("UPDATE feed_items SET snoozed_until = NOW() - interval '1 minute' WHERE id = $1", [id]);
      const after = (await engine.listFeedItems({ isPublicRequest: false, limit: MAX_FEED_LIMIT })).map((c) => c.id);
      expect(after).toContain(id);
    });

    it("defaults the page size to 10 and enforces 1 to 50", async () => {
      const { engine } = await seeded(true);

      expect((await engine.listFeedItems({ isPublicRequest: false })).length).toBeLessThanOrEqual(DEFAULT_FEED_LIMIT);
      expect(DEFAULT_FEED_LIMIT).toBe(10);
      expect(MAX_FEED_LIMIT).toBe(50);
      for (const limit of [0, -1, 51, 1.5, Number.NaN]) {
        await expect(engine.listFeedItems({ isPublicRequest: false, limit })).rejects.toBeInstanceOf(ValidationError);
      }
    });
  });
});
