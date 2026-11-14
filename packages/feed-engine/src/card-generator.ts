import { ValidationError } from "@recallfeed/core";
import type { CardType, Note } from "@recallfeed/core";
import { getNotesMissingCardType, insertFeedItems } from "@recallfeed/database";
import type { DbClient, NewFeedItem } from "@recallfeed/database";
import { generateOriginalCard } from "./generators/original";

type CardGenerator = (note: Note) => NewFeedItem;

/**
 * The deterministic generators available now. Only "original" exists in this phase. The other card
 * types (highlight, summary, code_snippet, reflection_prompt) arrive in later work, and the AI
 * ones never come from the synchronous import path.
 */
const GENERATORS: Partial<Record<CardType, CardGenerator>> = {
  original: generateOriginalCard,
};

/**
 * Creates the missing cards of the given types for every note of a source.
 *
 * Idempotent: a note that already has a card of a type is skipped, and the database's unique index
 * on `(note_id, card_type)` makes a concurrent repeat harmless. A repeat call creates nothing.
 *
 * @param db - A request-scoped client from `createDb`.
 * @param sourceId - The source whose notes get cards.
 * @param cardTypes - The card types to create. Only "original" is supported yet.
 * @returns How many cards this call created.
 * @throws ValidationError if a requested type has no generator, so nothing is silently skipped.
 */
export async function generateFeedItems(
  db: DbClient,
  sourceId: string,
  cardTypes: readonly CardType[],
): Promise<number> {
  const unsupported = cardTypes.filter((type) => GENERATORS[type] === undefined);
  if (unsupported.length > 0) {
    throw new ValidationError(
      `No card generator for: ${unsupported.join(", ")}`,
      "VALIDATION_CARD_TYPE",
    );
  }
  let created = 0;
  for (const type of new Set(cardTypes)) {
    const generate = GENERATORS[type];
    if (generate === undefined) {
      continue;
    }
    const missing = await getNotesMissingCardType(db, sourceId, type);
    created += (await insertFeedItems(db, missing.map(generate))).length;
  }
  return created;
}
