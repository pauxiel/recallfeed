import { ValidationError } from "@recallfeed/core";
import type { FeedItem } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { getFeedItemCandidates, insertFeedItems } from "../feed-items";
import { toFeedItem } from "../rows";
import type { CandidateOrder, CandidatePosition } from "../feed-items";
import { upsertNotes } from "../notes";
import { upsertSource } from "../sources";
import { DATABASE_TEST_TIMEOUT_MS, databaseUrl, makeNote, testDb, uniqueName } from "./helpers";

const LOWEST_ID = "00000000-0000-0000-0000-000000000000";

/** The keys the Spec 04 clarification defines, computed independently of the code under test. */
function keysOf(order: CandidateOrder, item: FeedItem): number[] {
  const effective = (item.lastReviewedAt ?? item.createdAt).getTime();
  return order === "recency" ? [effective] : [item.reviewCount, effective];
}

function position(order: CandidateOrder, item: FeedItem): CandidatePosition {
  return { keys: keysOf(order, item), id: item.id };
}

/** Sorts by the documented keys then id, as an independent model of the expected order. */
function modelSort(order: CandidateOrder, items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const ka = keysOf(order, a);
    const kb = keysOf(order, b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return (ka[i] as number) - (kb[i] as number);
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Creates `count` cards whose state is set by `shape(index)`, at times older than every card created
 * before them, so they lead their order whatever the shared fixture holds. `offsetUs` is in
 * microseconds from a common base, so cards can tie exactly, tie only to the millisecond, or differ.
 */
async function block(
  count: number,
  shape: (index: number) => { offsetUs: number; reviewCount?: number; reviewed?: boolean },
): Promise<FeedItem[]> {
  const db = testDb();
  const source = await upsertSource(db, { name: uniqueName("pages"), type: "markdown" });
  const stored = await upsertNotes(
    db,
    source.id,
    await Promise.all(Array.from({ length: count }, (_, i) => makeNote(source.id, `${source.name} note ${i}`))),
  );
  const cards = await insertFeedItems(
    db,
    stored.map(({ note }) => ({ noteId: note.id, sourceId: source.id, cardType: "original" as const, content: note.content, isAiGenerated: false })),
  );
  const [base] = await db.query(
    // Truncated to the millisecond, so an offset from 0 to 999 microseconds stays inside one millisecond.
    "SELECT date_trunc('milliseconds', TIMESTAMPTZ '1900-01-01' - EXTRACT(EPOCH FROM clock_timestamp()) * interval '1 second') AS t",
  );
  for (const [i, item] of cards.entries()) {
    const { offsetUs, reviewCount = 0, reviewed = true } = shape(i);
    await db.query(
      `UPDATE feed_items
          SET review_count = $2,
              last_reviewed_at = CASE WHEN $4 THEN $3::timestamptz + make_interval(secs => $5::double precision / 1000000) END,
              created_at = CASE WHEN $4 THEN created_at ELSE $3::timestamptz + make_interval(secs => $5::double precision / 1000000) END
        WHERE id = $1`,
      [item.id, reviewCount, base?.t, reviewed, offsetUs],
    );
  }
  const ids = cards.map((c) => c.id);
  const rows = await db.query("SELECT * FROM feed_items WHERE id = ANY($1::uuid[])", [ids]);
  const byId = new Map(rows.map((row) => [row.id as string, toFeedItem(row)]));
  return ids.map((id) => byId.get(id) as FeedItem);
}

/** Walks pages of `limit` from `start`, until every card of `mine` has been passed or `maxPages`. */
async function walk(order: CandidateOrder, limit: number, start: CandidatePosition | undefined, mine: Set<string>, maxPages = 400) {
  const db = testDb();
  const seen: string[] = [];
  const pages: string[][] = [];
  let after = start;
  for (let n = 0; n < maxPages; n += 1) {
    const page = await getFeedItemCandidates(db, { limit, order, after });
    if (page.length === 0) break;
    pages.push(page.map((c) => c.id));
    seen.push(...page.map((c) => c.id));
    const last = page[page.length - 1]!;
    after = position(order, last);
    if ([...mine].every((id) => seen.includes(id)) && !mine.has(last.id)) break;
    if (page.length < limit) break;
  }
  return { seen, pages };
}

describe.skipIf(databaseUrl === "")("feed pages in a strategy's order (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  describe("ordering", () => {
    it("recency is effective time then id, with ties to the millisecond broken by id", async () => {
      // Two exact ties, two that differ only by microseconds inside one millisecond, one a millisecond later,
      // and one never reviewed whose createdAt places it between.
      const cards = await block(6, (i) => [
        { offsetUs: 0 },
        { offsetUs: 0 },
        { offsetUs: 400 },
        { offsetUs: 900 },
        { offsetUs: 1000 },
        { offsetUs: 500, reviewed: false },
      ][i]!);
      const mine = new Set(cards.map((c) => c.id));

      const page = await getFeedItemCandidates(testDb(), { limit: 200, order: "recency" });
      const got = page.map((c) => c.id).filter((id) => mine.has(id));

      expect(got).toEqual(modelSort("recency", cards).map((c) => c.id));
      // The first five share one millisecond (0 to 999 microseconds), so only id separates them.
      const ms = cards.map((c) => (c.lastReviewedAt ?? c.createdAt).getTime());
      expect(new Set(ms.slice(0, 4).concat(ms[5]!)).size).toBe(1);
      expect(ms[4]).toBe(ms[0]! + 1);
    });

    it("recency is the default order, unchanged from Phase 2", async () => {
      // Review counts that run against time, so recency and importance put these cards in opposite orders.
      const cards = await block(3, (i) => ({ offsetUs: i * 5000, reviewCount: 2 - i }));
      const mine = new Set(cards.map((c) => c.id));

      const defaulted = (await getFeedItemCandidates(testDb(), { limit: 200 })).map((c) => c.id).filter((id) => mine.has(id));
      const explicit = (await getFeedItemCandidates(testDb(), { limit: 200, order: "recency" })).map((c) => c.id).filter((id) => mine.has(id));

      expect(defaulted).toEqual(cards.map((c) => c.id));
      expect(explicit).toEqual(defaulted);
      expect(modelSort("importance", cards).map((c) => c.id)).toEqual([...defaulted].reverse());
    });

    it("importance is reviewCount, then effective time, then id", async () => {
      const cards = await block(6, (i) => [
        { offsetUs: 0, reviewCount: 2 },
        { offsetUs: 0, reviewCount: 1 },
        { offsetUs: 5000, reviewCount: 1 },
        { offsetUs: 0, reviewCount: 1 },
        { offsetUs: 9000, reviewCount: 0 },
        { offsetUs: 0, reviewCount: 3 },
      ][i]!);
      const mine = new Set(cards.map((c) => c.id));
      const start: CandidatePosition = { keys: [0, -Number.MAX_SAFE_INTEGER + 1], id: LOWEST_ID };

      const { seen } = await walk("importance", 200, start, mine);
      const got = seen.filter((id) => mine.has(id));

      expect(got).toEqual(modelSort("importance", cards).map((c) => c.id));
      expect(got.map((id) => cards.find((c) => c.id === id)!.reviewCount)).toEqual([0, 1, 1, 1, 2, 3]);
    });
  });

  describe("keyset pages: every card exactly once, across page boundaries", () => {
    it.each([1, 2, 3, 5])("recency, a block of 9 cards that all tie on effective time, page size %i", async (limit) => {
      const cards = await block(9, () => ({ offsetUs: 0 }));
      const mine = new Set(cards.map((c) => c.id));
      const firstMs = (cards[0]!.lastReviewedAt as Date).getTime();
      const start: CandidatePosition = { keys: [firstMs - 1], id: LOWEST_ID };

      const { seen, pages } = await walk("recency", limit, start, mine);
      const got = seen.filter((id) => mine.has(id));

      expect(got).toEqual(modelSort("recency", cards).map((c) => c.id));
      expect(new Set(seen).size).toBe(seen.length);
      expect(pages.length).toBeGreaterThanOrEqual(Math.ceil(9 / limit));
    });

    it.each([1, 2, 4])("importance, 12 cards tying on reviewCount and on time in mixed groups, page size %i", async (limit) => {
      // Three review counts; within each, two exact time ties, a sub-millisecond tie, and a later time.
      const cards = await block(12, (i) => ({ reviewCount: 4 + (i % 3), offsetUs: [0, 0, 300, 2000][Math.floor(i / 3)]! }));
      const mine = new Set(cards.map((c) => c.id));
      const firstMs = (cards[0]!.lastReviewedAt as Date).getTime();
      const start: CandidatePosition = { keys: [4, firstMs - 1], id: LOWEST_ID };

      const { seen } = await walk("importance", limit, start, mine);
      const got = seen.filter((id) => mine.has(id));

      expect(got).toEqual(modelSort("importance", cards).map((c) => c.id));
      expect(new Set(seen).size).toBe(seen.length);
    });

    it("walking the whole table in recency with page size 50 returns every unsnoozed card exactly once, in order", async () => {
      await block(3, () => ({ offsetUs: 0 }));
      const db = testDb();
      const [{ n }] = (await db.query(
        "SELECT count(*)::int AS n FROM feed_items WHERE snoozed_until IS NULL OR snoozed_until <= NOW()",
      )) as [{ n: number }];
      const out: FeedItem[] = [];
      let after: CandidatePosition | undefined;
      for (;;) {
        const page = await getFeedItemCandidates(db, { limit: 50, order: "recency", after, excludeSnoozed: true });
        if (page.length === 0) break;
        out.push(...page);
        after = position("recency", page[page.length - 1]!);
      }

      expect(out).toHaveLength(n);
      expect(new Set(out.map((c) => c.id)).size).toBe(n);
      expect(out.map((c) => c.id)).toEqual(modelSort("recency", out).map((c) => c.id));
    });

    it("walking the whole table in importance with page size 200 returns every card exactly once, in order", async () => {
      const db = testDb();
      const [{ n }] = (await db.query("SELECT count(*)::int AS n FROM feed_items")) as [{ n: number }];
      const out: FeedItem[] = [];
      let after: CandidatePosition | undefined;
      for (;;) {
        const page = await getFeedItemCandidates(db, { limit: 200, order: "importance", after });
        if (page.length === 0) break;
        out.push(...page);
        after = position("importance", page[page.length - 1]!);
      }

      expect(out).toHaveLength(n);
      expect(new Set(out.map((c) => c.id)).size).toBe(n);
      expect(out.map((c) => c.id)).toEqual(modelSort("importance", out).map((c) => c.id));
    });

    it("the page after the last card is empty", async () => {
      const db = testDb();
      const end: CandidatePosition = { keys: [2147483647, Number.MAX_SAFE_INTEGER], id: "ffffffff-ffff-ffff-ffff-ffffffffffff" };

      expect(await getFeedItemCandidates(db, { limit: 10, order: "importance", after: end })).toEqual([]);
    });

    it("keyset filters combine with the published and snooze filters", async () => {
      const cards = await block(4, () => ({ offsetUs: 0 }));
      const db = testDb();
      const [published, , snoozedPublished] = modelSort("recency", cards);
      await db.query("UPDATE feed_items SET is_published = TRUE WHERE id = ANY($1::uuid[])", [[published!.id, snoozedPublished!.id]]);
      await db.query("UPDATE feed_items SET snoozed_until = NOW() + interval '1 day' WHERE id = $1", [snoozedPublished!.id]);
      const firstMs = (cards[0]!.lastReviewedAt as Date).getTime();

      const page = await getFeedItemCandidates(db, {
        limit: 200,
        order: "recency",
        onlyPublished: true,
        excludeSnoozed: true,
        after: { keys: [firstMs - 1], id: LOWEST_ID },
      });
      const mine = page.map((c) => c.id).filter((id) => cards.some((c) => c.id === id));

      expect(mine).toEqual([published!.id]);
    });
  });

  describe("an invalid position is refused before any SQL runs", () => {
    it.each([
      ["recency with two keys", "recency", { keys: [1, 2], id: LOWEST_ID }],
      ["importance with one key", "importance", { keys: [1], id: LOWEST_ID }],
      ["a fractional key", "recency", { keys: [1.5], id: LOWEST_ID }],
      ["an unsafe integer", "recency", { keys: [Number.MAX_SAFE_INTEGER + 2], id: LOWEST_ID }],
      ["NaN", "recency", { keys: [Number.NaN], id: LOWEST_ID }],
      ["a reviewCount beyond a 32-bit integer", "importance", { keys: [2147483648, 0], id: LOWEST_ID }],
      ["a negative reviewCount", "importance", { keys: [-1, 0], id: LOWEST_ID }],
      ["a malformed id", "recency", { keys: [1], id: "not-a-uuid" }],
      ["an injection string as id", "recency", { keys: [1], id: "1) OR (1=1" }],
    ] as [string, CandidateOrder, CandidatePosition][])("%s", async (_label, order, after) => {
      await expect(getFeedItemCandidates(testDb(), { limit: 5, order, after })).rejects.toMatchObject({
        code: "VALIDATION_CURSOR",
      });
    });

    it("an unknown order is refused", async () => {
      await expect(
        getFeedItemCandidates(testDb(), { limit: 5, order: "due_review" as CandidateOrder }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});
