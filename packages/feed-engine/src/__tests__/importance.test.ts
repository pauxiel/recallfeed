import { describe, expect, it } from "vitest";
import { ValidationError } from "@recallfeed/core";
import { DEFAULT_STRATEGY, ImportanceStrategy, RecencyStrategy, getStrategy, isPageableStrategyName } from "../strategies";
import { CONFIG, NOW, at, card, ids } from "./strategy-fixtures";

const importance = new ImportanceStrategy();

describe("ImportanceStrategy", () => {
  it("is named importance and has two keys before id", () => {
    expect(importance.name).toBe("importance");
    expect(importance.keyCount).toBe(2);
  });

  it("sorts cards with reviewCount [3, 0, 1] as [0, 1, 3] (Task 26)", () => {
    const three = card({ reviewCount: 3 });
    const zero = card({ reviewCount: 0 });
    const one = card({ reviewCount: 1 });

    expect(importance.rank([three, zero, one], CONFIG, NOW).map((c) => c.reviewCount)).toEqual([0, 1, 3]);
  });

  it("puts an unreviewed card before every reviewed one, however recently it was created", () => {
    const unreviewedNew = card({ reviewCount: 0, createdAt: at("2026-11-19T00:00:00Z") });
    const reviewedOnceLongAgo = card({ reviewCount: 1, lastReviewedAt: at("2026-01-01T00:00:00Z") });

    expect(ids(importance.rank([reviewedOnceLongAgo, unreviewedNew], CONFIG, NOW))).toEqual([
      unreviewedNew.id,
      reviewedOnceLongAgo.id,
    ]);
  });

  it("among equal counts, the card reviewed (or created) longest ago comes first", () => {
    const recent = card({ reviewCount: 2, lastReviewedAt: at("2026-11-01T00:00:00Z") });
    const old = card({ reviewCount: 2, lastReviewedAt: at("2026-02-01T00:00:00Z") });
    const unreviewedRecent = card({ reviewCount: 0, createdAt: at("2026-10-01T00:00:00Z") });
    const unreviewedOld = card({ reviewCount: 0, createdAt: at("2026-01-01T00:00:00Z") });

    expect(ids(importance.rank([recent, unreviewedRecent, old, unreviewedOld], CONFIG, NOW))).toEqual([
      unreviewedOld.id,
      unreviewedRecent.id,
      old.id,
      recent.id,
    ]);
  });

  it("breaks a tie on both count and time by id, ascending", () => {
    const same = at("2026-05-05T05:05:05.555Z");
    const b = card({ id: "bbbbbbbb-0000-4000-8000-000000000000", reviewCount: 1, lastReviewedAt: same });
    const a = card({ id: "aaaaaaaa-0000-4000-8000-000000000000", reviewCount: 1, lastReviewedAt: same });

    expect(ids(importance.rank([b, a], CONFIG, NOW))).toEqual([a.id, b.id]);
  });

  it("is not a weighted score: one more review always outranks any difference in time", () => {
    const oneReviewAncient = card({ reviewCount: 1, lastReviewedAt: at("1900-01-01T00:00:00Z") });
    const zeroReviewsToday = card({ reviewCount: 0, createdAt: at("2026-11-20T11:00:00Z") });

    expect(ids(importance.rank([oneReviewAncient, zeroReviewsToday], CONFIG, NOW))).toEqual([
      zeroReviewsToday.id,
      oneReviewAncient.id,
    ]);
  });

  it("leaves snoozed cards out of the ranking (Task 26)", () => {
    const snoozed = card({ reviewCount: 0, snoozedUntil: at("2026-11-21T00:00:00Z") });
    const free = card({ reviewCount: 5 });

    expect(ids(importance.rank([snoozed, free], CONFIG, NOW))).toEqual([free.id]);
  });

  it("does not change the array it is given", () => {
    const input = [card({ reviewCount: 4 }), card({ reviewCount: 1 })];
    const before = ids(input);

    importance.rank(input, CONFIG, NOW);

    expect(ids(input)).toEqual(before);
  });

  it("keys are reviewCount then the effective time in milliseconds", () => {
    const item = card({ reviewCount: 7, lastReviewedAt: at("2026-05-05T05:05:05.555Z") });

    expect(importance.keys(item)).toEqual([7, Date.parse("2026-05-05T05:05:05.555Z")]);
  });

  it("is a different order from recency on the same cards", () => {
    const reviewedOftenLongAgo = card({ reviewCount: 9, lastReviewedAt: at("2026-01-01T00:00:00Z") });
    const neverReviewedRecent = card({ reviewCount: 0, createdAt: at("2026-11-01T00:00:00Z") });
    const both = [reviewedOftenLongAgo, neverReviewedRecent];

    expect(ids(importance.rank(both, CONFIG, NOW))).toEqual([neverReviewedRecent.id, reviewedOftenLongAgo.id]);
    expect(ids(new RecencyStrategy().rank(both, CONFIG, NOW))).toEqual([reviewedOftenLongAgo.id, neverReviewedRecent.id]);
  });
});

describe("getStrategy", () => {
  it("returns the two implemented strategies, and recency is the default", () => {
    expect(getStrategy("recency")).toBeInstanceOf(RecencyStrategy);
    expect(getStrategy("importance")).toBeInstanceOf(ImportanceStrategy);
    expect(DEFAULT_STRATEGY).toBe("recency");
  });

  it.each(["due_review", "", "Recency", "IMPORTANCE", " recency", "constructor", "__proto__", "toString", "hasOwnProperty"])(
    "refuses %j",
    (name) => {
      expect(isPageableStrategyName(name)).toBe(false);
      expect(() => getStrategy(name)).toThrow(ValidationError);
    },
  );
});
