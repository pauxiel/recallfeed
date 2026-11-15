import { describe, expect, it } from "vitest";
import { getVisibilityMode } from "../visibility";

describe("getVisibilityMode", () => {
  it("is public only for the exact string 'public'", () => {
    expect(getVisibilityMode({ FEED_VISIBILITY: "public" })).toBe("public");
    expect(getVisibilityMode({ FEED_VISIBILITY: "private" })).toBe("private");
  });

  it.each([undefined, "", " ", "Public", "PUBLIC", "public ", " public", "publicc", "pub", "true", "1", "yes", "null", "undefined"])(
    "treats %j as private (fail closed)",
    (value) => {
      expect(getVisibilityMode({ FEED_VISIBILITY: value })).toBe("private");
    },
  );

  it("treats a missing variable as private", () => {
    expect(getVisibilityMode({})).toBe("private");
  });
});
