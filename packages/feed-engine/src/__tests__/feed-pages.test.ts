import { ValidationError } from "@recallfeed/core";
import type { FeedItem } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { decodeCursor } from "../cursor";
import { FeedEngine } from "../feed-engine";
import { ImportanceStrategy, RecencyStrategy } from "../strategies";
import type { PageableStrategyName } from "../strategies";
import { CONFIG } from "./strategy-fixtures";
import { DATABASE_TEST_TIMEOUT_MS, databaseUrl, testDb, uniqueName } from "./helpers";

const STRATEGY = { recency: new RecencyStrategy(), importance: new ImportanceStrategy() };

/**
 * Imports one note per entry and sets each card's state, at times older than every card seeded
 * before, so the block leads both orders whatever the shared database holds. `offsetUs` is in
 * microseconds from a millisecond-aligned base. All cards are published, so a public walk sees them.
 */
async function block(shapes: { offsetUs: number; reviewCount: number }[]): Promise<string[]> {
  const db = testDb();
  const engine = new FeedEngine(db);
  const name = uniqueName("pages");
  const doc = shapes.map((_, i) => `# Card ${i} ${name}\n\nBody ${i} for ${name}.`).join("\n\n");
  const { sourceId } = await engine.importMarkdown(doc, { name });
  const rows = await db.query("SELECT id FROM feed_items WHERE source_id = $1 ORDER BY content", [sourceId]);
  const [base] = await db.query(
    "SELECT date_trunc('milliseconds', TIMESTAMPTZ '1900-01-01' - EXTRACT(EPOCH FROM clock_timestamp()) * interval '1 second') AS t",
  );
  const ids = rows.map((row) => row.id as string);
  for (const [i, id] of ids.entries()) {
    const { offsetUs, reviewCount } = shapes[i]!;
    await db.query(
      `UPDATE feed_items
          SET is_published = TRUE, review_count = $2,
              last_reviewed_at = $3::timestamptz + make_interval(secs => $4::double precision / 1000000)
        WHERE id = $1`,
      [id, reviewCount, base?.t, offsetUs],
    );
  }
  return ids;
}

/** Reads pages until `nextCursor` is null, returning every page's items. */
async function walkAll(strategy: PageableStrategyName, limit: number, isPublicRequest: boolean): Promise<FeedItem[][]> {
  const engine = new FeedEngine(testDb());
  const pages: FeedItem[][] = [];
  let cursor: string | undefined;
  for (let n = 0; n < 2000; n += 1) {
    const page = await engine.listFeedItems({ strategy, limit, isPublicRequest, ...(cursor === undefined ? {} : { cursor }) });
    pages.push(page.items);
    if (page.nextCursor === null) {
      return pages;
    }
    cursor = page.nextCursor;
  }
  throw new Error("walk did not end");
}

describe.skipIf(databaseUrl === "")("feed pages through FeedEngine (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  it.each(["recency", "importance"] as const)(
    "%s: walking every public page returns each published card exactly once, in the strategy's order, and the last cursor is null",
    async (strategy) => {
      // Ties on every key, on time only, and below the millisecond, so page boundaries fall inside ties.
      const mine = await block([
        { offsetUs: 0, reviewCount: 1 },
        { offsetUs: 0, reviewCount: 1 },
        { offsetUs: 0, reviewCount: 0 },
        { offsetUs: 250, reviewCount: 1 },
        { offsetUs: 0, reviewCount: 0 },
        { offsetUs: 1000, reviewCount: 0 },
        { offsetUs: 0, reviewCount: 2 },
      ]);

      const pages = await walkAll(strategy, 3, true);
      const all = pages.flat();
      const ids = all.map((c) => c.id);
      const [{ n }] = (await testDb().query(
        "SELECT count(*)::int AS n FROM feed_items WHERE is_published AND (snoozed_until IS NULL OR snoozed_until <= NOW())",
      )) as [{ n: number }];

      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(n);
      expect(mine.every((id) => ids.includes(id))).toBe(true);
      // The database's order is exactly the strategy's in-memory order.
      expect(ids).toEqual(STRATEGY[strategy].rank(all, CONFIG, new Date()).map((c) => c.id));
      expect(pages.slice(0, -1).every((page) => page.length === 3)).toBe(true);
      expect(pages[pages.length - 1]!.length).toBeGreaterThan(0);
    },
  );

  it("the two strategies put the same cards in different orders", async () => {
    const mine = await block([
      { offsetUs: 0, reviewCount: 5 },
      { offsetUs: 2000, reviewCount: 0 },
    ]);
    const [often, never] = mine;
    const minePart = (all: FeedItem[]) => all.map((c) => c.id).filter((id) => mine.includes(id));

    expect(minePart((await walkAll("recency", 50, true)).flat())).toEqual([often, never]);
    expect(minePart((await walkAll("importance", 50, true)).flat())).toEqual([never, often]);
  });

  it("the cursor of a recency page holds the timestamp; of an importance page, reviewCount and the timestamp", async () => {
    const engine = new FeedEngine(testDb());

    const recency = await engine.listFeedItems({ strategy: "recency", limit: 1, isPublicRequest: false });
    const importance = await engine.listFeedItems({ strategy: "importance", limit: 1, isPublicRequest: false });
    const r = recency.items[0]!;
    const i = importance.items[0]!;

    expect(decodeCursor(recency.nextCursor!, STRATEGY.recency)).toEqual({ keys: [(r.lastReviewedAt ?? r.createdAt).getTime()], id: r.id });
    expect(decodeCursor(importance.nextCursor!, STRATEGY.importance)).toEqual({
      keys: [i.reviewCount, (i.lastReviewedAt ?? i.createdAt).getTime()],
      id: i.id,
    });
  });

  it("a cursor from one strategy is refused by the other", async () => {
    const engine = new FeedEngine(testDb());
    const recency = await engine.listFeedItems({ strategy: "recency", limit: 1, isPublicRequest: false });

    await expect(
      engine.listFeedItems({ strategy: "importance", limit: 1, isPublicRequest: false, cursor: recency.nextCursor! }),
    ).rejects.toMatchObject({ code: "VALIDATION_CURSOR" });
  });

  it("the default strategy is recency", async () => {
    const engine = new FeedEngine(testDb());

    const defaulted = await engine.listFeedItems({ limit: 5, isPublicRequest: false });
    const recency = await engine.listFeedItems({ strategy: "recency", limit: 5, isPublicRequest: false });

    expect(defaulted.items.map((c) => c.id)).toEqual(recency.items.map((c) => c.id));
    expect(defaulted.nextCursor).toBe(recency.nextCursor);
  });

  it("an unknown strategy is refused", async () => {
    await expect(new FeedEngine(testDb()).listFeedItems({ strategy: "due_review", isPublicRequest: false })).rejects.toMatchObject({
      code: "VALIDATION_STRATEGY",
    });
  });

  it("nextCursor is a cursor while more cards remain, and null on the page that reaches the end", async () => {
    const engine = new FeedEngine(testDb());
    const [{ n }] = (await testDb().query(
      "SELECT count(*)::int AS n FROM feed_items WHERE snoozed_until IS NULL OR snoozed_until <= NOW()",
    )) as [{ n: number }];

    const first = await engine.listFeedItems({ strategy: "recency", limit: 50, isPublicRequest: false });
    const pages = await walkAll("recency", 50, false);

    expect(n).toBeGreaterThan(50);
    expect(first.nextCursor).not.toBeNull();
    expect(pages.flat()).toHaveLength(n);
    expect(pages[pages.length - 1]!.length).toBeLessThanOrEqual(50);
  });

  it("a page holding exactly the remaining cards ends the walk: nextCursor is null, with no empty trailing page", async () => {
    const engine = new FeedEngine(testDb());
    // Find the cursor just before the last page, and how many cards that page holds.
    let cursor: string | undefined;
    let before: string | undefined;
    let remaining = 0;
    for (let n = 0; n < 2000; n += 1) {
      const page = await engine.listFeedItems({ strategy: "importance", limit: 50, isPublicRequest: false, ...(cursor === undefined ? {} : { cursor }) });
      if (page.nextCursor === null) {
        remaining = page.items.length;
        break;
      }
      before = page.nextCursor;
      cursor = page.nextCursor;
    }

    const exact = await engine.listFeedItems({ strategy: "importance", limit: remaining, isPublicRequest: false, ...(before === undefined ? {} : { cursor: before }) });
    const oneShort = remaining > 1
      ? await engine.listFeedItems({ strategy: "importance", limit: remaining - 1, isPublicRequest: false, ...(before === undefined ? {} : { cursor: before }) })
      : null;

    expect(remaining).toBeGreaterThan(0);
    expect(exact.items).toHaveLength(remaining);
    expect(exact.nextCursor).toBeNull();
    if (oneShort !== null) {
      expect(oneShort.items).toHaveLength(remaining - 1);
      expect(oneShort.nextCursor).not.toBeNull();
    }
  });

  it.each([0, 51, 1.5])("limit %s is still refused", async (limit) => {
    await expect(new FeedEngine(testDb()).listFeedItems({ limit, isPublicRequest: false })).rejects.toBeInstanceOf(ValidationError);
  });
});
