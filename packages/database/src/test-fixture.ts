import { ValidationError } from "@recallfeed/core";
import type { MigrationClient } from "./migrate";
import { FIXTURE_DATABASE } from "./test-safety";

/**
 * The database comment that marks a database as the disposable test fixture.
 *
 * `docker/init-test-fixture.sql` writes it when the fixture is created. A database comment
 * lives outside the `public` schema, so resetting the schema does not remove it, and
 * a database that was not created as the fixture does not have it.
 */
export const FIXTURE_MARKER = "recallfeed-disposable-test-fixture:v1";

/**
 * Third gate: asks the connected server who it is, and refuses unless it is the fixture.
 *
 * Runs on the same session that will run the destructive SQL, so nothing can change
 * between the check and the reset.
 *
 * @param client - A connected session.
 * @throws ValidationError if the database name or the fixture marker is not as expected.
 */
export async function assertDisposableFixture(client: MigrationClient): Promise<void> {
  const result = await client.query(
    `SELECT current_database() AS database,
            shobj_description(d.oid, 'pg_database') AS marker
       FROM pg_database d
      WHERE d.datname = current_database()`,
  );
  const row = result.rows[0];
  if (row?.database !== FIXTURE_DATABASE) {
    throw new ValidationError(
      `Connected database is "${String(row?.database)}", not the disposable fixture "${FIXTURE_DATABASE}". Nothing was changed.`,
      "VALIDATION_TEST_FIXTURE_IDENTITY",
    );
  }
  if (row.marker !== FIXTURE_MARKER) {
    throw new ValidationError(
      `Database "${FIXTURE_DATABASE}" does not carry the disposable-fixture marker, so it was not created as the test fixture. Nothing was changed.`,
      "VALIDATION_TEST_FIXTURE_MARKER",
    );
  }
}

/**
 * Drops and recreates the `public` schema of the disposable fixture.
 *
 * The identity and marker check runs first, on the same session, and the destructive
 * statements are only reachable after it passes.
 *
 * @param client - A connected session on the fixture database.
 * @throws ValidationError if the session is not connected to the disposable fixture.
 */
export async function resetFixtureSchema(client: MigrationClient): Promise<void> {
  await assertDisposableFixture(client);
  await client.query("DROP SCHEMA IF EXISTS public CASCADE");
  await client.query("CREATE SCHEMA public");
}
