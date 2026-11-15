import { env } from "cloudflare:workers";
import { configureLocalNeonHttp, countHttpRequests, createDb } from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";

export { countHttpRequests };

/** The disposable test database URL, or "" when integration tests are skipped. */
export const databaseUrl = env.TEST_DATABASE_URL;

/**
 * Time allowed for one test that talks to the real database through the local proxy. A test takes
 * (its database requests) x (the latency of one request), and only the latency varies: about 80 ms
 * locally and 115-260 ms on GitHub Actions. See DATABASE_TEST_TIMEOUT_MS in the api package's test
 * helpers for the measurements behind 30 s. Applied to the database-backed suite only, never globally.
 */
export const DATABASE_TEST_TIMEOUT_MS = 30_000;

/** A request-scoped client for the test database, with local-proxy routing applied. */
export function testDb(): DbClient {
  configureLocalNeonHttp(databaseUrl);
  return createDb(databaseUrl);
}

/** A name no earlier test run can have used, so tests never depend on leftover rows. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
