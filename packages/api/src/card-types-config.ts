import { RecallFeedError, ValidationError } from "@recallfeed/core";
import type { CardType } from "@recallfeed/core";
import { parseImportCardTypes } from "@recallfeed/feed-engine";
import type { Env } from "./types";

/**
 * Reads which card types `POST /import/markdown` creates, from `DEFAULT_CARD_TYPES`.
 *
 * The rules are `parseImportCardTypes`'s. Unset means `original` only. `original` is always included.
 * Types without a generator yet (`summary`, `reflection_prompt`, `code_snippet`) are skipped. An unknown
 * name is a deployment mistake: the import fails with a generic 500 before anything is written, instead
 * of silently creating fewer cards than the deployment asked for. The value is never echoed or logged.
 *
 * @param env - The Worker environment.
 * @returns The card types to create.
 * @throws RecallFeedError `INTERNAL_CONFIG` if the setting lists an unknown type.
 */
export function getImportCardTypes(env: Pick<Env, "DEFAULT_CARD_TYPES">): CardType[] {
  try {
    return parseImportCardTypes(env.DEFAULT_CARD_TYPES);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new RecallFeedError("DEFAULT_CARD_TYPES lists an unknown card type", "INTERNAL_CONFIG");
    }
    throw error;
  }
}
