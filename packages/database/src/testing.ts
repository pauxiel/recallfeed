/**
 * Node-only helpers for integration tests in other packages.
 *
 * Import from `@recallfeed/database/testing` in a Vitest `globalSetup` file. This module uses
 * `node:fs` and the `ws` package, so it must never be imported by Worker code. The Workers-safe
 * test helper `countHttpRequests` lives in `@recallfeed/database` itself.
 */
import { migrateDatabase } from "./migrate-node";
import type { MigrationReport } from "./migrate";
import { assertDisposableFixture } from "./test-fixture";
import { createGuardedFixtureClient } from "./test-fixture-node";

/**
 * Makes sure the disposable fixture has every migration applied, without resetting anything.
 *
 * It runs the same three safety gates as the destructive reset (URL, the driver's real target,
 * and the fixture identity and marker on the live session) before it writes anything. Only the
 * `@recallfeed/database` test setup ever drops the schema; every other package calls this.
 *
 * @param databaseUrl - The value of `TEST_DATABASE_URL`.
 * @returns The migrations applied and skipped.
 * @throws ValidationError if the target is not the disposable fixture.
 */
export async function ensureFixtureMigrated(databaseUrl: string): Promise<MigrationReport> {
  const client = createGuardedFixtureClient(databaseUrl);
  await client.connect();
  try {
    await assertDisposableFixture(client);
  } finally {
    await client.end();
  }
  return migrateDatabase(databaseUrl);
}
