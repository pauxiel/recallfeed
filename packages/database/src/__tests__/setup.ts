import type { TestProject } from "vitest/node";
import { migrateDatabase } from "../migrate-node";
import { resetDisposableFixture } from "../test-fixture-node";

/**
 * Vitest global setup. Runs once in Node before the tests.
 *
 * With no `TEST_DATABASE_URL` it does nothing and the integration suites skip. With one,
 * it resets the `public` schema behind three gates (URL, the driver's real target, and
 * the fixture identity and marker on the live session; see `test-fixture-node.ts`), then
 * runs the real migration code twice so the tests can verify both runs.
 */
export default async function setup(project: TestProject): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
  if (databaseUrl === "") {
    project.provide("migrationRuns", null);
    return;
  }

  await resetDisposableFixture(databaseUrl);
  const first = await migrateDatabase(databaseUrl);
  const second = await migrateDatabase(databaseUrl);
  project.provide("migrationRuns", { first, second });
}
