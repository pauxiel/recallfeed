import type { FeedItem } from "@recallfeed/core";

/** What the owner sees: every field of a card. */
export type PrivateFeedItem = FeedItem;

/** What an anonymous visitor sees: Spec 05's public fields and nothing else. */
export type PublicFeedItem = Pick<FeedItem, "id" | "noteId" | "cardType" | "content" | "isAiGenerated" | "createdAt">;

/**
 * Reduces a card to its public form (Spec 05, Public Mode Response Filtering).
 *
 * This is an allow-list: each permitted field is copied by name. A deny-list that deleted
 * `sourceId`, `isPublished`, and the review fields would silently start leaking any column added to
 * `FeedItem` later. Here a new field stays private until someone deliberately adds it.
 *
 * @param item - A stored card.
 * @returns A new object with only the public fields.
 */
export function toPublicFeedItem(item: FeedItem): PublicFeedItem {
  return {
    id: item.id,
    noteId: item.noteId,
    cardType: item.cardType,
    content: item.content,
    isAiGenerated: item.isAiGenerated,
    createdAt: item.createdAt,
  };
}

/**
 * Chooses the response shape for a request (Spec 05's `sanitizeFeedItem`).
 *
 * @param item - A stored card.
 * @param isPublicRequest - True for an anonymous request in a public deployment.
 * @returns The public form for public requests, the full card for the owner.
 */
export function sanitizeFeedItem(item: FeedItem, isPublicRequest: boolean): PublicFeedItem | PrivateFeedItem {
  return isPublicRequest ? toPublicFeedItem(item) : item;
}
