import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import type { MigrationClient } from "../migrate";
import { FIXTURE_MARKER, assertDisposableFixture, resetFixtureSchema } from "../test-fixture";

/** A scripted session: answers the identity query with `identity` and records every statement. */
function session(identity: { database?: string; marker?: string | null }) {
  const statements: string[] = [];
  const client: MigrationClient = {
    query(text: string) {
      statements.push(text);
      if (text.includes("current_database()")) {
        return Promise.resolve({ rows: [{ database: identity.database, marker: identity.marker ?? null }] });
      }
      return Promise.resolve({ rows: [] });
    },
  };
  const destructive = () => statements.filter((s) => /^\s*(DROP|CREATE SCHEMA)/i.test(s));
  return { client, statements, destructive };
}

describe("assertDisposableFixture (gate 3: identity and marker on the live session)", () => {
  it("passes for recallfeed_test carrying the fixture marker", async () => {
    const { client } = session({ database: "recallfeed_test", marker: FIXTURE_MARKER });
    await expect(assertDisposableFixture(client)).resolves.toBeUndefined();
  });

  it.each([
    ["a different database name", { database: "customer_test_backup", marker: FIXTURE_MARKER }, "VALIDATION_TEST_FIXTURE_IDENTITY"],
    ["no database name", { database: undefined, marker: FIXTURE_MARKER }, "VALIDATION_TEST_FIXTURE_IDENTITY"],
    ["the right name but no marker", { database: "recallfeed_test", marker: null }, "VALIDATION_TEST_FIXTURE_MARKER"],
    ["the right name but a different marker", { database: "recallfeed_test", marker: "someone-elses-comment" }, "VALIDATION_TEST_FIXTURE_MARKER"],
  ])("refuses %s", async (_label, identity, code) => {
    const { client } = session(identity);
    const error = await assertDisposableFixture(client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
  });
});

describe("resetFixtureSchema", () => {
  it("drops and recreates public, in that order, only after the identity check", async () => {
    const { client, statements, destructive } = session({ database: "recallfeed_test", marker: FIXTURE_MARKER });
    await resetFixtureSchema(client);
    expect(destructive()).toEqual(["DROP SCHEMA IF EXISTS public CASCADE", "CREATE SCHEMA public"]);
    const firstDestructive = statements.findIndex((s) => s.startsWith("DROP"));
    const identityCheck = statements.findIndex((s) => s.includes("current_database()"));
    expect(identityCheck).toBeGreaterThanOrEqual(0);
    expect(identityCheck).toBeLessThan(firstDestructive);
  });

  it.each([
    ["a non-fixture local database", { database: "customer_test_backup", marker: FIXTURE_MARKER }],
    ["a database with the right name that was not created as the fixture", { database: "recallfeed_test", marker: null }],
    ["a database whose marker is wrong", { database: "recallfeed_test", marker: "not-the-marker" }],
  ])("regression R1: %s never receives destructive SQL", async (_label, identity) => {
    const { client, destructive } = session(identity);
    await expect(resetFixtureSchema(client)).rejects.toBeInstanceOf(ValidationError);
    expect(destructive()).toEqual([]);
  });
});
