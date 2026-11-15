import { env } from "cloudflare:workers";
import { configureLocalNeonHttp, countHttpRequests, createDb } from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";

export { countHttpRequests };

/** The disposable test database URL, or "" when integration tests are skipped. */
export const databaseUrl = env.TEST_DATABASE_URL;

/**
 * Time allowed for one test that talks to the real database through the local proxy. Such a test takes
 * roughly (its database requests) x (the time one request takes): about 80 ms locally and an estimated
 * 116-256 ms on GitHub Actions. Why GitHub's executions were slower has not been isolated, so this is
 * an allowance for that condition, not a fix for its cause. See DATABASE_TEST_TIMEOUT_MS in the api
 * package's test helpers for the measurements, and for what a Vitest timeout does and does not do.
 * Applied to the database-backed suite only, never globally.
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
