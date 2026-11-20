import { describe, expect, it } from "vitest";
import {
  DATABASE_TEST_TIMEOUT_MS,
  TEST_OWNER,
  accessContext,
  call,
  databaseUrl,
  json,
  privateEnv,
  publicEnv,
  seedCard,
  testDb,
} from "./helpers";
import type { Env } from "../types";

type Item = Record<string, unknown> & { id: string };
type Page = { items: Item[]; nextCursor: string | null };
const PUBLIC_KEYS = ["cardType", "content", "createdAt", "id", "isAiGenerated", "noteId"];

const get = (path: string, env: Env, ctx = accessContext({ email: TEST_OWNER })): Promise<Response> =>
  call(path, { method: "GET" }, env, ctx);

/** Decodes a cursor's JSON, to check what Task 27 says it must contain. */
function cursorJson(cursor: string): { v: number; s: string; k: number[]; id: string } {
  const padded = cursor.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (cursor.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
}

/** Follows `nextCursor` from the first page until it is null, or `stopWhen` says the pages seen so far suffice. */
async function walk(env: Env, limit: number, stopWhen: (seen: Item[]) => boolean = () => false, ctx?: ReturnType<typeof accessContext>) {
  const pages: Page[] = [];
  let cursor: string | null = null;
  for (let n = 0; n < 500; n += 1) {
    const query = `/feed?limit=${limit}${cursor === null ? "" : `&cursor=${cursor}`}`;
    const response = await get(query, env, ctx);
    expect(response.status, query).toBe(200);
    const page = await json<Page>(response);
    pages.push(page);
    if (page.nextCursor === null || stopWhen(pages.flatMap((p) => p.items))) break;
    cursor = page.nextCursor;
  }
  return pages;
}

/**
 * Seeds published cards at the front of both orders. `groups` lists how many cards share each exact
 * review time, so ties straddle page boundaries; `reviewCounts` (optional) sets each card's count.
 */
async function tiedBlock(groups: number[], reviewCounts?: number[]): Promise<string[]> {
  const ids: string[] = [];
  for (const size of groups) {
    const group: string[] = [];
    for (let i = 0; i < size; i += 1) {
      group.push((await seedCard({ published: true })).id);
    }
    // Every card of the group takes the last-seeded (oldest) card's exact time.
    await testDb().query(
      "UPDATE feed_items SET last_reviewed_at = (SELECT last_reviewed_at FROM feed_items WHERE id = $1) WHERE id = ANY($2::uuid[])",
      [group[group.length - 1], group],
    );
    ids.push(...group);
  }
  if (reviewCounts !== undefined) {
    for (const [i, id] of ids.entries()) {
      await testDb().query("UPDATE feed_items SET review_count = $2 WHERE id = $1", [id, reviewCounts[i]]);
    }
  }
  return ids;
}

const importanceEnv = (overrides: Partial<Env> = {}) => publicEnv({ DEFAULT_RESURFACING_STRATEGY: "importance", ...overrides });

describe.skipIf(databaseUrl === "")("GET /feed pagination (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  describe("recency (the default)", () => {
    it("tied cards split across pages of 2 are each returned exactly once, in order, with no repeats", async () => {
      const mine = await tiedBlock([3, 2, 4]);
      const pages = await walk(publicEnv(), 2, (seen) => mine.every((id) => seen.some((item) => item.id === id)));
      const ids = pages.flatMap((p) => p.items.map((item) => item.id));

      expect(new Set(ids).size).toBe(ids.length);
      const got = ids.filter((id) => mine.includes(id));
      expect(got).toHaveLength(mine.length);
      expect(new Set(got)).toEqual(new Set(mine));
      // Within each tied group the order is by id.
      const order = await testDb().query(
        "SELECT id FROM feed_items WHERE id = ANY($1::uuid[]) ORDER BY floor(EXTRACT(EPOCH FROM COALESCE(last_reviewed_at, created_at)) * 1000), id",
        [mine],
      );
      expect(got).toEqual(order.map((row) => row.id));
    });

    it("the cursor holds a timestamp and the last item's id (Task 27)", async () => {
      await seedCard({ published: true });
      const page = await json<Page>(await get("/feed?limit=1", publicEnv()));
      const last = page.items[0]!;
      const [row] = await testDb().query("SELECT last_reviewed_at, created_at FROM feed_items WHERE id = $1", [last.id]);

      const decoded = cursorJson(page.nextCursor!);

      expect(decoded).toEqual({ v: 1, s: "recency", k: [((row?.last_reviewed_at ?? row?.created_at) as Date).getTime()], id: last.id });
    });

    it("an unset and a blank DEFAULT_RESURFACING_STRATEGY both mean recency", async () => {
      await seedCard({ published: true });
      const unset = await json<Page>(await get("/feed?limit=3", publicEnv()));
      const blank = await json<Page>(await get("/feed?limit=3", publicEnv({ DEFAULT_RESURFACING_STRATEGY: "" })));
      const explicit = await json<Page>(await get("/feed?limit=3", publicEnv({ DEFAULT_RESURFACING_STRATEGY: "recency" })));

      expect(blank).toEqual(unset);
      expect(explicit).toEqual(unset);
      expect(cursorJson(unset.nextCursor!).s).toBe("recency");
    });
  });

  describe("importance", () => {
    it("orders by reviewCount, then time, then id, and tied cards across pages of 3 are each returned once", async () => {
      // Counts chosen so the counts and the times disagree: recency and importance order these differently.
      const mine = await tiedBlock([2, 3, 2], [1, 0, 1, 0, 0, 2, 0]);
      const pages = await walk(importanceEnv(), 3);
      const ids = pages.flatMap((p) => p.items.map((item) => item.id));

      expect(new Set(ids).size).toBe(ids.length);
      const got = ids.filter((id) => mine.includes(id));
      const expected = await testDb().query(
        "SELECT id FROM feed_items WHERE id = ANY($1::uuid[]) ORDER BY review_count, floor(EXTRACT(EPOCH FROM COALESCE(last_reviewed_at, created_at)) * 1000), id",
        [mine],
      );
      expect(got).toEqual(expected.map((row) => row.id));
      expect(pages[pages.length - 1]!.nextCursor).toBeNull();
    });

    it("the cursor holds reviewCount and the timestamp, then the id (Task 27; no score)", async () => {
      const page = await json<Page>(await get("/feed?limit=1", importanceEnv()));
      const last = page.items[0]!;
      const [row] = await testDb().query("SELECT review_count, last_reviewed_at, created_at FROM feed_items WHERE id = $1", [last.id]);

      expect(cursorJson(page.nextCursor!)).toEqual({
        v: 1,
        s: "importance",
        k: [row?.review_count, ((row?.last_reviewed_at ?? row?.created_at) as Date).getTime()],
        id: last.id,
      });
    });

    it("the owner of a private deployment pages in importance order too, and sees every card once", async () => {
      const env = privateEnv({ DEFAULT_RESURFACING_STRATEGY: "importance" });
      const pages = await walk(env, 50);
      const ids = pages.flatMap((p) => p.items.map((item) => item.id));
      const [{ n }] = (await testDb().query(
        "SELECT count(*)::int AS n FROM feed_items WHERE snoozed_until IS NULL OR snoozed_until <= NOW()",
      )) as [{ n: number }];

      expect(ids).toHaveLength(n);
      expect(new Set(ids).size).toBe(n);
    });
  });

  describe("cursors are validated and tied to their strategy", () => {
    it("a recency cursor sent to an importance deployment is 400 VALIDATION_CURSOR, and the reverse too", async () => {
      const recencyCursor = (await json<Page>(await get("/feed?limit=1", publicEnv()))).nextCursor!;
      const importanceCursor = (await json<Page>(await get("/feed?limit=1", importanceEnv()))).nextCursor!;

      const a = await get(`/feed?limit=1&cursor=${recencyCursor}`, importanceEnv());
      const b = await get(`/feed?limit=1&cursor=${importanceCursor}`, publicEnv());

      expect([a.status, b.status]).toEqual([400, 400]);
      expect((await json(a)).code).toBe("VALIDATION_CURSOR");
      expect((await json(b)).code).toBe("VALIDATION_CURSOR");
    });

    it("a cursor that names another strategy is refused even when its keys have the right shape", async () => {
      const forged = btoa(JSON.stringify({ v: 1, s: "importance", k: [1700000000000], id: "00000000-0000-4000-8000-000000000000" }))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const response = await get(`/feed?limit=1&cursor=${forged}`, publicEnv());

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_CURSOR");
    });

    it.each([
      ["garbage", "abc"],
      ["empty", ""],
      ["too long", "A".repeat(600)],
      ["a forged cursor with an id that is not a UUID", btoa(JSON.stringify({ v: 1, s: "recency", k: [1], id: "x" })).replace(/=+$/, "")],
      ["a forged cursor with an extra field", btoa(JSON.stringify({ v: 1, s: "recency", k: [1], id: "00000000-0000-4000-8000-000000000000", x: 1 })).replace(/=+$/, "")],
    ])("%s is 400 VALIDATION_CURSOR and echoes nothing", async (_label, cursor) => {
      const response = await get(`/feed?cursor=${encodeURIComponent(cursor)}`, publicEnv());

      expect(response.status).toBe(400);
      const body = await json(response);
      expect(body.code).toBe("VALIDATION_CURSOR");
      expect(JSON.stringify(body)).not.toContain(cursor.slice(0, 20) || "never-present");
    });

    it("a forged but well-formed cursor cannot reach unpublished cards: the published filter still applies", async () => {
      const hidden = await seedCard({ published: false });
      const [row] = await testDb().query("SELECT last_reviewed_at FROM feed_items WHERE id = $1", [hidden.id]);
      // Position the cursor just before the unpublished card.
      const forged = btoa(JSON.stringify({ v: 1, s: "recency", k: [(row?.last_reviewed_at as Date).getTime() - 1], id: "00000000-0000-0000-0000-000000000000" }))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      const page = await json<Page>(await get(`/feed?limit=50&cursor=${forged}`, publicEnv()));

      expect(page.items.map((item) => item.id)).not.toContain(hidden.id);
    });
  });

  describe("what each page carries", () => {
    it("public pages carry only the public fields, and never an unpublished or snoozed card, on any page", async () => {
      const hidden = await seedCard({ published: false });
      const snoozed = await seedCard({ published: true, snoozed: true });
      const pages = await walk(publicEnv(), 50);
      const items = pages.flatMap((p) => p.items);

      expect(items.every((item) => Object.keys(item).sort().join() === PUBLIC_KEYS.join())).toBe(true);
      expect(items.map((item) => item.id)).not.toContain(hidden.id);
      expect(items.map((item) => item.id)).not.toContain(snoozed.id);
      expect(pages[pages.length - 1]!.nextCursor).toBeNull();
    });

    it("every page keeps the cache policy: private, no-store in private mode; none on public reads", async () => {
      const privatePage = await get("/feed?limit=1", privateEnv());
      const cursor = (await json<Page>(privatePage)).nextCursor!;
      const privateNext = await get(`/feed?limit=1&cursor=${cursor}`, privateEnv());
      const publicNext = await get(`/feed?limit=1&cursor=${(await json<Page>(await get("/feed?limit=1", publicEnv()))).nextCursor!}`, publicEnv());

      expect(privatePage.headers.get("Cache-Control")).toBe("private, no-store");
      expect(privateNext.headers.get("Cache-Control")).toBe("private, no-store");
      expect(publicNext.headers.get("Cache-Control")).toBeNull();
    });

    it("a private deployment still refuses an anonymous visitor who sends a valid cursor", async () => {
      const cursor = (await json<Page>(await get("/feed?limit=1", privateEnv()))).nextCursor!;

      const response = await get(`/feed?limit=1&cursor=${cursor}`, privateEnv(), accessContext(null));

      expect(response.status).toBe(401);
    });
  });

  describe("DEFAULT_RESURFACING_STRATEGY", () => {
    it.each(["due_review", "Recency", "IMPORTANCE", " recency", "score", "constructor"])(
      "%j is a generic 500 that does not echo the value",
      async (value) => {
        const response = await get("/feed", publicEnv({ DEFAULT_RESURFACING_STRATEGY: value }));

        expect(response.status).toBe(500);
        const body = await json(response);
        expect(body).toEqual({ error: "Internal server error", code: "INTERNAL_ERROR" });
      },
    );

    it("a bad value does not affect GET /feed/:id, which has no order", async () => {
      const card = await seedCard({ published: true });

      const response = await get(`/feed/${card.id}`, publicEnv({ DEFAULT_RESURFACING_STRATEGY: "due_review" }));

      expect(response.status).toBe(200);
    });
  });
});
