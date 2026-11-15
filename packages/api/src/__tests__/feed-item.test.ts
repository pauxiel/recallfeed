import { describe, expect, it } from "vitest";
import { DATABASE_TEST_TIMEOUT_MS, TEST_OWNER, accessContext, call, databaseUrl, json, privateEnv, publicEnv, seedCard } from "./helpers";

const PUBLIC_KEYS = ["cardType", "content", "createdAt", "id", "isAiGenerated", "noteId"];
const get = (path: string, env = publicEnv(), ctx = accessContext({ email: TEST_OWNER })): Promise<Response> =>
  call(path, { method: "GET" }, env, ctx);

describe.skipIf(databaseUrl === "")("GET /feed/:id (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  describe("public deployment", () => {
    it("a published card is returned with exactly the public fields", async () => {
      const card = await seedCard({ published: true });

      const response = await get(`/feed/${card.id}`);

      expect(response.status).toBe(200);
      const body = await json(response);
      expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
      expect(body).toMatchObject({ id: card.id, content: card.content, cardType: "original", isAiGenerated: false });
    });

    it("an unpublished card, a missing card, and a malformed ID give the identical 404", async () => {
      const unpublished = await seedCard({ published: false });
      const missing = "00000000-0000-4000-8000-000000000000";

      const bodies: unknown[] = [];
      for (const id of [unpublished.id, missing, "not-a-uuid", "1%20OR%201%3D1", "%27%3B%20DROP%20TABLE%20feed_items%3B--"]) {
        const response = await get(`/feed/${id}`);
        expect(response.status).toBe(404);
        bodies.push(await json(response));
      }

      expect(bodies[0]).toEqual({ error: "Feed item not found", code: "NOT_FOUND_FEED_ITEM" });
      for (const body of bodies) {
        expect(body).toEqual(bodies[0]);
      }
    });

    it("the unpublished card stays hidden even to a request that claims to be the owner", async () => {
      const unpublished = await seedCard({ published: false });

      // Identity is ignored in a public deployment: reads are anonymous and published-only.
      const response = await get(`/feed/${unpublished.id}`, publicEnv(), accessContext({ email: TEST_OWNER }));

      expect(response.status).toBe(404);
    });

    it("an unknown route is a JSON 404, not a card lookup", async () => {
      const response = await get("/feed/a/b");

      expect(response.status).toBe(404);
      expect((await json(response)).code).toBe("NOT_FOUND_ROUTE");
    });
  });

  describe("private deployment", () => {
    it("the owner reads an unpublished card with every field", async () => {
      const card = await seedCard({ published: false });

      const response = await get(`/feed/${card.id}`, privateEnv());

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await json(response);
      expect(body).toMatchObject({ id: card.id, sourceId: card.sourceId, isPublished: false, reviewCount: 0 });
      expect(Object.keys(body)).toEqual(expect.arrayContaining(["sourceId", "isPublished", "lastReviewedAt", "snoozedUntil"]));
    });

    it("an anonymous visitor is 401 and a different user is 403, and neither learns whether the card exists", async () => {
      const card = await seedCard({ published: true });
      const missing = "00000000-0000-4000-8000-000000000000";

      for (const id of [card.id, missing]) {
        const anonymous = await get(`/feed/${id}`, privateEnv(), accessContext(null));
        const stranger = await get(`/feed/${id}`, privateEnv(), accessContext({ email: "someone-else@example.test" }));

        expect(anonymous.status).toBe(401);
        expect(stranger.status).toBe(403);
        expect(anonymous.headers.get("Cache-Control")).toBe("private, no-store");
        expect(Object.keys(await json(anonymous)).sort()).toEqual(["code", "error"]);
      }
    });

    it("a missing card is a 404 with the private cache policy", async () => {
      const response = await get("/feed/00000000-0000-4000-8000-000000000000", privateEnv());

      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect((await json(response)).code).toBe("NOT_FOUND_FEED_ITEM");
    });

    it("a deployment with no FEED_VISIBILITY does not serve published cards anonymously", async () => {
      const card = await seedCard({ published: true });

      const response = await get(
        `/feed/${card.id}`,
        { DATABASE_URL: databaseUrl, OWNER_EMAIL: TEST_OWNER },
        accessContext(null),
      );

      expect(response.status).toBe(401);
    });

    it("a deployment with an unrecognized FEED_VISIBILITY does not serve published cards anonymously", async () => {
      const card = await seedCard({ published: true });

      const response = await get(`/feed/${card.id}`, privateEnv({ FEED_VISIBILITY: "Public " }), accessContext(null));

      expect(response.status).toBe(401);
    });
  });
});
