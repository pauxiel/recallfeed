import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { assertSafeTestDatabaseUrl } from "../test-safety";

describe("assertSafeTestDatabaseUrl", () => {
  it.each([
    "postgres://postgres:postgres@db.localtest.me:5432/recallfeed_test",
    "postgresql://u:p@localhost:5432/recallfeed_test",
    "postgres://u:p@127.0.0.1/test",
    "postgres://u:p@[::1]:5432/my-test-db",
  ])("accepts %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    ["a Neon cloud host", "postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed_test"],
    ["a remote host", "postgres://u:p@db.example.com:5432/recallfeed_test"],
    ["a lookalike host", "postgres://u:p@localhost.evil.example/recallfeed_test"],
    ["a non-test database name", "postgres://u:p@localhost:5432/recallfeed"],
    ["a name that only contains test inside a word", "postgres://u:p@localhost:5432/latest"],
    ["the wrong scheme", "mysql://u:p@localhost:3306/recallfeed_test"],
    ["garbage", "not a url"],
  ])("rejects %s", (_label, url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(ValidationError);
  });

  it("never echoes the password in an error", () => {
    try {
      assertSafeTestDatabaseUrl("postgres://admin:hunter2@db.example.com/recallfeed_test");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(String(error)).not.toContain("hunter2");
    }
  });
});
