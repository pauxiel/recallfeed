import type { FeedItem } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { sanitizeFeedItem, toPublicFeedItem } from "../response-filter";

const item: FeedItem = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  noteId: "33333333-3333-4333-8333-333333333333",
  sourceId: "44444444-4444-4444-8444-444444444444",
  cardType: "original",
  content: "Card content",
  isAiGenerated: false,
  isPublished: true,
  reviewCount: 7,
  lastReviewedAt: new Date("2026-11-07T11:00:00Z"),
  savedAt: new Date("2026-11-07T10:00:00Z"),
  snoozedUntil: new Date("2026-12-01T00:00:00Z"),
  createdAt: new Date("2026-11-07T09:00:00Z"),
  updatedAt: new Date("2026-11-07T11:30:00Z"),
};

describe("toPublicFeedItem", () => {
  it("returns exactly Spec 05's six public fields", () => {
    expect(Object.keys(toPublicFeedItem(item)).sort()).toEqual(
      ["cardType", "content", "createdAt", "id", "isAiGenerated", "noteId"],
    );
  });

  it.each(["sourceId", "isPublished", "reviewCount", "lastReviewedAt", "savedAt", "snoozedUntil", "updatedAt"])(
    "omits %s",
    (field) => {
      expect(field in toPublicFeedItem(item)).toBe(false);
      expect(JSON.stringify(toPublicFeedItem(item))).not.toContain(`"${field}"`);
    },
  );

  it("uses an allow-list: a field added to the card later stays private", () => {
    const withExtra = { ...item, internalNote: "secret", ownerOnly: 42 } as FeedItem;

    const result = toPublicFeedItem(withExtra);

    expect(JSON.stringify(result)).not.toContain("secret");
    expect("internalNote" in result).toBe(false);
    expect("ownerOnly" in result).toBe(false);
  });

  it("does not mutate the stored card", () => {
    const copy = structuredClone(item);
    toPublicFeedItem(item);

    expect(item).toEqual(copy);
  });
});

describe("sanitizeFeedItem", () => {
  it("public requests get the public form; owner requests get the whole card", () => {
    expect(sanitizeFeedItem(item, true)).toEqual(toPublicFeedItem(item));
    expect(sanitizeFeedItem(item, false)).toEqual(item);
  });
});
