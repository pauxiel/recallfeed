import { env } from "cloudflare:workers";
import type { NormalizedNote } from "@recallfeed/core";
import { createDb } from "../../client";
import type { DbClient } from "../../client";
import { configureLocalNeonHttp } from "../../local-proxy";

/** The disposable test database URL, or "" when integration tests are skipped. */
export const databaseUrl = env.TEST_DATABASE_URL;

/**
 * Time allowed for one test that talks to the real database through the local proxy, the same
 * allowance the api and feed-engine suites use. Such a test takes roughly (its database requests) x
 * (the time one request takes). The keyset walk tests in `feed-pages.test.ts` make one request per page:
 * they took 1.5-2.5 s locally and 3.8-5.0 s on GitHub Actions, where four reached Vitest's 5 s default
 * (CI run 44801076724). Why GitHub's executions are slower has not been isolated, so this is an
 * allowance for that condition, not a fix for its cause. See DATABASE_TEST_TIMEOUT_MS in the api
 * package's test helpers for the measurements, and for what a Vitest timeout does and does not do.
 * Applied to database-backed suites only, never globally.
 */
export const DATABASE_TEST_TIMEOUT_MS = 30_000;

/** A client for the test database, with local-proxy routing applied. */
export function testDb(): DbClient {
  configureLocalNeonHttp(databaseUrl);
  return createDb(databaseUrl);
}

/** A name no earlier test run can have used, so tests never depend on leftover rows. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Hex SHA-256 of a string, using Web Crypto as the Workers runtime provides it. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Builds a normalized note for a source from its content. */
export async function makeNote(
  sourceId: string,
  content: string,
  overrides: Partial<NormalizedNote> = {},
): Promise<NormalizedNote> {
  return {
    sourceId,
    title: null,
    content,
    contentHash: await sha256Hex(content),
    metadata: {},
    ...overrides,
  };
}
