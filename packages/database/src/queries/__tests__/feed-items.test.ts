import { ValidationError } from "@recallfeed/core";
import type { FeedItem } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import {
  MAX_CANDIDATE_LIMIT,
  getFeedItemById,
  getFeedItemCandidates,
  insertFeedItem,
  insertFeedItems,
} from "../feed-items";
import { getNotesMissingCardType, upsertNotes } from "../notes";
import { upsertSource } from "../sources";
import { databaseUrl, makeNote, testDb, uniqueName } from "./helpers";

describe.skipIf(databaseUrl === "")("feed item queries (real PostgreSQL through the proxy)", () => {
  /** A source with `count` notes, returning the note ids. */
  async function seed(count: number) {
    const db = testDb();
    const source = await upsertSource(db, { name: uniqueName("cards"), type: "markdown" });
    const notes = await upsertNotes(
      db,
      source.id,
      await Promise.all(
        Array.from({ length: count }, (_, i) => makeNote(source.id, `${source.name} note ${i}`)),
      ),
    );
    return { db, source, notes: notes.map((entry) => entry.note) };
  }

  it("inserts a card with safe defaults: unpublished, unreviewed, unsnoozed", async () => {
    const { db, source, notes } = await seed(1);
    const note = notes[0]!;

    const card = await insertFeedItem(db, {
      noteId: note.id,
      sourceId: source.id,
      cardType: "original",
      content: note.content,
      isAiGenerated: false,
    });

    expect(card).toMatchObject({
      noteId: note.id,
      sourceId: source.id,
      cardType: "original",
      content: note.content,
      isAiGenerated: false,
      isPublished: false,
      reviewCount: 0,
      lastReviewedAt: null,
      savedAt: null,
      snoozedUntil: null,
    });
  });

  it("the named unique constraint prevents a second card of the same type: the repeat insert returns null and adds no row", async () => {
    const { db, source, notes } = await seed(1);
    const note = notes[0]!;
    const input = {
      noteId: note.id,
      sourceId: source.id,
      cardType: "original" as const,
      content: note.content,
      isAiGenerated: false,
    };

    expect(await insertFeedItem(db, input)).not.toBeNull();
    expect(await insertFeedItem(db, input)).toBeNull();
    const rows = await db.query("SELECT count(*)::int AS n FROM feed_items WHERE note_id = $1", [note.id]);
    expect(rows[0]?.n).toBe(1);
  });

  it("insertFeedItems creates a batch in one call and returns only the cards it created", async () => {
    const { db, source, notes } = await seed(3);
    const inputs = notes.map((note) => ({
      noteId: note.id,
      sourceId: source.id,
      cardType: "original" as const,
      content: note.content,
      isAiGenerated: false,
    }));

    expect(await insertFeedItems(db, inputs)).toHaveLength(3);
    expect(await insertFeedItems(db, inputs)).toHaveLength(0);
    expect(await insertFeedItems(db, [])).toEqual([]);
  });

  it("refuses an AI-generated original card and malformed ids before touching the database", async () => {
    const { db, source, notes } = await seed(1);
    const note = notes[0]!;

    await expect(
      insertFeedItem(db, {
        noteId: note.id,
        sourceId: source.id,
        cardType: "original",
        content: "x",
        isAiGenerated: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      insertFeedItem(db, {
        noteId: "nope",
        sourceId: source.id,
        cardType: "original",
        content: "x",
        isAiGenerated: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("getNotesMissingCardType lists only notes without that card, so card generation is idempotent", async () => {
    const { db, source, notes } = await seed(3);
    const [first, ...rest] = notes;
    await insertFeedItem(db, {
      noteId: first!.id,
      sourceId: source.id,
      cardType: "original",
      content: first!.content,
      isAiGenerated: false,
    });

    const missing = await getNotesMissingCardType(db, source.id, "original");

    expect(missing.map((note) => note.id).sort()).toEqual(rest.map((note) => note.id).sort());
    expect(await getNotesMissingCardType(db, source.id, "highlight")).toHaveLength(3);
  });

  describe("getFeedItemCandidates", () => {
    /** Creates cards for a fresh source and returns them, so tests only reason about their own rows. */
    async function cards(count: number): Promise<{ db: ReturnType<typeof testDb>; items: FeedItem[] }> {
      const { db, source, notes } = await seed(count);
      const items = await insertFeedItems(
        db,
        notes.map((note) => ({
          noteId: note.id,
          sourceId: source.id,
          cardType: "original" as const,
          content: note.content,
          isAiGenerated: false,
        })),
      );
      return { db, items };
    }

    const ids = (list: readonly FeedItem[]): string[] => list.map((item) => item.id);

    it("onlyPublished=true returns only is_published=true rows; false returns both", async () => {
      const { db, items } = await cards(3);
      const [published, hidden] = items;
      await db.query("UPDATE feed_items SET is_published = TRUE WHERE id = $1", [published!.id]);

      const publicView = await getFeedItemCandidates(db, { onlyPublished: true, limit: MAX_CANDIDATE_LIMIT });
      const ownerView = await getFeedItemCandidates(db, { limit: MAX_CANDIDATE_LIMIT });

      expect(ids(publicView)).toContain(published!.id);
      expect(ids(publicView)).not.toContain(hidden!.id);
      expect(publicView.every((item) => item.isPublished)).toBe(true);
      expect(ids(ownerView)).toEqual(expect.arrayContaining(ids(items)));
    });

    it("excludeSnoozed hides cards snoozed into the future and shows ones whose snooze ended", async () => {
      const { db, items } = await cards(3);
      const [future, past, none] = items;
      await db.query("UPDATE feed_items SET snoozed_until = NOW() + interval '1 day' WHERE id = $1", [future!.id]);
      await db.query("UPDATE feed_items SET snoozed_until = NOW() - interval '1 day' WHERE id = $1", [past!.id]);

      const visible = await getFeedItemCandidates(db, { excludeSnoozed: true, limit: MAX_CANDIDATE_LIMIT });
      const all = await getFeedItemCandidates(db, { limit: MAX_CANDIDATE_LIMIT });

      expect(ids(visible)).not.toContain(future!.id);
      expect(ids(visible)).toEqual(expect.arrayContaining([past!.id, none!.id]));
      expect(ids(all)).toContain(future!.id);
    });

    it("cardTypes filters by type", async () => {
      const { db, items } = await cards(1);
      const extra = items[0]!;
      await db.query(
        "INSERT INTO feed_items (note_id, source_id, card_type, content) VALUES ($1, $2, 'highlight', 'h')",
        [extra.noteId, extra.sourceId],
      );

      const onlyHighlights = await getFeedItemCandidates(db, {
        cardTypes: ["highlight"],
        limit: MAX_CANDIDATE_LIMIT,
      });

      expect(onlyHighlights.length).toBeGreaterThan(0);
      expect(onlyHighlights.every((item) => item.cardType === "highlight")).toBe(true);
    });

    it("limit bounds the page, and the order is stable across calls", async () => {
      const { db } = await cards(5);

      const page = await getFeedItemCandidates(db, { limit: 3 });
      const again = await getFeedItemCandidates(db, { limit: 3 });

      expect(page).toHaveLength(3);
      expect(ids(again)).toEqual(ids(page));
    });

    it("orders oldest effective review time first, then by id", async () => {
      const { db, items } = await cards(3);
      const [a, b, c] = items;
      // a reviewed long ago, b reviewed recently, c never reviewed (created just now).
      await db.query("UPDATE feed_items SET last_reviewed_at = NOW() - interval '30 days' WHERE id = $1", [a!.id]);
      await db.query("UPDATE feed_items SET last_reviewed_at = NOW() + interval '1 hour' WHERE id = $1", [b!.id]);

      const ordered = ids(await getFeedItemCandidates(db, { limit: MAX_CANDIDATE_LIMIT })).filter((id) =>
        [a!.id, b!.id, c!.id].includes(id),
      );

      expect(ordered).toEqual([a!.id, c!.id, b!.id]);
    });

    it.each([0, -1, 1.5, Number.NaN, MAX_CANDIDATE_LIMIT + 1])("rejects limit %s", async (limit) => {
      await expect(getFeedItemCandidates(testDb(), { limit })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("getFeedItemById", () => {
    it("returns the card with every field, or null when unknown or malformed", async () => {
      const { db, source, notes } = await seed(1);
      const note = notes[0]!;
      const created = await insertFeedItem(db, {
        noteId: note.id,
        sourceId: source.id,
        cardType: "original",
        content: note.content,
        isAiGenerated: false,
      });

      expect(await getFeedItemById(db, created!.id)).toEqual(created);
      expect(await getFeedItemById(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
      expect(await getFeedItemById(db, "nope")).toBeNull();
      expect(await getFeedItemById(db, "1 OR 1=1")).toBeNull();
    });

    it("onlyPublished makes an unpublished card look absent, and a published card visible", async () => {
      const { db, source, notes } = await seed(2);
      const [one, two] = notes;
      const hidden = await insertFeedItem(db, {
        noteId: one!.id,
        sourceId: source.id,
        cardType: "original",
        content: one!.content,
        isAiGenerated: false,
      });
      const shown = await insertFeedItem(db, {
        noteId: two!.id,
        sourceId: source.id,
        cardType: "original",
        content: two!.content,
        isAiGenerated: false,
      });
      await db.query("UPDATE feed_items SET is_published = TRUE WHERE id = $1", [shown!.id]);

      expect(await getFeedItemById(db, hidden!.id, { onlyPublished: true })).toBeNull();
      expect(await getFeedItemById(db, hidden!.id)).not.toBeNull();
      expect((await getFeedItemById(db, shown!.id, { onlyPublished: true }))?.id).toBe(shown!.id);
    });
  });
});
