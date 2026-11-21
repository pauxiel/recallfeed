import type { CardType } from "@recallfeed/core";

/**
 * A card as an anonymous visitor of a public deployment sees it: Spec 05's six public fields. Dates
 * arrive as ISO 8601 strings, because the API speaks JSON.
 */
export type PublicCard = {
  id: string;
  noteId: string;
  cardType: CardType;
  content: string;
  isAiGenerated: boolean;
  /** ISO 8601. */
  createdAt: string;
};

/** A card as the owner of a private deployment, or a caller with the API key, sees it: every field. */
export type OwnerCard = PublicCard & {
  sourceId: string;
  isPublished: boolean;
  reviewCount: number;
  /** ISO 8601, or null if never reviewed. */
  lastReviewedAt: string | null;
  /** ISO 8601, or null if not saved. */
  savedAt: string | null;
  /** ISO 8601, or null if not snoozed. */
  snoozedUntil: string | null;
  /** ISO 8601. */
  updatedAt: string;
};

/** One page of `GET /feed`. Pass `nextCursor` back to read the next page; null means the last page. */
export type CardPage<TCard extends PublicCard = PublicCard> = {
  items: TCard[];
  nextCursor: string | null;
};

/** `POST /import/markdown`'s result (Spec 05). */
export type ImportMarkdownResult = {
  sourceId: string;
  queued: boolean;
  notesImported: number;
  feedItemsCreated: number;
};

/** `PUT /feed/:id/review`'s result: the fields a review action can change. */
export type ReviewResult = {
  id: string;
  reviewCount: number;
  lastReviewedAt: string | null;
  savedAt: string | null;
  snoozedUntil: string | null;
  isPublished: boolean;
};
