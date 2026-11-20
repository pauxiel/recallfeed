import { REVIEW_ACTIONS } from "@recallfeed/core";
import type { ReviewAction } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import {
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

const keyed = { "X-API-Key": TEST_API_KEY };
const PUBLIC_KEYS = ["cardType", "content", "createdAt", "id", "isAiGenerated", "noteId"];

/** Applies an action through the real endpoint (public deployment, API key). */
function act(id: string, action: ReviewAction): Promise<Response> {
  return call(
    `/feed/${id}/review`,
    { method: "PUT", headers: { "Content-Type": "application/json", ...keyed }, body: JSON.stringify({ action }) },
    publicEnv(),
  );
}

/** Everything the database holds about a card and its log, in one query. */
async function snapshot(id: string) {
  const [row] = await testDb().query(
    `SELECT review_count, last_reviewed_at, saved_at, snoozed_until, is_published, updated_at,
            (SELECT count(*)::int FROM review_events WHERE feed_item_id = $1) AS events,
            (snoozed_until > NOW()) AS snoozed_in_future
       FROM feed_items WHERE id = $1`,
    [id],
  );
  return row as {
    review_count: number;
    last_reviewed_at: Date | null;
    saved_at: Date | null;
    snoozed_until: Date | null;
    is_published: boolean;
    updated_at: Date;
    events: number;
    snoozed_in_future: boolean | null;
  };
}

async function eventActions(id: string): Promise<string[]> {
  const rows = await testDb().query("SELECT action FROM review_events WHERE feed_item_id = $1 ORDER BY created_at, id", [id]);
  return rows.map((row) => row.action as string);
}

/** The ids on the first page of a feed, as an anonymous visitor to a public deployment. */
async function publicFeedIds(): Promise<string[]> {
  const response = await call("/feed?limit=50", { method: "GET" }, publicEnv());
  expect(response.status).toBe(200);
  return (await json<{ items: { id: string }[] }>(response)).items.map((item) => item.id);
}

/** The ids on the first page of a feed, as the owner of a private deployment. */
async function ownerFeedIds(): Promise<string[]> {
  const response = await call("/feed?limit=50", { method: "GET" }, privateEnv(), accessContext({ email: TEST_OWNER }));
  expect(response.status).toBe(200);
  return (await json<{ items: { id: string }[] }>(response)).items.map((item) => item.id);
}

const publicGet = (id: string): Promise<Response> => call(`/feed/${id}`, { method: "GET" }, publicEnv());

describe.skipIf(databaseUrl === "")(
  "review state transitions (real PostgreSQL through the proxy)",
  { timeout: DATABASE_TEST_TIMEOUT_MS },
  () => {
    describe("reviewed", () => {
      it("each review adds one to the count and moves last_reviewed_at forward, and the database agrees with the response", async () => {
        const card = await seedCard();
        const start = await snapshot(card.id);
        expect(start).toMatchObject({ review_count: 0, events: 0 });

        const seen: { count: number; at: number }[] = [];
        for (let n = 1; n <= 3; n += 1) {
          const body = await json(await act(card.id, "reviewed"));
          const row = await snapshot(card.id);

          expect(body.reviewCount).toBe(n);
          expect(row.review_count).toBe(n);
          expect(row.events).toBe(n);
          expect(new Date(body.lastReviewedAt as string).getTime()).toBe(row.last_reviewed_at!.getTime());
          seen.push({ count: n, at: row.last_reviewed_at!.getTime() });
        }

        // The seeded card began with a review time in 1843, so the first review is a large step forward,
        // and later reviews never move it back.
        expect(seen[0]!.at).toBeGreaterThan(start.last_reviewed_at!.getTime());
        expect(seen[1]!.at).toBeGreaterThanOrEqual(seen[0]!.at);
        expect(seen[2]!.at).toBeGreaterThanOrEqual(seen[1]!.at);
        expect(Date.now() - seen[2]!.at).toBeLessThan(10 * 60 * 1000);
      });

      it("a review changes nothing about saving, snoozing or publishing", async () => {
        const card = await seedCard({ published: true });
        await act(card.id, "saved");
        await act(card.id, "snoozed");
        const before = await snapshot(card.id);

        await act(card.id, "reviewed");
        const after = await snapshot(card.id);

        expect(after.saved_at).toEqual(before.saved_at);
        expect(after.snoozed_until).toEqual(before.snoozed_until);
        expect(after.is_published).toBe(true);
        expect(after.review_count).toBe(before.review_count + 1);
      });

      it("five simultaneous reviews all count: five in the count, five in the log, no lost update", async () => {
        const card = await seedCard();

        const responses = await Promise.all(Array.from({ length: 5 }, () => act(card.id, "reviewed")));
        const counts = (await Promise.all(responses.map((r) => json(r)))).map((b) => b.reviewCount as number);

        expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
        expect(counts.sort()).toEqual([1, 2, 3, 4, 5]);
        expect(await snapshot(card.id)).toMatchObject({ review_count: 5, events: 5 });
      });
    });

    describe("saved and unsaved", () => {
      it("saved, unsaved, saved again: saved_at is set, cleared, then set, and the count never moves", async () => {
        const card = await seedCard();
        const trail: (boolean | number)[] = [];

        for (const action of ["saved", "unsaved", "saved"] as const) {
          const body = await json(await act(card.id, action));
          const row = await snapshot(card.id);
          expect(body.savedAt === null, action).toBe(row.saved_at === null);
          trail.push(row.saved_at !== null, row.review_count);
        }

        expect(trail).toEqual([true, 0, false, 0, true, 0]);
        expect(await eventActions(card.id)).toEqual(["saved", "unsaved", "saved"]);
      });

      it("saving twice keeps it saved and logs both", async () => {
        const card = await seedCard();

        await act(card.id, "saved");
        const second = await json(await act(card.id, "saved"));

        expect(typeof second.savedAt).toBe("string");
        expect((await snapshot(card.id)).events).toBe(2);
      });

      it("saving does not change what the public feed shows", async () => {
        const card = await seedCard({ published: true });
        const before = (await publicFeedIds()).includes(card.id);

        await act(card.id, "saved");

        expect(before).toBe(true);
        expect(await publicFeedIds()).toContain(card.id);
        const body = await json(await publicGet(card.id));
        expect(Object.keys(body).sort()).toEqual(PUBLIC_KEYS);
      });
    });

    describe("snoozed", () => {
      it("sets a future time, hides the card from every feed list until it expires, then it comes back", async () => {
        const card = await seedCard({ published: true });
        expect(await publicFeedIds()).toContain(card.id);
        expect(await ownerFeedIds()).toContain(card.id);

        const snoozed = await json(await act(card.id, "snoozed"));
        const row = await snapshot(card.id);

        expect(Date.parse(snoozed.snoozedUntil as string)).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
        expect(row.snoozed_in_future).toBe(true);
        expect(await publicFeedIds()).not.toContain(card.id);
        expect(await ownerFeedIds()).not.toContain(card.id);

        // Expire the snooze the only way a test can without waiting a day: move the end time into the past.
        await testDb().query("UPDATE feed_items SET snoozed_until = NOW() - interval '1 minute' WHERE id = $1", [card.id]);

        expect((await snapshot(card.id)).snoozed_in_future).toBe(false);
        expect(await publicFeedIds()).toContain(card.id);
        expect(await ownerFeedIds()).toContain(card.id);
      });

      it("a snooze hides the card from the lists only: it can still be fetched by ID", async () => {
        const card = await seedCard({ published: true });
        await act(card.id, "snoozed");

        const response = await publicGet(card.id);

        expect(response.status).toBe(200);
        expect((await json(response)).id).toBe(card.id);
      });

      it("snoozing again replaces the earlier snooze: a shorter one brings the card back sooner", async () => {
        const card = await seedCard({ published: true });
        const long = await json(
          await call(`/feed/${card.id}/review`, { method: "PUT", headers: { "Content-Type": "application/json", ...keyed }, body: JSON.stringify({ action: "snoozed" }) }, publicEnv({ SNOOZE_DEFAULT_HOURS: "72" })),
        );
        const short = await json(
          await call(`/feed/${card.id}/review`, { method: "PUT", headers: { "Content-Type": "application/json", ...keyed }, body: JSON.stringify({ action: "snoozed" }) }, publicEnv({ SNOOZE_DEFAULT_HOURS: "2" })),
        );

        expect(Date.parse(short.snoozedUntil as string)).toBeLessThan(Date.parse(long.snoozedUntil as string));
        expect(Date.parse(short.snoozedUntil as string) - Date.now()).toBeLessThan(3 * 60 * 60 * 1000);
      });

      it("a snoozed card stays hidden while other cards are not affected", async () => {
        const hidden = await seedCard({ published: true });
        const shown = await seedCard({ published: true });

        await act(hidden.id, "snoozed");
        const ids = await publicFeedIds();

        expect(ids).not.toContain(hidden.id);
        expect(ids).toContain(shown.id);
      });
    });

    describe("published and unpublished", () => {
      it("publish then unpublish: an anonymous visitor sees the card only while it is published", async () => {
        const card = await seedCard();

        // Before: an unpublished card does not exist to a visitor.
        expect((await publicGet(card.id)).status).toBe(404);
        expect(await publicFeedIds()).not.toContain(card.id);

        // Published: visible by ID with only the public fields, and in the list.
        expect((await json(await act(card.id, "published"))).isPublished).toBe(true);
        expect((await snapshot(card.id)).is_published).toBe(true);
        const visible = await publicGet(card.id);
        expect(visible.status).toBe(200);
        expect(Object.keys(await json(visible)).sort()).toEqual(PUBLIC_KEYS);
        expect(await publicFeedIds()).toContain(card.id);

        // Unpublished: gone again, indistinguishable from a card that never existed.
        expect((await json(await act(card.id, "unpublished"))).isPublished).toBe(false);
        expect((await snapshot(card.id)).is_published).toBe(false);
        const gone = await publicGet(card.id);
        const never = await publicGet("00000000-0000-4000-8000-000000000000");
        expect(gone.status).toBe(404);
        expect(await json(gone)).toEqual(await json(never));
        expect(await publicFeedIds()).not.toContain(card.id);
      });

      it("publishing again after unpublishing works, and the log records every step", async () => {
        const card = await seedCard();

        for (const action of ["published", "unpublished", "published"] as const) {
          await act(card.id, action);
        }

        expect((await snapshot(card.id)).is_published).toBe(true);
        expect(await eventActions(card.id)).toEqual(["published", "unpublished", "published"]);
        expect((await publicGet(card.id)).status).toBe(200);
      });

      it("the owner sees a card whether or not it is published", async () => {
        const card = await seedCard();

        const unpublished = await call(`/feed/${card.id}`, { method: "GET" }, privateEnv(), accessContext({ email: TEST_OWNER }));
        await act(card.id, "published");
        const published = await call(`/feed/${card.id}`, { method: "GET" }, privateEnv(), accessContext({ email: TEST_OWNER }));

        expect([unpublished.status, published.status]).toEqual([200, 200]);
        expect(await json(unpublished)).toMatchObject({ id: card.id, isPublished: false });
        expect(await json(published)).toMatchObject({ id: card.id, isPublished: true });
      });

      it("in a private deployment publishing exposes nothing: an anonymous reader is still refused", async () => {
        const card = await seedCard();
        await act(card.id, "published");

        const anonymous = await call(`/feed/${card.id}`, { method: "GET" }, privateEnv(), accessContext(null));
        const list = await call("/feed", { method: "GET" }, privateEnv(), accessContext(null));

        expect([anonymous.status, list.status]).toEqual([401, 401]);
      });

      it("publishing changes only the published flag", async () => {
        const card = await seedCard();
        await act(card.id, "saved");
        const before = await snapshot(card.id);

        await act(card.id, "published");
        const after = await snapshot(card.id);

        expect({ ...after, is_published: before.is_published, events: before.events, updated_at: before.updated_at }).toEqual(before);
        expect(after.is_published).toBe(true);
      });
    });

    describe("the review log", () => {
      it("records every action in the order it happened, one event per request", async () => {
        const card = await seedCard();
        const sequence: ReviewAction[] = ["reviewed", "saved", "published", "snoozed", "unsaved", "reviewed", "unpublished"];

        for (const action of sequence) {
          await act(card.id, action);
        }

        expect(await eventActions(card.id)).toEqual(sequence);
      });

      it("a refused or failed request writes no event", async () => {
        const card = await seedCard();
        const attempts = [
          call(`/feed/${card.id}/review`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: '{"action":"reviewed"}' }, publicEnv()),
          call(`/feed/${card.id}/review`, { method: "PUT", headers: { "Content-Type": "application/json", ...keyed }, body: '{"action":"nope"}' }, publicEnv()),
          call(`/feed/${card.id}/review`, { method: "PUT", headers: { "Content-Type": "application/json", "X-API-Key": "wrong" }, body: '{"action":"reviewed"}' }, publicEnv()),
          call(`/feed/${card.id}/review`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: "https://evil.example" }, body: '{"action":"reviewed"}' }, privateEnv()),
        ];

        const statuses = (await Promise.all(attempts)).map((r) => r.status);

        expect(statuses).toEqual([401, 400, 403, 403]);
        expect(await snapshot(card.id)).toMatchObject({ review_count: 0, events: 0 });
      });

      it("deleting the source removes the card's log with it (the foreign key cascades)", async () => {
        const card = await seedCard();
        await act(card.id, "reviewed");
        expect((await snapshot(card.id)).events).toBe(1);

        await testDb().query("DELETE FROM sources WHERE id = $1", [card.sourceId]);

        const [row] = await testDb().query("SELECT count(*)::int AS n FROM review_events WHERE feed_item_id = $1", [card.id]);
        expect(row?.n).toBe(0);
        expect((await act(card.id, "reviewed")).status).toBe(404);
      });
    });

    describe("cards are independent", () => {
      it("acting on one card changes no other card and writes no event for it", async () => {
        const target = await seedCard({ published: true });
        const bystander = await seedCard({ published: true });
        const before = await snapshot(bystander.id);

        for (const action of REVIEW_ACTIONS) {
          await act(target.id, action);
        }

        expect(await snapshot(bystander.id)).toEqual(before);
        expect((await publicGet(bystander.id)).status).toBe(200);
      });
    });

    describe("a longer sequence checked against an independent model", () => {
      it("after each of 24 pseudo-random actions the response and the database both match the expected state", async () => {
        const card = await seedCard();
        // A fixed linear congruential sequence: varied, but the same on every run.
        let seed = 20261115;
        const next = (): number => {
          seed = (seed * 1664525 + 1013904223) % 4294967296;
          return seed;
        };
        const model = { reviewCount: 0, saved: false, snoozed: false, published: false, events: 0 };
        let lastReviewed = 0;

        for (let step = 1; step <= 24; step += 1) {
          const action = REVIEW_ACTIONS[next() % REVIEW_ACTIONS.length]!;
          model.events += 1;
          if (action === "reviewed") model.reviewCount += 1;
          if (action === "saved") model.saved = true;
          if (action === "unsaved") model.saved = false;
          if (action === "snoozed") model.snoozed = true;
          if (action === "published") model.published = true;
          if (action === "unpublished") model.published = false;

          const response = await act(card.id, action);
          const body = await json(response);
          const row = await snapshot(card.id);
          const context = `step ${step} ${action}`;

          expect(response.status, context).toBe(200);
          expect(body.reviewCount, context).toBe(model.reviewCount);
          expect(body.isPublished, context).toBe(model.published);
          expect(body.savedAt !== null, context).toBe(model.saved);
          expect(body.snoozedUntil !== null, context).toBe(model.snoozed);
          expect(row.review_count, context).toBe(model.reviewCount);
          expect(row.is_published, context).toBe(model.published);
          expect(row.saved_at !== null, context).toBe(model.saved);
          expect(row.snoozed_until !== null, context).toBe(model.snoozed);
          expect(row.events, context).toBe(model.events);
          if (row.last_reviewed_at !== null) {
            // Never moves backwards.
            expect(row.last_reviewed_at.getTime(), context).toBeGreaterThanOrEqual(lastReviewed);
            lastReviewed = row.last_reviewed_at.getTime();
          }
        }
      });
    });
  },
);
