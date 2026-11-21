import type { RecallFeedClient } from "@recallfeed/client";

/** What {@link publishCards} did. */
export type PublishOutcome = {
  /** The cards published, in order. */
  published: string[];
  /** The card whose publish failed and why. Absent when every card was published. */
  failed?: { id: string; error: unknown };
  /** Cards after the failed one, never tried. Always empty when nothing failed. */
  notAttempted: string[];
};

/**
 * Publishes cards one at a time through the existing review endpoint (`review(id, "published")`).
 *
 * It stops at the first failure and reports exactly which cards were published, which one failed, and
 * which were never tried, so the caller can retry only those. Publishing a card that is already published
 * is harmless, so a retry of the whole list is safe too.
 *
 * @param client - A client with write access. Only `review` is used.
 * @param ids - The card IDs to publish.
 * @param onPublished - Called after each card is published, for progress output.
 * @returns The outcome.
 */
export async function publishCards(
  client: Pick<RecallFeedClient, "review">,
  ids: readonly string[],
  onPublished?: (id: string, position: number) => void,
): Promise<PublishOutcome> {
  const published: string[] = [];
  for (const [index, id] of ids.entries()) {
    try {
      await client.review(id, "published");
    } catch (error) {
      return { published, failed: { id, error }, notAttempted: ids.slice(index + 1) };
    }
    published.push(id);
    onPublished?.(id, published.length);
  }
  return { published, notAttempted: [] };
}
