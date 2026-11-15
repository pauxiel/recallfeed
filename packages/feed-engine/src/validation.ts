import { ValidationError } from "@recallfeed/core";
import { MARKDOWN_MAX_BYTES, MARKDOWN_MIN_BYTES } from "@recallfeed/connectors";

/** The longest source name accepted. */
export const MAX_SOURCE_NAME_LENGTH = 200;

/** The source name used when an import does not supply one. */
export const DEFAULT_SOURCE_NAME = "Markdown import";

// A UTF-16 surrogate with no partner. PostgreSQL's jsonb and text reject it, and the byte-length
// check cannot see it because TextEncoder silently turns it into U+FFFD.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
// Matching control characters is the purpose of this expression, so the lint rule that warns
// about them in a regular expression does not apply here.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/** Checked Markdown import input. */
export type ValidImportInput = {
  content: string;
  /** The trimmed source name, or {@link DEFAULT_SOURCE_NAME}. */
  name: string;
};

/**
 * Validates a Markdown import before any work is done (Spec 04 step 1, Spec 05 request validation).
 *
 * @param content - The Markdown text.
 * @param name - The requested source name, if any.
 * @returns The content and the name to use.
 * @throws ValidationError `VALIDATION_SIZE` if the content is under 10 bytes or over 100 KB, measured
 * in UTF-8 bytes. `VALIDATION_CONTENT` for a NUL character or a lone surrogate, which PostgreSQL
 * cannot store. `VALIDATION_NAME` for an over-long name or one with control characters.
 */
export function assertValidImport(content: string, name?: string): ValidImportInput {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < MARKDOWN_MIN_BYTES) {
    throw new ValidationError(
      `Content is too small: ${bytes} bytes (minimum ${MARKDOWN_MIN_BYTES})`,
      "VALIDATION_SIZE",
    );
  }
  if (bytes > MARKDOWN_MAX_BYTES) {
    throw new ValidationError(
      `Content is too large: ${bytes} bytes (maximum ${MARKDOWN_MAX_BYTES})`,
      "VALIDATION_SIZE",
    );
  }
  if (content.includes("\u0000")) {
    throw new ValidationError("Content must not contain NUL characters", "VALIDATION_CONTENT");
  }
  if (LONE_SURROGATE.test(content)) {
    throw new ValidationError("Content is not valid Unicode text", "VALIDATION_CONTENT");
  }
  const trimmed = (name ?? "").trim();
  if (trimmed.length > MAX_SOURCE_NAME_LENGTH) {
    throw new ValidationError(
      `Name is too long: ${trimmed.length} characters (maximum ${MAX_SOURCE_NAME_LENGTH})`,
      "VALIDATION_NAME",
    );
  }
  if (CONTROL_CHARACTER.test(trimmed) || LONE_SURROGATE.test(trimmed)) {
    throw new ValidationError("Name must be plain text without control characters", "VALIDATION_NAME");
  }
  return { content, name: trimmed === "" ? DEFAULT_SOURCE_NAME : trimmed };
}
