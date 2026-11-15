import { env } from "cloudflare:workers";
import type { NormalizedNote } from "@recallfeed/core";
import { createDb } from "../../client";
import type { DbClient } from "../../client";
import { configureLocalNeonHttp } from "../../local-proxy";

/** The disposable test database URL, or "" when integration tests are skipped. */
export const databaseUrl = env.TEST_DATABASE_URL;

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
