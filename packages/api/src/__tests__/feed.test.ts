import { describe, expect, it } from "vitest";
import { DATABASE_TEST_TIMEOUT_MS, TEST_OWNER, accessContext, call, databaseUrl, json, privateEnv, publicEnv, seedCard } from "./helpers";

type Item = Record<string, unknown> & { id: string };
type FeedBody = { items: Item[] };

const PUBLIC_KEYS = ["cardType", "content", "createdAt", "id", "isAiGenerated", "noteId"];
const get = (path: string, env = publicEnv(), ctx = accessContext({ email: TEST_OWNER })): Promise<Response> =>
  call(path, { method: "GET" }, env, ctx);

describe.skipIf(databaseUrl === "")("GET /feed (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  describe("public deployment", () => {
    it("returns published cards only, oldest review time first, and hides unpublished and snoozed ones", async () => {
      // Each card seeded later is older, so it sorts first. The hidden ones are the oldest of all:
      // without a working filter they would head the list.
      const first = await seedCard({ published: true });
      const second = await seedCard({ published: true });
      const unpublished = await seedCard({ published: false });
      const snoozed = await seedCard({ published: true, snoozed: true });

      const response = await get("/feed?limit=50");
      expect(response.status).toBe(200);
      const { items } = await json<FeedBody>(response);
      const ids = items.map((item) => item.id);

      expect(ids.slice(0, 2)).toEqual([second.id, first.id]);
      expect(ids).not.toContain(unpublished.id);
      expect(ids).not.toContain(snoozed.id);
    });

    it("exposes exactly the public fields of each card and nothing else", async () => {
      await seedCard({ published: true });

      const { items } = await json<FeedBody>(await get("/feed?limit=50"));

      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual(PUBLIC_KEYS);
      }
    });

    it("returns { items } with no cursor, and limit bounds the page", async () => {
      const oldestSeeded = await seedCard({ published: true });
      const middle = await seedCard({ published: true });
      const newestSeeded = await seedCard({ published: true });

      const body = await json<FeedBody>(await get("/feed?limit=2"));

      // The last card seeded has the oldest review time, so it leads the list.
      expect(Object.keys(body)).toEqual(["items"]);
      expect(body.items.map((item) => item.id)).toEqual([newestSeeded.id, middle.id]);
      expect(body.items.map((item) => item.id)).not.toContain(oldestSeeded.id);
    });

    it("the default page is at most 10 cards", async () => {
      for (let i = 0; i < 3; i += 1) {
        await seedCard({ published: true });
      }

      const { items } = await json<FeedBody>(await get("/feed"));

      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.length).toBeLessThanOrEqual(10);
    });

    it.each(["0", "51", "-1", "abc", "1.5", "", "1e1", "0x10", "%2010", "1000"])(
      "limit=%j is 400 VALIDATION_LIMIT and is not clamped",
      async (limit) => {
        const response = await get(`/feed?limit=${limit}`);

        expect(response.status).toBe(400);
        expect((await json(response)).code).toBe("VALIDATION_LIMIT");
      },
    );

    it.each(["1", "50"])("limit=%s, the bounds, is accepted", async (limit) => {
      expect((await get(`/feed?limit=${limit}`)).status).toBe(200);
    });

    it("any cursor is 400 VALIDATION_CURSOR_UNSUPPORTED instead of being ignored", async () => {
      for (const query of ["cursor=abc", "cursor=", "cursor=abc&limit=5"]) {
        const response = await get(`/feed?${query}`);

        expect(response.status).toBe(400);
        expect((await json(response)).code).toBe("VALIDATION_CURSOR_UNSUPPORTED");
      }
    });

    it("anonymous reads need no key and no identity", async () => {
      const response = await get("/feed", publicEnv(), accessContext(null));

      expect(response.status).toBe(200);
    });

    it("a GET sets no no-store header of its own in public mode", async () => {
      expect((await get("/feed")).headers.get("Cache-Control")).toBeNull();
    });

    it("a public read returns a request ID", async () => {
      expect((await get("/feed")).headers.get("X-Request-Id")).toMatch(/\S+/);
    });
  });

  describe("private deployment", () => {
    it("the owner sees unpublished cards with every field, snoozed ones stay hidden", async () => {
      const first = await seedCard({ published: false });
      const second = await seedCard({ published: true });
      const snoozed = await seedCard({ published: false, snoozed: true });

      const response = await get("/feed?limit=50", privateEnv());
      expect(response.status).toBe(200);
      const { items } = await json<FeedBody>(response);
      const ids = items.map((item) => item.id);

      expect(ids.slice(0, 2)).toEqual([second.id, first.id]);
      expect(ids).not.toContain(snoozed.id);
      const full = items[1];
      expect(full).toMatchObject({ id: first.id, isPublished: false, reviewCount: 0, snoozedUntil: null });
      expect(Object.keys(full ?? {})).toEqual(expect.arrayContaining(["sourceId", "isPublished", "lastReviewedAt"]));
    });

    it("every response is private, no-store", async () => {
      const ok = await get("/feed", privateEnv());
      const bad = await get("/feed?limit=0", privateEnv());
      const denied = await get("/feed", privateEnv(), accessContext(null));

      for (const response of [ok, bad, denied]) {
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      }
    });

    it("an anonymous visitor is 401 and a different user is 403, with no card data", async () => {
      await seedCard({ published: true });

      const anonymous = await get("/feed", privateEnv(), accessContext(null));
      const stranger = await get("/feed", privateEnv(), accessContext({ email: "someone-else@example.test" }));

      expect(anonymous.status).toBe(401);
      expect(stranger.status).toBe(403);
      for (const response of [anonymous, stranger]) {
        const body = await json(response);
        expect(Object.keys(body).sort()).toEqual(["code", "error"]);
      }
    });

    it("a valid API key does not open a private feed", async () => {
      const response = await call(
        "/feed",
        { method: "GET", headers: { "X-API-Key": "test-api-key-not-a-secret-0123456789" } },
        privateEnv({ API_SECRET_KEY: "test-api-key-not-a-secret-0123456789" }),
        accessContext(null),
      );

      expect(response.status).toBe(401);
    });

    it("a deployment with no FEED_VISIBILITY is private", async () => {
      const response = await get(
        "/feed",
        { DATABASE_URL: databaseUrl, OWNER_EMAIL: TEST_OWNER },
        accessContext(null),
      );

      expect(response.status).toBe(401);
    });

    it("a bad limit is still 400 for the owner, and the check does not run for a stranger", async () => {
      expect((await get("/feed?limit=0", privateEnv())).status).toBe(400);
      expect((await get("/feed?limit=0", privateEnv(), accessContext(null))).status).toBe(401);
    });

    it("a cursor is 400 for the owner too", async () => {
      const response = await get("/feed?cursor=abc", privateEnv());

      expect(response.status).toBe(400);
      expect((await json(response)).code).toBe("VALIDATION_CURSOR_UNSUPPORTED");
    });
  });
});
