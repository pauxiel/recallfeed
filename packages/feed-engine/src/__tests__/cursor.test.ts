import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { MAX_CURSOR_LENGTH, decodeCursor, encodeCursor } from "../cursor";
import { ImportanceStrategy, RecencyStrategy } from "../strategies";
import type { IPageableStrategy } from "../strategies";
import { at, card } from "./strategy-fixtures";

const recency = new RecencyStrategy();
const importance = new ImportanceStrategy();
const ID = "550e8400-e29b-41d4-a716-446655440000";

/** Builds a cursor from raw JSON, the way a hostile or buggy client could. */
function raw(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodedJson(cursor: string): unknown {
  const padded = cursor.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (cursor.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
}

function refused(cursor: string, strategy: IPageableStrategy = recency): unknown {
  try {
    decodeCursor(cursor, strategy);
    return null;
  } catch (error) {
    return error;
  }
}

describe("encodeCursor and decodeCursor", () => {
  it("recency: the cursor holds the effective time and the id, and round-trips", () => {
    const item = card({ id: ID, lastReviewedAt: at("2026-05-05T05:05:05.555Z") });

    const cursor = encodeCursor(recency, item);

    expect(decodedJson(cursor)).toEqual({ v: 1, s: "recency", k: [Date.parse("2026-05-05T05:05:05.555Z")], id: ID });
    expect(decodeCursor(cursor, recency)).toEqual({ keys: [Date.parse("2026-05-05T05:05:05.555Z")], id: ID });
  });

  it("importance: the cursor holds reviewCount, then the effective time, then the id (no score)", () => {
    const item = card({ id: ID, reviewCount: 3, createdAt: at("1969-12-31T23:59:59.999Z"), lastReviewedAt: null });

    const cursor = encodeCursor(importance, item);

    expect(decodedJson(cursor)).toEqual({ v: 1, s: "importance", k: [3, -1], id: ID });
    expect(decodeCursor(cursor, importance)).toEqual({ keys: [3, -1], id: ID });
  });

  it("is URL-safe base64 with no padding, so it can go in a query string as is", () => {
    for (let i = 0; i < 40; i += 1) {
      const item = card({ reviewCount: i * 7919, lastReviewedAt: new Date(Date.UTC(2026, 0, 1) + i * 104729) });
      const cursor = encodeCursor(importance, item);
      expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeURIComponent(cursor)).toBe(cursor);
      expect(decodeCursor(cursor, importance).id).toBe(item.id);
    }
  });

  it("is short: well under the accepted maximum", () => {
    const item = card({ id: ID, reviewCount: 2147483647, lastReviewedAt: at("2999-12-31T23:59:59.999Z") });

    expect(encodeCursor(importance, item).length).toBeLessThan(MAX_CURSOR_LENGTH / 3);
  });

  it("a cursor issued for one strategy is refused by the other: its keys mean something else", () => {
    const item = card({ id: ID, reviewCount: 1, lastReviewedAt: at("2026-01-01T00:00:00Z") });

    expect(refused(encodeCursor(recency, item), importance)).toBeInstanceOf(ValidationError);
    expect(refused(encodeCursor(importance, item), recency)).toBeInstanceOf(ValidationError);
  });

  it.each([
    ["empty", ""],
    ["too long", "A".repeat(MAX_CURSOR_LENGTH + 1)],
    ["not base64url (has +)", "abc+def"],
    ["not base64url (has =)", "YWJj="],
    ["not base64url (has a space)", "eyJ2Ijox fQ"],
    ["base64 that is not UTF-8", btoa(String.fromCharCode(0xff, 0xfe, 0xfd)).replace(/=+$/, "")],
    ["UTF-8 that is not JSON", raw("not json")],
    ["a JSON array", raw([1, "recency", [1], ID])],
    ["JSON null", raw("null")],
    ["a JSON number", raw("42")],
    ["a missing field", raw({ v: 1, s: "recency", k: [1] })],
    ["an extra field", raw({ v: 1, s: "recency", k: [1], id: ID, extra: true })],
    ["version 2", raw({ v: 2, s: "recency", k: [1], id: ID })],
    ["version as a string", raw({ v: "1", s: "recency", k: [1], id: ID })],
    ["an unknown strategy", raw({ v: 1, s: "due_review", k: [1], id: ID })],
    ["too many keys", raw({ v: 1, s: "recency", k: [1, 2], id: ID })],
    ["no keys", raw({ v: 1, s: "recency", k: [], id: ID })],
    ["keys not an array", raw({ v: 1, s: "recency", k: 1, id: ID })],
    ["a fractional key", raw({ v: 1, s: "recency", k: [1.5], id: ID })],
    ["a string key", raw({ v: 1, s: "recency", k: ["1"], id: ID })],
    ["an unsafe integer key", raw({ v: 1, s: "recency", k: [2 ** 60], id: ID })],
    ["a null key", raw({ v: 1, s: "recency", k: [null], id: ID })],
    ["an id that is not a UUID", raw({ v: 1, s: "recency", k: [1], id: "not-a-uuid" })],
    ["an injection string as id", raw({ v: 1, s: "recency", k: [1], id: "1) OR (1=1" })],
    ["a numeric id", raw({ v: 1, s: "recency", k: [1], id: 7 })],
  ])("refuses %s with VALIDATION_CURSOR", (_label, cursor) => {
    const error = refused(cursor);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe("VALIDATION_CURSOR");
  });

  it("never echoes the cursor in the error", () => {
    const hostile = raw({ v: 1, s: "recency", k: [1], id: "<script>alert(1)</script>" });

    const error = refused(hostile) as ValidationError;

    expect(error.message).not.toContain("script");
    expect(error.message).not.toContain(hostile);
  });

  it("accepts a cursor built by hand with the documented shape (the format is the contract)", () => {
    expect(decodeCursor(raw({ id: ID, k: [7, 1700000000000], s: "importance", v: 1 }), importance)).toEqual({
      keys: [7, 1700000000000],
      id: ID,
    });
  });
});
