import type { FeedConfig, FeedItem } from "@recallfeed/core";

/** A feed config for `rank` calls. The strategies do not read it; it is part of the interface. */
export const CONFIG: FeedConfig = {
  enabledCardTypes: ["original"],
  resurfacingStrategy: "recency",
  pageSize: 10,
  snoozeDefaultHours: 24,
};

/** A fixed "now" so snooze tests never depend on the clock. */
export const NOW = new Date("2026-11-20T12:00:00.000Z");

let counter = 0;

/**
 * Builds a card. `id` defaults to a fresh canonical UUID whose final digits count up, so the
 * default ids sort in creation order; tests that care about the tie-break set ids explicitly.
 */
export function card(overrides: Partial<FeedItem> = {}): FeedItem {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    noteId: "11111111-1111-4111-8111-111111111111",
    sourceId: "22222222-2222-4222-8222-222222222222",
    cardType: "original",
    content: `card ${counter}`,
    isAiGenerated: false,
    isPublished: false,
    reviewCount: 0,
    lastReviewedAt: null,
    savedAt: null,
    snoozedUntil: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

/** Shorthand for a UTC instant. */
export const at = (iso: string): Date => new Date(iso);

/** The ids of a list, for compact assertions. */
export const ids = (items: readonly FeedItem[]): string[] => items.map((item) => item.id);
