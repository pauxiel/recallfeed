import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import type { TestProject } from "vitest/node";
import { configureLocalNeonProxy } from "../local-proxy";
import { migrateDatabase } from "../migrate-node";
import { assertSafeTestDatabaseUrl } from "../test-safety";

/**
 * Vitest global setup. Runs once in Node before the Workers-runtime tests.
 *
 * With no `TEST_DATABASE_URL` it does nothing and the integration suites skip. With one,
 * it checks the target is a local test database, resets the `public` schema, and runs
 * the real migration code twice so the tests can verify both runs.
 */
export default async function setup(project: TestProject): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
  if (databaseUrl === "") {
    project.provide("migrationRuns", null);
    return;
  }

  assertSafeTestDatabaseUrl(databaseUrl);
  configureLocalNeonProxy(databaseUrl);
  neonConfig.webSocketConstructor = ws;

  const client = new Client(databaseUrl);
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }

  const first = await migrateDatabase(databaseUrl);
  const second = await migrateDatabase(databaseUrl);
  project.provide("migrationRuns", { first, second });
}
