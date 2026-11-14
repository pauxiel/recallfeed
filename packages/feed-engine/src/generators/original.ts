import type { Note } from "@recallfeed/core";
import type { NewFeedItem } from "@recallfeed/database";

/**
 * The deterministic "original" card: a one-to-one copy of a note.
 *
 * The card shows the note's content exactly as imported, so it never involves AI and is never
 * flagged as AI-generated. No clock, randomness, or network is involved.
 *
 * @param note - A stored note.
 * @returns The card to create for it.
 */
export function generateOriginalCard(note: Note): NewFeedItem {
  return {
    noteId: note.id,
    sourceId: note.sourceId,
    cardType: "original",
    content: note.content,
    isAiGenerated: false,
  };
}
