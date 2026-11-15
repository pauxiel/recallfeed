import { NotFoundError, REVIEW_ACTIONS, ValidationError } from "@recallfeed/core";
import type { FeedItem, ReviewAction } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { countHttpRequests } from "../../count-requests";
import * as barrel from "../../index";
import { getFeedItemById, insertFeedItem } from "../feed-items";
import { upsertNotes } from "../notes";
import * as reviewEvents from "../review-events";
import { MAX_SNOOZE_HOURS, applyReviewAction, insertReviewEvent, listReviewEventsByFeedItem } from "../review-events";
import { upsertSource } from "../sources";
import { databaseUrl, makeNote, testDb, uniqueName } from "./helpers";

const NO_SUCH_CARD = "00000000-0000-4000-8000-000000000000";

describe.skipIf(databaseUrl === "")("review event queries (real PostgreSQL through the proxy)", () => {
  /** A fresh card, unpublished, unreviewed, unsaved and unsnoozed. */
  async function newCard(): Promise<{ db: ReturnType<typeof testDb>; card: FeedItem }> {
    const db = testDb();
    const source = await upsertSource(db, { name: uniqueName("review"), type: "markdown" });
    const [stored] = await upsertNotes(db, source.id, [await makeNote(source.id, `${source.name} body`)]);
    const note = stored!.note;
    const card = await insertFeedItem(db, {
      noteId: note.id,
      sourceId: source.id,
      cardType: "original",
      content: note.content,
      isAiGenerated: false,
    });
    return { db, card: card! };
  }

  async function eventCount(db: ReturnType<typeof testDb>, id: string): Promise<number> {
    const rows = await db.query("SELECT count(*)::int AS n FROM review_events WHERE feed_item_id = $1", [id]);
    return rows[0]?.n as number;
  }

  describe("insertReviewEvent", () => {
    it.each(REVIEW_ACTIONS)("logs a %s event for an existing card", async (action) => {
      const { db, card } = await newCard();

      const event = await insertReviewEvent(db, { feedItemId: card.id, action });

      expect(event).toMatchObject({ feedItemId: card.id, action });
      expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(event.createdAt).toBeInstanceOf(Date);
      expect(await listReviewEventsByFeedItem(db, card.id)).toEqual([event]);
    });

    it("does not change the card: it is only a log insert", async () => {
      const { db, card } = await newCard();

      await insertReviewEvent(db, { feedItemId: card.id, action: "reviewed" });

      expect(await getFeedItemById(db, card.id)).toEqual(card);
    });

    it("a card that does not exist is refused by the foreign key and reported as NotFoundError", async () => {
      const { db } = await newCard();

      const failure = await insertReviewEvent(db, { feedItemId: NO_SUCH_CARD, action: "reviewed" }).catch((e: unknown) => e);

      expect(failure).toBeInstanceOf(NotFoundError);
      expect((failure as NotFoundError).code).toBe("NOT_FOUND_FEED_ITEM");
      expect(await eventCount(db, NO_SUCH_CARD)).toBe(0);
    });

    it("the error mapping rests on a real foreign key with the name the code expects", async () => {
      const { db } = await newCard();

      // Bypass the function so the raw database error is visible: a violation of the named constraint.
      const raw = await db
        .query("INSERT INTO review_events (feed_item_id, action) VALUES ($1, 'reviewed')", [NO_SUCH_CARD])
        .catch((e: unknown) => e as { code?: string; constraint?: string });

      expect(raw).toMatchObject({ code: "23503", constraint: "review_events_feed_item_id_fkey" });
    });

    it.each(["invalid", "", "Reviewed", "reviewed'; DROP TABLE review_events; --", "constructor"])(
      "refuses the unapproved action %j before touching the database",
      async (action) => {
        const { db, card } = await newCard();

        await expect(insertReviewEvent(db, { feedItemId: card.id, action: action as ReviewAction })).rejects.toMatchObject({
          code: "VALIDATION_REVIEW_ACTION",
        });
        expect(await eventCount(db, card.id)).toBe(0);
      },
    );

    it("refuses a malformed card ID", async () => {
      const { db } = await newCard();

      await expect(insertReviewEvent(db, { feedItemId: "not-a-uuid", action: "saved" })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("the log is immutable", () => {
    /** True for a name that reads like a change or removal of review events, matching whole camel-case words. */
    const looksLikeMutator = (name: string): boolean => {
      const words = (name.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g) ?? []).map((word) => word.toLowerCase());
      return words.includes("review") && words.some((word) => ["update", "delete", "remove", "edit", "truncate", "clear", "purge"].includes(word));
    };

    it("the name check flags real mutators and not the legitimate functions", () => {
      expect(["updateReviewEvent", "deleteReviewEvents", "removeReviewEvent", "clearReviewLog", "editReviewEvent"].every(looksLikeMutator)).toBe(true);
      expect(["insertReviewEvent", "listReviewEventsByFeedItem", "applyReviewAction", "updateFeedItem", "deleteSource"].some(looksLikeMutator)).toBe(false);
    });

    it("neither the module nor the package exports any way to change or remove an event", () => {
      const names = [...Object.keys(reviewEvents), ...Object.keys(barrel)];

      expect(names.filter(looksLikeMutator)).toEqual([]);
      expect(Object.keys(reviewEvents).sort()).toEqual([
        "MAX_SNOOZE_HOURS",
        "applyReviewAction",
        "insertReviewEvent",
        "listReviewEventsByFeedItem",
      ]);
    });
  });

  describe("listReviewEventsByFeedItem", () => {
    it("returns a card's events oldest first, and only that card's", async () => {
      const { db, card } = await newCard();
      const other = await newCard();
      const first = await insertReviewEvent(db, { feedItemId: card.id, action: "saved" });
      const second = await insertReviewEvent(db, { feedItemId: card.id, action: "reviewed" });
      await insertReviewEvent(other.db, { feedItemId: other.card.id, action: "published" });

      const events = await listReviewEventsByFeedItem(db, card.id);

      expect(events.map((e) => e.id)).toEqual([first.id, second.id]);
      expect(events.map((e) => e.action)).toEqual(["saved", "reviewed"]);
    });

    it("returns an empty list for a card with no events, an unknown card, and a malformed ID", async () => {
      const { db, card } = await newCard();

      expect(await listReviewEventsByFeedItem(db, card.id)).toEqual([]);
      expect(await listReviewEventsByFeedItem(db, NO_SUCH_CARD)).toEqual([]);
      expect(await listReviewEventsByFeedItem(db, "nope")).toEqual([]);
    });
  });

  describe("applyReviewAction", () => {
    it("reviewed: adds one to the count, sets last_reviewed_at, and logs an event with the same instant", async () => {
      const { db, card } = await newCard();

      const updated = await applyReviewAction(db, card.id, "reviewed", { snoozeHours: 24 });
      const [event] = await listReviewEventsByFeedItem(db, card.id);

      expect(updated).toMatchObject({ id: card.id, reviewCount: 1, savedAt: null, snoozedUntil: null, isPublished: false });
      expect(updated?.lastReviewedAt).toBeInstanceOf(Date);
      expect(event).toMatchObject({ action: "reviewed" });
      // Both come from one NOW() in one statement.
      expect(updated?.lastReviewedAt?.getTime()).toBe(event?.createdAt.getTime());
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(card.updatedAt.getTime());
    });

    it("reviewed again: the count keeps going and each review is logged", async () => {
      const { db, card } = await newCard();

      await applyReviewAction(db, card.id, "reviewed", { snoozeHours: 24 });
      const again = await applyReviewAction(db, card.id, "reviewed", { snoozeHours: 24 });

      expect(again?.reviewCount).toBe(2);
      expect(await eventCount(db, card.id)).toBe(2);
    });

    it("saved sets saved_at and unsaved clears it, in any order", async () => {
      const { db, card } = await newCard();

      const saved = await applyReviewAction(db, card.id, "saved", { snoozeHours: 24 });
      const unsaved = await applyReviewAction(db, card.id, "unsaved", { snoozeHours: 24 });
      const savedAgain = await applyReviewAction(db, card.id, "saved", { snoozeHours: 24 });
      const unsavedAgain = await applyReviewAction(db, card.id, "unsaved", { snoozeHours: 24 });

      expect(saved?.savedAt).toBeInstanceOf(Date);
      expect(unsaved?.savedAt).toBeNull();
      expect(savedAgain?.savedAt).toBeInstanceOf(Date);
      expect(unsavedAgain?.savedAt).toBeNull();
      // Saving or unsaving never counts as a review.
      expect([saved, unsaved, savedAgain, unsavedAgain].map((c) => c?.reviewCount)).toEqual([0, 0, 0, 0]);
    });

    it("unsaved on a card that was never saved is allowed, leaves it unsaved, and is logged", async () => {
      const { db, card } = await newCard();

      const result = await applyReviewAction(db, card.id, "unsaved", { snoozeHours: 24 });

      expect(result?.savedAt).toBeNull();
      expect(await eventCount(db, card.id)).toBe(1);
    });

    it.each([1, 24, 72, MAX_SNOOZE_HOURS])("snoozed for %i hours: snoozed_until is exactly that long after the event", async (hours) => {
      const { db, card } = await newCard();

      const snoozed = await applyReviewAction(db, card.id, "snoozed", { snoozeHours: hours });
      const [event] = await listReviewEventsByFeedItem(db, card.id);

      expect(snoozed?.snoozedUntil).toBeInstanceOf(Date);
      expect(snoozed!.snoozedUntil!.getTime() - event!.createdAt.getTime()).toBe(hours * 60 * 60 * 1000);
      expect(snoozed?.reviewCount).toBe(0);
    });

    it("snoozed again replaces the earlier snooze with a new one measured from now", async () => {
      const { db, card } = await newCard();

      await applyReviewAction(db, card.id, "snoozed", { snoozeHours: 72 });
      const shorter = await applyReviewAction(db, card.id, "snoozed", { snoozeHours: 1 });
      const events = await listReviewEventsByFeedItem(db, card.id);

      expect(shorter!.snoozedUntil!.getTime() - events[1]!.createdAt.getTime()).toBe(60 * 60 * 1000);
    });

    it("published and unpublished set is_published, and repeating either is allowed", async () => {
      const { db, card } = await newCard();

      const results = [
        await applyReviewAction(db, card.id, "published", { snoozeHours: 24 }),
        await applyReviewAction(db, card.id, "published", { snoozeHours: 24 }),
        await applyReviewAction(db, card.id, "unpublished", { snoozeHours: 24 }),
        await applyReviewAction(db, card.id, "unpublished", { snoozeHours: 24 }),
        await applyReviewAction(db, card.id, "published", { snoozeHours: 24 }),
      ].map((c) => c?.isPublished);

      expect(results).toEqual([true, true, false, false, true]);
      expect(await eventCount(db, card.id)).toBe(5);
    });

    it("each action changes only its own fields: every other field keeps the value it had just before", async () => {
      const { db, card } = await newCard();
      const touched: Record<ReviewAction, (keyof FeedItem)[]> = {
        reviewed: ["reviewCount", "lastReviewedAt"],
        saved: ["savedAt"],
        unsaved: ["savedAt"],
        snoozed: ["snoozedUntil"],
        published: ["isPublished"],
        unpublished: ["isPublished"],
      };
      // updatedAt changes with every action by design; every other field is compared.
      const comparable = (Object.keys(card) as (keyof FeedItem)[]).filter((field) => field !== "updatedAt");

      // Run the actions in an order that leaves each field in a non-default state first, so a stray
      // write to a field would show as a difference.
      for (const action of ["saved", "published", "reviewed", "snoozed", "unsaved", "unpublished", "reviewed"] as const) {
        const before = (await getFeedItemById(db, card.id))!;
        const after = (await applyReviewAction(db, card.id, action, { snoozeHours: 5 }))!;

        for (const field of comparable.filter((name) => !touched[action].includes(name))) {
          expect(after[field], `${action} must not change ${field}`).toEqual(before[field]);
        }
      }
    });

    it("leaves other cards alone", async () => {
      const mine = await newCard();
      const other = await newCard();

      await applyReviewAction(mine.db, mine.card.id, "reviewed", { snoozeHours: 24 });
      await applyReviewAction(mine.db, mine.card.id, "published", { snoozeHours: 24 });

      expect(await getFeedItemById(other.db, other.card.id)).toEqual(other.card);
      expect(await eventCount(other.db, other.card.id)).toBe(0);
    });

    it("a card that does not exist returns null and logs nothing, instead of a foreign-key error", async () => {
      const { db } = await newCard();

      for (const action of REVIEW_ACTIONS) {
        expect(await applyReviewAction(db, NO_SUCH_CARD, action, { snoozeHours: 24 })).toBeNull();
      }
      expect(await eventCount(db, NO_SUCH_CARD)).toBe(0);
    });

    it("a malformed ID is simply not found", async () => {
      const { db } = await newCard();

      expect(await applyReviewAction(db, "not-a-uuid", "reviewed", { snoozeHours: 24 })).toBeNull();
      expect(await applyReviewAction(db, "1; DROP TABLE feed_items", "published", { snoozeHours: 24 })).toBeNull();
    });

    it.each(["invalid", "", "Reviewed", "reviewed'; DROP TABLE feed_items; --", "constructor", "__proto__"])(
      "refuses the unapproved action %j and changes nothing",
      async (action) => {
        const { db, card } = await newCard();

        await expect(applyReviewAction(db, card.id, action as ReviewAction, { snoozeHours: 24 })).rejects.toMatchObject({
          code: "VALIDATION_REVIEW_ACTION",
        });
        expect(await getFeedItemById(db, card.id)).toEqual(card);
        expect(await eventCount(db, card.id)).toBe(0);
      },
    );

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_SNOOZE_HOURS + 1, "3" as unknown as number])(
      "refuses snoozeHours %j for snoozed and changes nothing",
      async (hours) => {
        const { db, card } = await newCard();

        await expect(applyReviewAction(db, card.id, "snoozed", { snoozeHours: hours })).rejects.toMatchObject({
          code: "VALIDATION_SNOOZE_HOURS",
        });
        expect(await getFeedItemById(db, card.id)).toEqual(card);
        expect(await eventCount(db, card.id)).toBe(0);
      },
    );

    it("snoozeHours only matters to snoozed: other actions ignore an unusable value", async () => {
      const { db, card } = await newCard();

      const result = await applyReviewAction(db, card.id, "reviewed", { snoozeHours: Number.NaN });

      expect(result?.reviewCount).toBe(1);
    });

    it("eight simultaneous reviews all count: eight in the count, eight in the log", async () => {
      const { db, card } = await newCard();

      const results = await Promise.all(
        Array.from({ length: 8 }, () => applyReviewAction(testDb(), card.id, "reviewed", { snoozeHours: 24 })),
      );

      expect(results.map((c) => c?.reviewCount).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect((await getFeedItemById(db, card.id))?.reviewCount).toBe(8);
      expect(await eventCount(db, card.id)).toBe(8);
    });

    it("takes one database request for any action: the change and the log are one statement", async () => {
      const { db, card } = await newCard();

      for (const action of REVIEW_ACTIONS) {
        const { requests } = await countHttpRequests(() => applyReviewAction(db, card.id, action, { snoozeHours: 24 }));
        expect(requests, action).toBe(1);
      }
    });

    it("logs every action of a mixed sequence in order, with the state the sequence implies", async () => {
      const { db, card } = await newCard();
      const sequence: ReviewAction[] = ["reviewed", "saved", "snoozed", "published", "unsaved", "reviewed", "unpublished"];

      let last: FeedItem | null = null;
      for (const action of sequence) {
        last = await applyReviewAction(db, card.id, action, { snoozeHours: 6 });
      }

      expect((await listReviewEventsByFeedItem(db, card.id)).map((e) => e.action)).toEqual(sequence);
      expect(last).toMatchObject({ reviewCount: 2, savedAt: null, isPublished: false });
      expect(last?.snoozedUntil).toBeInstanceOf(Date);
    });
  });
});
