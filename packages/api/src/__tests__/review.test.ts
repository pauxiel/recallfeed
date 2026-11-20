import { REVIEW_ACTIONS } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import {
  APP_ORIGIN,
  DATABASE_TEST_TIMEOUT_MS,
  TEST_API_KEY,
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

const NO_SUCH_CARD = "00000000-0000-4000-8000-000000000000";
const SIX_FIELDS = ["id", "isPublished", "lastReviewedAt", "reviewCount", "savedAt", "snoozedUntil"];
const keyed = { "X-API-Key": TEST_API_KEY };
const sameOrigin = { Origin: APP_ORIGIN };

/** A PUT of a JSON body to a card's review endpoint. */
function put(
  id: string,
  body: unknown,
  env = publicEnv(),
  headers: Record<string, string> = keyed,
  ctx = accessContext({ email: TEST_OWNER }),
): Promise<Response> {
  return call(
    `/feed/${id}/review`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
    env,
    ctx,
  );
}

/** What the database holds for a card, and how many events it has. */
async function stored(id: string) {
  const db = testDb();
  const [card] = await db.query(
    "SELECT review_count, last_reviewed_at, saved_at, snoozed_until, is_published, updated_at FROM feed_items WHERE id = $1",
    [id],
  );
  const [events] = await db.query("SELECT count(*)::int AS n FROM review_events WHERE feed_item_id = $1", [id]);
  return { card, events: events?.n as number };
}

describe.skipIf(databaseUrl === "")(
  "PUT /feed/:id/review (real PostgreSQL through the proxy)",
  { timeout: DATABASE_TEST_TIMEOUT_MS },
  () => {
    describe("the six actions (public deployment, X-API-Key)", () => {
      it("responds with exactly the six fields Spec 05 lists, and nothing else", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "reviewed" });

        expect(response.status).toBe(200);
        const body = await json(response);
        expect(Object.keys(body).sort()).toEqual(SIX_FIELDS);
        expect(body.id).toBe(card.id);
      });

      it("reviewed: counts one review and sets last_reviewed_at", async () => {
        const card = await seedCard();

        const body = await json(await put(card.id, { action: "reviewed" }));

        expect(body).toMatchObject({ reviewCount: 1, savedAt: null, snoozedUntil: null, isPublished: false });
        expect(typeof body.lastReviewedAt).toBe("string");
        expect(Number.isNaN(Date.parse(body.lastReviewedAt as string))).toBe(false);
        expect((await stored(card.id)).card).toMatchObject({ review_count: 1 });
      });

      it("saved sets savedAt and unsaved clears it", async () => {
        const card = await seedCard();

        const saved = await json(await put(card.id, { action: "saved" }));
        const unsaved = await json(await put(card.id, { action: "unsaved" }));

        expect(typeof saved.savedAt).toBe("string");
        expect(unsaved.savedAt).toBeNull();
        expect(saved.reviewCount).toBe(0);
      });

      it("snoozed sets snoozedUntil 24 hours ahead when SNOOZE_DEFAULT_HOURS is unset", async () => {
        const card = await seedCard();

        const body = await json(await put(card.id, { action: "snoozed" }));
        const [event] = await testDb().query("SELECT created_at FROM review_events WHERE feed_item_id = $1", [card.id]);

        expect(Date.parse(body.snoozedUntil as string) - (event?.created_at as Date).getTime()).toBe(24 * 60 * 60 * 1000);
      });

      it("published and unpublished set isPublished", async () => {
        const card = await seedCard();

        const published = await json(await put(card.id, { action: "published" }));
        const unpublished = await json(await put(card.id, { action: "unpublished" }));

        expect(published.isPublished).toBe(true);
        expect(unpublished.isPublished).toBe(false);
      });

      it.each(REVIEW_ACTIONS)("%s writes exactly one event", async (action) => {
        const card = await seedCard();

        expect((await put(card.id, { action })).status).toBe(200);

        expect((await stored(card.id)).events).toBe(1);
      });

      it("ignores every other field in the body, so a caller cannot set state directly", async () => {
        const card = await seedCard();
        const before = (await stored(card.id)).card!;

        const response = await put(card.id, {
          action: "saved",
          reviewCount: 999,
          isPublished: true,
          snoozedUntil: "2999-01-01T00:00:00Z",
          lastReviewedAt: "2000-01-01T00:00:00Z",
          id: NO_SUCH_CARD,
          content: "overwritten",
        });

        // Only the named action ran: saved_at was set, and every other field is what it was before the request.
        const body = await json(response);
        expect(body).toMatchObject({ id: card.id, reviewCount: 0, isPublished: false, snoozedUntil: null });
        expect(typeof body.savedAt).toBe("string");
        expect(new Date(body.lastReviewedAt as string).getTime()).toBe((before.last_reviewed_at as Date).getTime());
        const { card: after } = await stored(card.id);
        expect(after).toMatchObject({ review_count: 0, is_published: false, snoozed_until: null });
        expect((after!.last_reviewed_at as Date).getTime()).toBe((before.last_reviewed_at as Date).getTime());
        expect((after!.last_reviewed_at as Date).getUTCFullYear()).not.toBe(2000);
        const [content] = await testDb().query("SELECT content FROM feed_items WHERE id = $1", [card.id]);
        expect(content?.content).toBe(card.content);
      });

      it("repeating an action is allowed: reviewed counts again, published stays published", async () => {
        const card = await seedCard();

        const first = await json(await put(card.id, { action: "reviewed" }));
        const second = await json(await put(card.id, { action: "reviewed" }));
        const p1 = await put(card.id, { action: "published" });
        const p2 = await put(card.id, { action: "published" });

        expect([first.reviewCount, second.reviewCount]).toEqual([1, 2]);
        expect([p1.status, p2.status]).toEqual([200, 200]);
        expect((await stored(card.id)).events).toBe(4);
      });

      it("a charset on the content type is accepted", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "reviewed" }, publicEnv(), { ...keyed, "Content-Type": "application/json; charset=utf-8" });

        expect(response.status).toBe(200);
      });

      it("the response carries a request ID and, in public mode, no-store", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "reviewed" });

        expect(response.headers.get("X-Request-Id")).toMatch(/\S+/);
        expect(response.headers.get("Cache-Control")).toBe("no-store");
      });
    });

    describe("private deployment, the owner", () => {
      it("the owner's same-origin request succeeds and the response is private, no-store", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "published" }, privateEnv(), sameOrigin);

        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(await json(response)).toMatchObject({ id: card.id, isPublished: true });
      });

      it("a same-origin Referer is accepted when there is no Origin", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "saved" }, privateEnv(), { Referer: `${APP_ORIGIN}/feed` });

        expect(response.status).toBe(200);
      });

      it("every refusal is also private, no-store", async () => {
        const card = await seedCard();
        const anonymous = await put(card.id, { action: "saved" }, privateEnv(), sameOrigin, accessContext(null));
        const crossOrigin = await put(card.id, { action: "saved" }, privateEnv(), { Origin: "https://evil.example" });
        const invalid = await put(card.id, { action: "nope" }, privateEnv(), sameOrigin);
        const missing = await put(NO_SUCH_CARD, { action: "saved" }, privateEnv(), sameOrigin);

        for (const response of [anonymous, crossOrigin, invalid, missing]) {
          expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        }
      });
    });

    describe("invalid requests are 400 and change nothing", () => {
      const bodies: [string, unknown][] = [
        ["an unknown action", { action: "invalid" }],
        ["an empty action", { action: "" }],
        ["a wrong-case action", { action: "Reviewed" }],
        ["an action with trailing space", { action: "reviewed " }],
        ["an old name for an action", { action: "publish" }],
        ["a missing action", {}],
        ["a null action", { action: null }],
        ["a numeric action", { action: 1 }],
        ["an array action", { action: ["reviewed"] }],
        ["an object action", { action: { name: "reviewed" } }],
        ["an inherited property name", { action: "constructor" }],
        ["an injection attempt", { action: "reviewed'; DROP TABLE feed_items; --" }],
        ["a JSON array body", ["reviewed"]],
        ["a JSON string body", '"reviewed"'],
        ["a JSON null body", "null"],
        ["a JSON number body", "42"],
      ];

      it.each(bodies)("%s", async (_label, body) => {
        const card = await seedCard();
        const before = await stored(card.id);

        const response = await put(card.id, body);

        expect(response.status).toBe(400);
        const error = await json(response);
        expect(Object.keys(error).sort()).toEqual(["code", "error"]);
        expect(String(error.code)).toMatch(/^VALIDATION_/);
        expect(await stored(card.id)).toEqual(before);
      });

      it("the unknown-action 400 names the code and the allowed actions, and echoes nothing from the request", async () => {
        const card = await seedCard();

        const error = await json(await put(card.id, { action: "<script>alert(1)</script>" }));

        expect(error.code).toBe("VALIDATION_REVIEW_ACTION");
        expect(String(error.error)).toContain("reviewed, saved, unsaved, snoozed, published, unpublished");
        expect(JSON.stringify(error)).not.toContain("script");
      });

      it.each([
        ["not JSON", "{not json", "VALIDATION_JSON"],
        ["empty", "", "VALIDATION_JSON"],
        ["truncated", '{"action": "revi', "VALIDATION_JSON"],
      ])("a body that is %s is 400 %s", async (_label, body, code) => {
        const card = await seedCard();

        const response = await put(card.id, body);

        expect(response.status).toBe(400);
        expect((await json(response)).code).toBe(code);
        expect((await stored(card.id)).events).toBe(0);
      });

      it.each([
        ["no Content-Type", {}],
        ["text/plain", { "Content-Type": "text/plain" }],
        ["text/markdown", { "Content-Type": "text/markdown" }],
        ["a form", { "Content-Type": "application/x-www-form-urlencoded" }],
      ])("%s is 400 VALIDATION_CONTENT_TYPE", async (_label, extra) => {
        const card = await seedCard();
        const response = await call(
          `/feed/${card.id}/review`,
          { method: "PUT", headers: { ...keyed, ...extra }, body: JSON.stringify({ action: "reviewed" }) },
          publicEnv(),
        );

        expect(response.status).toBe(400);
        expect((await json(response)).code).toBe("VALIDATION_CONTENT_TYPE");
        expect((await stored(card.id)).events).toBe(0);
      });

      it("a body over 1 KB is 400 VALIDATION_SIZE even when it contains a valid action", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "reviewed", padding: "x".repeat(2000) });

        expect(response.status).toBe(400);
        expect((await json(response)).code).toBe("VALIDATION_SIZE");
        expect((await stored(card.id)).events).toBe(0);
      });

      it("a body that is not valid UTF-8 is 400 VALIDATION_ENCODING", async () => {
        const card = await seedCard();
        const bytes = new Uint8Array([0x7b, 0x22, 0x61, 0xff, 0xfe, 0x22, 0x7d]);

        const response = await call(
          `/feed/${card.id}/review`,
          { method: "PUT", headers: { "Content-Type": "application/json", ...keyed }, body: bytes },
          publicEnv(),
        );

        expect(response.status).toBe(400);
        expect((await json(response)).code).toBe("VALIDATION_ENCODING");
      });

      it("a bad action for a card that does not exist is 400, not 404: the body is checked first", async () => {
        expect((await put(NO_SUCH_CARD, { action: "nope" })).status).toBe(400);
      });
    });

    describe("a card that does not exist is 404 and nothing is written", () => {
      it.each([
        ["an unknown UUID", NO_SUCH_CARD],
        ["a malformed ID", "not-a-uuid"],
        ["an injection string", "1%20OR%201%3D1"],
        ["a quoted injection string", "%27%3B%20DROP%20TABLE%20feed_items%3B--"],
      ])("%s", async (_label, id) => {
        const before = await testDb().query("SELECT count(*)::int AS n FROM review_events");

        for (const action of REVIEW_ACTIONS) {
          const response = await put(id, { action });
          expect(response.status).toBe(404);
          expect(await json(response)).toEqual({ error: "Feed item not found", code: "NOT_FOUND_FEED_ITEM" });
        }

        const after = await testDb().query("SELECT count(*)::int AS n FROM review_events");
        expect(after[0]?.n).toBe(before[0]?.n);
      });
    });

    describe("authorization is checked first, and a refused request changes nothing", () => {
      /** Malformed or unacceptable bodies. Each would be a 400 for an authorized caller. */
      const malformed: [string, Record<string, string>, string][] = [
        ["invalid JSON", { "Content-Type": "application/json" }, "{not json"],
        ["an unknown action", { "Content-Type": "application/json" }, '{"action":"nope"}'],
        ["a body over the 1 KB cap", { "Content-Type": "application/json" }, JSON.stringify({ action: "reviewed", pad: "x".repeat(4000) })],
        ["the wrong content type", { "Content-Type": "text/plain" }, '{"action":"reviewed"}'],
        ["an empty body", { "Content-Type": "application/json" }, ""],
      ];

      /**
       * Sends every malformed body to a real card and to a missing one with the given refused credentials,
       * and checks that each refusal is the expected one, identical for both cards, and writes nothing.
       */
      async function expectMalformedRefused(
        env: ReturnType<typeof publicEnv>,
        credentials: Record<string, string>,
        ctx: ReturnType<typeof accessContext>,
        status: number,
        code: string,
      ): Promise<void> {
        const real = await seedCard();
        const before = await stored(real.id);
        const totalBefore = (await testDb().query("SELECT count(*)::int AS n FROM review_events"))[0]?.n as number;

        for (const [label, headers, body] of malformed) {
          const send = (id: string): Promise<Response> =>
            call(`/feed/${id}/review`, { method: "PUT", headers: { ...headers, ...credentials }, body }, env, ctx);
          const forReal = await send(real.id);
          const forMissing = await send(NO_SUCH_CARD);

          expect([forReal.status, forMissing.status], label).toEqual([status, status]);
          const realBody = await json(forReal);
          expect(realBody.code, label).toBe(code);
          // The same answer whether or not the card exists, so a refused caller learns nothing about it.
          expect(await json(forMissing), label).toEqual(realBody);
        }

        expect(await stored(real.id)).toEqual(before);
        expect((await testDb().query("SELECT count(*)::int AS n FROM review_events"))[0]?.n).toBe(totalBefore);
      }

      it("public key mode: a malformed body without a valid key is refused for authorization, writes nothing, and reveals nothing", async () => {
        await expectMalformedRefused(publicEnv(), {}, accessContext(null), 401, "AUTH_API_KEY_MISSING");
        await expectMalformedRefused(publicEnv(), { "X-API-Key": "wrong" }, accessContext(null), 403, "AUTH_API_KEY_INVALID");
      });

      it("private owner mode: a malformed same-origin body from a non-owner is refused for authorization, writes nothing, and reveals nothing", async () => {
        await expectMalformedRefused(privateEnv(), sameOrigin, accessContext(null), 401, "AUTH_REQUIRED");
        await expectMalformedRefused(privateEnv(), sameOrigin, accessContext({ email: "other@example.test" }), 403, "AUTH_FORBIDDEN");
      });

      async function expectRefused(label: string, send: (id: string) => Promise<Response>, status: number, code: string) {
        const card = await seedCard();
        const before = await stored(card.id);

        const response = await send(card.id);

        expect(response.status, label).toBe(status);
        expect((await json(response)).code, label).toBe(code);
        expect(await stored(card.id), label).toEqual(before);
      }
      it("public: no API key is 401 AUTH_API_KEY_MISSING", async () => {
        await expectRefused("no key", (id) => put(id, { action: "published" }, publicEnv(), {}), 401, "AUTH_API_KEY_MISSING");
      });

      it("public: a wrong API key is 403 AUTH_API_KEY_INVALID", async () => {
        await expectRefused("wrong key", (id) => put(id, { action: "published" }, publicEnv(), { "X-API-Key": "wrong" }), 403, "AUTH_API_KEY_INVALID");
      });

      it("public: an owner identity does not stand in for the key", async () => {
        await expectRefused("identity only", (id) => put(id, { action: "published" }, publicEnv(), {}, accessContext({ email: TEST_OWNER })), 401, "AUTH_API_KEY_MISSING");
      });

      it("public: a deployment with no API_SECRET_KEY refuses every write with a generic 500", async () => {
        await expectRefused("no secret configured", (id) => put(id, { action: "published" }, publicEnv({ API_SECRET_KEY: undefined })), 500, "AUTH_NOT_CONFIGURED");
      });

      it("private: no identity is 401 AUTH_REQUIRED", async () => {
        await expectRefused("anonymous", (id) => put(id, { action: "published" }, privateEnv(), sameOrigin, accessContext(null)), 401, "AUTH_REQUIRED");
      });

      it("private: someone other than the owner is 403 AUTH_FORBIDDEN", async () => {
        await expectRefused(
          "stranger",
          (id) => put(id, { action: "published" }, privateEnv(), sameOrigin, accessContext({ email: "other@example.test" })),
          403,
          "AUTH_FORBIDDEN",
        );
      });

      it("private: an API key does not open a private deployment", async () => {
        await expectRefused(
          "key in private",
          (id) => put(id, { action: "published" }, privateEnv({ API_SECRET_KEY: TEST_API_KEY }), { ...sameOrigin, ...keyed }, accessContext(null)),
          401,
          "AUTH_REQUIRED",
        );
      });

      it("a deployment with no FEED_VISIBILITY is private, so an API key alone is refused", async () => {
        await expectRefused(
          "visibility unset",
          (id) =>
            put(id, { action: "published" }, { DATABASE_URL: databaseUrl, API_SECRET_KEY: TEST_API_KEY, OWNER_EMAIL: TEST_OWNER }, { ...sameOrigin, ...keyed }, accessContext(null)),
          401,
          "AUTH_REQUIRED",
        );
      });

      it("an unrecognized FEED_VISIBILITY is private too", async () => {
        await expectRefused(
          "visibility Public ",
          (id) => put(id, { action: "published" }, privateEnv({ FEED_VISIBILITY: "Public " }), { ...sameOrigin, ...keyed }, accessContext(null)),
          401,
          "AUTH_REQUIRED",
        );
      });

      it("authorization comes before the body is read: an unauthorized oversize or invalid body is 401, not 400", async () => {
        const card = await seedCard();

        const huge = await put(card.id, "x".repeat(5000), publicEnv(), {});
        const garbage = await put(card.id, "{not json", publicEnv(), {});
        const badAction = await put(card.id, { action: "nope" }, publicEnv(), {});

        expect([huge.status, garbage.status, badAction.status]).toEqual([401, 401, 401]);
      });

      it("authorization comes before the lookup: an unauthorized caller gets the same answer for a real and a missing card", async () => {
        const real = await seedCard();

        const forReal = await put(real.id, { action: "reviewed" }, publicEnv(), {});
        const forMissing = await put(NO_SUCH_CARD, { action: "reviewed" }, publicEnv(), {});

        expect([forReal.status, forMissing.status]).toEqual([401, 401]);
        expect(await json(forReal)).toEqual(await json(forMissing));
      });
    });

    describe("private mode refuses cross-origin writes (CSRF)", () => {
      async function expectCsrfRefused(headers: Record<string, string>, code: string) {
        const card = await seedCard();
        const before = await stored(card.id);

        const response = await put(card.id, { action: "published" }, privateEnv(), headers);

        expect(response.status).toBe(403);
        expect((await json(response)).code).toBe(code);
        expect(await stored(card.id)).toEqual(before);
      }

      it("a different Origin is 403 CSRF_ORIGIN_MISMATCH", async () => {
        await expectCsrfRefused({ Origin: "https://evil.example" }, "CSRF_ORIGIN_MISMATCH");
      });

      it("the literal null Origin is refused", async () => {
        await expectCsrfRefused({ Origin: "null" }, "CSRF_ORIGIN_MISMATCH");
      });

      it("no Origin and no Referer is 403 CSRF_ORIGIN_MISSING", async () => {
        await expectCsrfRefused({}, "CSRF_ORIGIN_MISSING");
      });

      it("a cross-origin Referer is refused", async () => {
        await expectCsrfRefused({ Referer: "https://evil.example/page" }, "CSRF_ORIGIN_MISMATCH");
      });

      it("CSRF is checked before authorization, as for import: a cross-origin anonymous request is 403", async () => {
        const card = await seedCard();

        const response = await put(card.id, { action: "published" }, privateEnv(), { Origin: "https://evil.example" }, accessContext(null));

        expect(response.status).toBe(403);
      });

      it("public mode has no ambient credential, so no Origin is required", async () => {
        const card = await seedCard();

        expect((await put(card.id, { action: "saved" }, publicEnv(), keyed)).status).toBe(200);
      });
    });

    describe("SNOOZE_DEFAULT_HOURS", () => {
      it.each(["1", "6", "72", "8760"])("snoozes for %s hours when set", async (hours) => {
        const card = await seedCard();

        const body = await json(await put(card.id, { action: "snoozed" }, publicEnv({ SNOOZE_DEFAULT_HOURS: hours })));
        const [event] = await testDb().query("SELECT created_at FROM review_events WHERE feed_item_id = $1", [card.id]);

        expect(Date.parse(body.snoozedUntil as string) - (event?.created_at as Date).getTime()).toBe(Number(hours) * 60 * 60 * 1000);
      });

      it.each(["0", "-1", "8761", "abc", "1.5", "1e1", " 12", "0x10"])(
        "an unusable value %j is a generic 500 for snoozed, the card is unchanged, and the value is not echoed",
        async (hours) => {
          const card = await seedCard();
          const before = await stored(card.id);

          const response = await put(card.id, { action: "snoozed" }, publicEnv({ SNOOZE_DEFAULT_HOURS: hours }));

          expect(response.status).toBe(500);
          const body = await json(response);
          expect(body).toEqual({ error: "Internal server error", code: "INTERNAL_ERROR" });
          expect(JSON.stringify(body)).not.toContain(hours.trim() || "never");
          expect(await stored(card.id)).toEqual(before);
        },
      );

      it("an unusable value does not break the other five actions", async () => {
        const card = await seedCard();
        const env = publicEnv({ SNOOZE_DEFAULT_HOURS: "abc" });

        for (const action of REVIEW_ACTIONS.filter((a) => a !== "snoozed")) {
          expect((await put(card.id, { action }, env)).status, action).toBe(200);
        }
      });
    });

    describe("routing", () => {
      it.each(["GET", "POST", "PATCH", "DELETE"])("%s on the review path is not a route", async (method) => {
        const card = await seedCard();

        const response = await call(`/feed/${card.id}/review`, { method, headers: { ...keyed, ...sameOrigin } }, publicEnv());

        expect(response.status).toBe(404);
        expect((await json(response)).code).toBe("NOT_FOUND_ROUTE");
      });

      it("there is no separate publish endpoint: publishing is the review action only (Spec 05)", async () => {
        const card = await seedCard();

        for (const path of ["publish", "unpublish", "save", "snooze"]) {
          const response = await call(`/feed/${card.id}/${path}`, { method: "PUT", headers: { "Content-Type": "application/json", ...keyed }, body: "{}" }, publicEnv());
          expect(response.status, path).toBe(404);
        }
        expect((await stored(card.id)).events).toBe(0);
      });
    });
  },
);
