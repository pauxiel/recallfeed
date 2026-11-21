import { ValidationError } from "@recallfeed/core";
import type { CardType } from "@recallfeed/core";

/** Every card type core defines. */
export const CARD_TYPES: readonly CardType[] = ["original", "highlight", "summary", "reflection_prompt", "code_snippet"];

/**
 * The card types an import can create now, because they have a deterministic generator. `summary` and
 * `reflection_prompt` are AI-generated and never come from the import path; `code_snippet` has no
 * generator yet.
 */
export const IMPORT_CARD_TYPES: readonly CardType[] = ["original", "highlight"];

function isCardType(value: string): value is CardType {
  return (CARD_TYPES as readonly string[]).includes(value);
}

/**
 * Reads the card types an import creates, from a `DEFAULT_CARD_TYPES` value such as
 * `"original,highlight,reflection_prompt"`.
 *
 * - Unset or blank means `original` only, the behavior before this setting existed.
 * - Names are comma-separated, with spaces around them allowed. They must be exact (case-sensitive) core
 *   card types. An unknown name or an empty entry is a configuration mistake and is refused, not ignored.
 * - Known types without a generator (`summary`, `reflection_prompt`, `code_snippet`) are skipped, so a
 *   deployment can list the types it wants before they all exist.
 * - `original` is always included, first: every note keeps its original card.
 *
 * The value is never included in an error message.
 *
 * @param raw - The setting, or undefined when it is not set.
 * @returns The types to create, without repeats, `original` first.
 * @throws ValidationError `VALIDATION_CARD_TYPE` for an unknown name or an empty entry.
 */
export function parseImportCardTypes(raw: string | undefined): CardType[] {
  const types = new Set<CardType>(["original"]);
  if (raw === undefined || raw.trim() === "") {
    return [...types];
  }
  for (const entry of raw.split(",")) {
    const name = entry.trim();
    if (!isCardType(name)) {
      throw new ValidationError("DEFAULT_CARD_TYPES lists an unknown card type", "VALIDATION_CARD_TYPE");
    }
    if (IMPORT_CARD_TYPES.includes(name)) {
      types.add(name);
    }
  }
  return [...types];
}
