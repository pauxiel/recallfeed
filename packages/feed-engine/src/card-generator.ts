import { ValidationError } from "@recallfeed/core";
import type { CardType, Note } from "@recallfeed/core";
import { getNotesMissingCardType, insertFeedItems } from "@recallfeed/database";
import type { DbClient, NewFeedItem } from "@recallfeed/database";
import { generateHighlightCard } from "./generators/highlight";
import { generateOriginalCard } from "./generators/original";

/** Builds a note's card of one type, or returns null when the note has nothing for that type. */
type CardGenerator = (note: Note) => NewFeedItem | null;

/**
 * The deterministic generators available now: "original" (Phase 2) and "highlight" (Phase 4). The
 * other card types (summary, code_snippet, reflection_prompt) arrive in later work, and the AI ones
 * never come from the synchronous import path.
 */
const GENERATORS: Partial<Record<CardType, CardGenerator>> = {
  original: generateOriginalCard,
  highlight: generateHighlightCard,
};

/**
 * Refuses card types that have no generator, so nothing is silently skipped.
 *
 * @param cardTypes - The requested card types.
 * @throws ValidationError `VALIDATION_CARD_TYPE` naming the unsupported types.
 */
export function assertGeneratableCardTypes(cardTypes: readonly CardType[]): void {
  const unsupported = cardTypes.filter((type) => GENERATORS[type] === undefined);
  if (unsupported.length > 0) {
    throw new ValidationError(
      `No card generator for: ${unsupported.join(", ")}`,
      "VALIDATION_CARD_TYPE",
    );
  }
}

/**
 * Creates the missing cards of the given types for every note of a source.
 *
 * Idempotent: a note that already has a card of a type is skipped, and the database's unique index
 * on `(note_id, card_type)` makes a concurrent repeat harmless. A repeat call creates nothing.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param sourceId - The source whose notes get cards.
 * @param cardTypes - The card types to create: "original" or "highlight". A note with nothing to
 * highlight gets no highlight card.
 * @returns How many cards this call created.
 * @throws ValidationError if a requested type has no generator, so nothing is silently skipped.
 */
export async function generateFeedItems(
  db: DbClient,
  sourceId: string,
  cardTypes: readonly CardType[],
): Promise<number> {
  assertGeneratableCardTypes(cardTypes);
  let created = 0;
  for (const type of new Set(cardTypes)) {
    const generate = GENERATORS[type];
    if (generate === undefined) {
      continue;
    }
    const missing = await getNotesMissingCardType(db, sourceId, type);
    const cards = missing.map(generate).filter((card): card is NewFeedItem => card !== null);
    created += (await insertFeedItems(db, cards)).length;
  }
  return created;
}
