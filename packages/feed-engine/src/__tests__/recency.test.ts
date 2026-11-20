import { describe, expect, it } from "vitest";
import { RecencyStrategy, effectiveTime } from "../strategies";
import { CONFIG, NOW, at, card, ids } from "./strategy-fixtures";

const recency = new RecencyStrategy();

describe("RecencyStrategy", () => {
  it("is named recency and has one key before id", () => {
    expect(recency.name).toBe("recency");
    expect(recency.keyCount).toBe(1);
  });

  it("sorts three cards with different times oldest first (Task 25)", () => {
    const newest = card({ lastReviewedAt: at("2026-11-19T00:00:00Z") });
    const oldest = card({ lastReviewedAt: at("2026-01-15T00:00:00Z") });
    const middle = card({ lastReviewedAt: at("2026-06-01T00:00:00Z") });

    expect(ids(recency.rank([newest, oldest, middle], CONFIG, NOW))).toEqual([oldest.id, middle.id, newest.id]);
  });

  it("uses createdAt for a card never reviewed: effectiveReviewedAt = lastReviewedAt ?? createdAt", () => {
    const reviewedLongAgo = card({ createdAt: at("2026-10-01T00:00:00Z"), lastReviewedAt: at("2026-02-01T00:00:00Z") });
    const neverReviewedOld = card({ createdAt: at("2026-01-01T00:00:00Z"), lastReviewedAt: null });
    const neverReviewedNew = card({ createdAt: at("2026-11-01T00:00:00Z"), lastReviewedAt: null });

    expect(ids(recency.rank([neverReviewedNew, reviewedLongAgo, neverReviewedOld], CONFIG, NOW))).toEqual([
      neverReviewedOld.id,
      reviewedLongAgo.id,
      neverReviewedNew.id,
    ]);
  });

  it("ignores reviewCount entirely", () => {
    const manyReviewsButOld = card({ reviewCount: 50, lastReviewedAt: at("2026-01-01T00:00:00Z") });
    const neverReviewedButRecent = card({ reviewCount: 0, createdAt: at("2026-11-01T00:00:00Z") });

    expect(ids(recency.rank([neverReviewedButRecent, manyReviewsButOld], CONFIG, NOW))).toEqual([
      manyReviewsButOld.id,
      neverReviewedButRecent.id,
    ]);
  });

  it("breaks a tie in effective time by id, ascending, so the order is total", () => {
    const same = at("2026-05-05T05:05:05.555Z");
    const c = card({ id: "cccccccc-0000-4000-8000-000000000000", lastReviewedAt: same });
    const a = card({ id: "aaaaaaaa-0000-4000-8000-000000000000", lastReviewedAt: same });
    const b = card({ id: "bbbbbbbb-0000-4000-8000-000000000000", createdAt: same, lastReviewedAt: null });

    expect(ids(recency.rank([c, a, b], CONFIG, NOW))).toEqual([a.id, b.id, c.id]);
  });

  it("compares ids the way PostgreSQL orders UUIDs: digits before letters, position by position", () => {
    const same = at("2026-05-05T00:00:00Z");
    const letter = card({ id: "a0000000-0000-4000-8000-000000000000", lastReviewedAt: same });
    const digit = card({ id: "90000000-0000-4000-8000-000000000000", lastReviewedAt: same });

    expect(ids(recency.rank([letter, digit], CONFIG, NOW))).toEqual([digit.id, letter.id]);
  });

  it("works for times before 1970", () => {
    const ancient = card({ lastReviewedAt: at("1843-02-16T02:31:52.845Z") });
    const epoch = card({ lastReviewedAt: at("1970-01-01T00:00:00.000Z") });
    const justBefore = card({ lastReviewedAt: at("1969-12-31T23:59:59.999Z") });

    expect(ids(recency.rank([epoch, justBefore, ancient], CONFIG, NOW))).toEqual([ancient.id, justBefore.id, epoch.id]);
  });

  it("leaves out cards snoozed past now, and keeps those whose snooze has ended or is exactly now", () => {
    const snoozed = card({ snoozedUntil: at("2026-11-20T12:00:00.001Z"), lastReviewedAt: at("2026-01-01T00:00:00Z") });
    const ended = card({ snoozedUntil: at("2026-11-20T11:59:59.999Z") });
    const endsNow = card({ snoozedUntil: NOW });
    const never = card();

    const ranked = ids(recency.rank([snoozed, ended, endsNow, never], CONFIG, NOW));

    expect(ranked).not.toContain(snoozed.id);
    expect(ranked).toEqual(expect.arrayContaining([ended.id, endsNow.id, never.id]));
    expect(ranked).toHaveLength(3);
  });

  it("does not change the array it is given", () => {
    const input = [card({ lastReviewedAt: at("2026-03-01T00:00:00Z") }), card({ lastReviewedAt: at("2026-01-01T00:00:00Z") })];
    const before = ids(input);

    recency.rank(input, CONFIG, NOW);

    expect(ids(input)).toEqual(before);
  });

  it("returns an empty list for no candidates", () => {
    expect(recency.rank([], CONFIG, NOW)).toEqual([]);
  });

  it("keys are the effective time in milliseconds", () => {
    const reviewed = card({ lastReviewedAt: at("2026-05-05T05:05:05.555Z") });
    const created = card({ createdAt: at("1969-12-31T23:59:59.999Z"), lastReviewedAt: null });

    expect(recency.keys(reviewed)).toEqual([Date.parse("2026-05-05T05:05:05.555Z")]);
    expect(recency.keys(created)).toEqual([-1]);
    expect(effectiveTime(created)).toBe(-1);
  });
});
