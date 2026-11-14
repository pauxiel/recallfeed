import { env } from "cloudflare:workers";
import { configureLocalNeonHttp, countHttpRequests, createDb } from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";

export { countHttpRequests };

/** The disposable test database URL, or "" when integration tests are skipped. */
export const databaseUrl = env.TEST_DATABASE_URL;

/** A request-scoped client for the test database, with local-proxy routing applied. */
export function testDb(): DbClient {
  configureLocalNeonHttp(databaseUrl);
  return createDb(databaseUrl);
}

/** A name no earlier test run can have used, so tests never depend on leftover rows. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
