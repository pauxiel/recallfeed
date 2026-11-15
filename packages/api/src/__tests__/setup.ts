import { ensureFixtureMigrated } from "@recallfeed/database/testing";

/**
 * Vitest global setup. With no `TEST_DATABASE_URL` it does nothing and the integration suites
 * skip. With one, it makes sure the disposable fixture has every migration applied, behind the
 * same three safety gates the database package uses. It never resets the schema; only
 * `@recallfeed/database` does that.
 */
export default async function setup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? "";
  if (databaseUrl === "") {
    return;
  }
  await ensureFixtureMigrated(databaseUrl);
}
