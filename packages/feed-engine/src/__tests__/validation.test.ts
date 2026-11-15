import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { MARKDOWN_MAX_BYTES } from "@recallfeed/connectors";
import { DEFAULT_SOURCE_NAME, MAX_SOURCE_NAME_LENGTH, assertValidImport } from "../validation";

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof ValidationError ? error.code : `unexpected: ${String(error)}`;
  }
  return undefined;
}

describe("assertValidImport", () => {
  it("accepts text of exactly 10 bytes and of exactly 100 KB", () => {
    expect(() => assertValidImport("0123456789")).not.toThrow();
    expect(() => assertValidImport("a".repeat(MARKDOWN_MAX_BYTES))).not.toThrow();
  });

  it("rejects 9 bytes and 100 KB plus one byte with VALIDATION_SIZE", () => {
    expect(codeOf(() => assertValidImport("012345678"))).toBe("VALIDATION_SIZE");
    expect(codeOf(() => assertValidImport("a".repeat(MARKDOWN_MAX_BYTES + 1)))).toBe("VALIDATION_SIZE");
    expect(codeOf(() => assertValidImport(""))).toBe("VALIDATION_SIZE");
  });

  it("measures UTF-8 bytes, not characters", () => {
    expect(codeOf(() => assertValidImport("é".repeat(5)))).toBeUndefined(); // 10 bytes in 5 characters
    expect(codeOf(() => assertValidImport("é".repeat(4)))).toBe("VALIDATION_SIZE"); // 8 bytes
    expect(codeOf(() => assertValidImport("é".repeat(60_000)))).toBe("VALIDATION_SIZE");
  });

  it.each([
    ["a NUL character", "hello\u0000world, long enough"],
    ["a lone high surrogate", "hello \ud83d world, long enough"],
    ["a lone low surrogate", "hello \ude00 world, long enough"],
  ])("rejects %s, which PostgreSQL cannot store", (_label, text) => {
    expect(codeOf(() => assertValidImport(text))).toBe("VALIDATION_CONTENT");
  });

  it("accepts a valid surrogate pair (an emoji)", () => {
    expect(codeOf(() => assertValidImport("hello 😀 world, long enough"))).toBeUndefined();
  });

  it("defaults, trims, and bounds the source name", () => {
    expect(assertValidImport("0123456789").name).toBe(DEFAULT_SOURCE_NAME);
    expect(assertValidImport("0123456789", "   ").name).toBe(DEFAULT_SOURCE_NAME);
    expect(assertValidImport("0123456789", "  My notes  ").name).toBe("My notes");
    expect(codeOf(() => assertValidImport("0123456789", "n".repeat(MAX_SOURCE_NAME_LENGTH)))).toBeUndefined();
    expect(codeOf(() => assertValidImport("0123456789", "n".repeat(MAX_SOURCE_NAME_LENGTH + 1)))).toBe("VALIDATION_NAME");
  });

  it.each(["bad\nname", "bad\u0000name", "bad\u001bname", "bad\u007fname", "lone \ud800 surrogate"])(
    "rejects control characters in the name: %j",
    (name) => {
      expect(codeOf(() => assertValidImport("0123456789", name))).toBe("VALIDATION_NAME");
    },
  );

  it("passes the content through unchanged", () => {
    const text = "# Title\n\nbody with `code` and\ttabs\n";
    expect(assertValidImport(text).content).toBe(text);
  });
});
