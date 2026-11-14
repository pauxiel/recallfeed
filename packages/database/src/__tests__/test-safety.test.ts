import { Client } from "@neondatabase/serverless";
import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { assertDriverTargetMatchesUrl, assertSafeTestDatabaseUrl } from "../test-safety";

const FIXTURE_URL = "postgres://postgres:postgres@db.localtest.me:5432/recallfeed_test";

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof ValidationError ? error.code : `unexpected: ${String(error)}`;
  }
  return undefined;
}

describe("assertSafeTestDatabaseUrl (gate 1: the URL as written)", () => {
  it.each([
    FIXTURE_URL,
    "postgresql://u:p@localhost:5432/recallfeed_test",
    "postgres://u:p@127.0.0.1/recallfeed_test",
    "postgres://u:p@[::1]:5432/recallfeed_test",
  ])("accepts %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    ["a Neon cloud host", "postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed_test", "VALIDATION_TEST_DATABASE_HOST"],
    ["a remote host", "postgres://u:p@db.example.com:5432/recallfeed_test", "VALIDATION_TEST_DATABASE_HOST"],
    ["a lookalike host", "postgres://u:p@localhost.evil.example/recallfeed_test", "VALIDATION_TEST_DATABASE_HOST"],
    ["the wrong scheme", "mysql://u:p@localhost:3306/recallfeed_test", "VALIDATION_TEST_DATABASE_URL"],
    ["garbage", "not a url", "VALIDATION_TEST_DATABASE_URL"],
  ])("rejects %s", (_label, url, code) => {
    expect(codeOf(() => assertSafeTestDatabaseUrl(url))).toBe(code);
  });

  it.each([
    "recallfeed",
    "latest",
    "test",
    "my-test-db",
    "customer_test_backup",
    "recallfeed_test2",
    "postgres",
  ])("regression R1: rejects the local database name %s because only the fixture itself is allowed", (name) => {
    expect(codeOf(() => assertSafeTestDatabaseUrl(`postgres://u:p@localhost:5432/${name}`))).toBe(
      "VALIDATION_TEST_DATABASE_NAME",
    );
  });

  it.each([
    ["?host= override", `${FIXTURE_URL}?host=ep-example.neon.tech`],
    ["?hostname= override", `${FIXTURE_URL}?hostname=ep-example.neon.tech`],
    ["?database= override", `${FIXTURE_URL}?database=production`],
    ["?port= override", `${FIXTURE_URL}?port=6543`],
    ["?sslmode", `${FIXTURE_URL}?sslmode=require`],
    ["a fragment", `${FIXTURE_URL}#anything`],
    ["an empty query marker", `${FIXTURE_URL}?`],
  ])("regression R1: rejects %s, which can redirect the driver away from the URL's host", (_label, url) => {
    expect(codeOf(() => assertSafeTestDatabaseUrl(url))).toBe("VALIDATION_TEST_DATABASE_PARAMS");
  });

  it("never echoes the password in an error", () => {
    for (const url of [
      "postgres://admin:hunter2@db.example.com/recallfeed_test",
      `postgres://admin:hunter2@localhost/other?host=x`,
      "postgres://admin:hunter2@localhost/other",
    ]) {
      try {
        assertSafeTestDatabaseUrl(url);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(String(error)).not.toContain("hunter2");
      }
    }
  });
});

describe("assertDriverTargetMatchesUrl (gate 2: what the driver will actually connect to)", () => {
  it("accepts the real driver's parse of the fixture URL", () => {
    expect(() => assertDriverTargetMatchesUrl(new Client(FIXTURE_URL), FIXTURE_URL)).not.toThrow();
  });

  it("regression R1: the exact URL from the review passes gate 1's host check but the real driver resolves a different host, and gate 2 refuses it", () => {
    const overridden = `${FIXTURE_URL}?host=ep-example.neon.tech&database=production`;
    const driver = new Client(overridden);
    expect(driver.host).toBe("ep-example.neon.tech");
    expect(new URL(overridden).hostname).toBe("db.localtest.me");
    expect(codeOf(() => assertDriverTargetMatchesUrl(driver, overridden))).toBe("VALIDATION_TEST_DATABASE_TARGET");
  });

  it.each([
    ["host", { host: "ep-example.neon.tech", port: 5432, database: "recallfeed_test" }],
    ["port", { host: "db.localtest.me", port: 6543, database: "recallfeed_test" }],
    ["database", { host: "db.localtest.me", port: 5432, database: "production" }],
    ["a missing database", { host: "db.localtest.me", port: 5432, database: undefined }],
  ])("refuses a driver target that differs in %s", (_label, target) => {
    expect(codeOf(() => assertDriverTargetMatchesUrl(target, FIXTURE_URL))).toBe("VALIDATION_TEST_DATABASE_TARGET");
  });

  it("treats an omitted port as 5432 and ignores IPv6 brackets", () => {
    expect(() =>
      assertDriverTargetMatchesUrl(
        { host: "::1", port: 5432, database: "recallfeed_test" },
        "postgres://u:p@[::1]/recallfeed_test",
      ),
    ).not.toThrow();
  });
});
