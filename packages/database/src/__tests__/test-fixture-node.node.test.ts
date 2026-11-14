import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neonConfig } from "@neondatabase/serverless";
import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { FIXTURE_MARKER } from "../test-fixture";
import { createGuardedFixtureClient, resetDisposableFixture } from "../test-fixture-node";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
const FIXTURE_URL = "postgres://postgres:postgres@db.localtest.me:5432/recallfeed_test";
// The exact URL shape from the review: shows the local proxy host, but the driver would
// connect to the host named in the query string.
const OVERRIDE_URL = `${FIXTURE_URL}?host=ep-example.neon.tech&database=production`;

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ValidationError ? error.code : `unexpected: ${String(error)}`;
  }
  return undefined;
}

describe("fixture marker", () => {
  it("FIXTURE_MARKER matches the comment that docker/init-test-fixture.sql writes", async () => {
    const sql = await readFile(
      fileURLToPath(new URL("../../docker/init-test-fixture.sql", import.meta.url)),
      "utf8",
    );
    const match = /COMMENT ON DATABASE recallfeed_test IS '([^']+)'/.exec(sql);
    expect(match?.[1]).toBe(FIXTURE_MARKER);
  });

  it("compose.test.yaml mounts that init script into the PostgreSQL init directory", async () => {
    const compose = await readFile(
      fileURLToPath(new URL("../../docker/compose.test.yaml", import.meta.url)),
      "utf8",
    );
    expect(compose).toContain("./init-test-fixture.sql:/docker-entrypoint-initdb.d/");
  });
});

describe("createGuardedFixtureClient", () => {
  it("regression R1: refuses the review's override URL before building any client", () => {
    expect(() => createGuardedFixtureClient(OVERRIDE_URL)).toThrow(ValidationError);
  });

  it("builds an unconnected client for the fixture URL and relaxes TLS on that client only", () => {
    const client = createGuardedFixtureClient(FIXTURE_URL);
    expect(client.host).toBe("db.localtest.me");
    expect(client.database).toBe("recallfeed_test");
    expect(client.neonConfig.useSecureWebSocket).toBe(false);
    expect(neonConfig.useSecureWebSocket).toBe(true);
  });

  it("does not relax TLS for a plain localhost target", () => {
    const client = createGuardedFixtureClient("postgres://u:p@localhost:5432/recallfeed_test");
    expect(client.neonConfig.useSecureWebSocket).toBe(true);
  });
});

describe("resetDisposableFixture refuses before any connection", () => {
  it.each([
    ["the review's ?host= override", OVERRIDE_URL, "VALIDATION_TEST_DATABASE_PARAMS"],
    ["a Neon cloud host", "postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed_test", "VALIDATION_TEST_DATABASE_HOST"],
    ["a non-fixture local database name", "postgres://u:p@localhost:5432/customer_test_backup", "VALIDATION_TEST_DATABASE_NAME"],
  ])("regression R1: %s", async (_label, url, code) => {
    // A ValidationError (not a network error) proves it stopped before trying to connect.
    expect(await codeOf(resetDisposableFixture(url))).toBe(code);
  });
});

describe.skipIf(databaseUrl === "")("destructive reset gates against the live fixture", () => {
  async function withAdminClient<T>(fn: (query: (text: string) => Promise<Record<string, unknown>[]>) => Promise<T>): Promise<T> {
    const client = createGuardedFixtureClient(databaseUrl);
    await client.connect();
    try {
      return await fn(async (text) => (await client.query(text)).rows);
    } finally {
      await client.end();
    }
  }

  it("the fixture carries the marker the container wrote at creation", async () => {
    const rows = await withAdminClient((query) =>
      query(`SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()`),
    );
    expect(rows[0]?.marker).toBe(FIXTURE_MARKER);
  });

  it("regression R1: with the marker removed, the reset is refused and existing data is untouched", async () => {
    const before = await withAdminClient((query) => query("SELECT filename FROM _schema_migrations"));
    expect(before.length).toBeGreaterThan(0);

    await withAdminClient((query) => query("COMMENT ON DATABASE recallfeed_test IS NULL"));
    try {
      expect(await codeOf(resetDisposableFixture(databaseUrl))).toBe("VALIDATION_TEST_FIXTURE_MARKER");
      const after = await withAdminClient((query) => query("SELECT filename FROM _schema_migrations"));
      expect(after).toEqual(before);
    } finally {
      await withAdminClient((query) => query(`COMMENT ON DATABASE recallfeed_test IS '${FIXTURE_MARKER}'`));
    }

    const restored = await withAdminClient((query) =>
      query(`SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()`),
    );
    expect(restored[0]?.marker).toBe(FIXTURE_MARKER);
  });
});
