import { env as workerEnv } from "cloudflare:workers";
import { configureLocalNeonHttp, createDb } from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";
import { app } from "../app";
import type { AccessExecutionContext, AccessIdentity, Env } from "../types";

/** The disposable test database URL, or "" when integration tests are skipped. */
export const databaseUrl = workerEnv.TEST_DATABASE_URL;

/**
 * Time allowed for one test that talks to the real database through the local proxy.
 *
 * What was observed: such a test takes roughly (its database HTTP requests) x (the time one request
 * takes). The feed test that seeds four cards makes 25 requests. A request took about 80 ms on a
 * developer machine, and about 116-256 ms on GitHub Actions (estimated from test durations, not timed
 * per request there). That test took about 2 s locally, 2.9 s in fast CI runs, and 5.0 s in two slow
 * ones, which reached Vitest's 5 s default. Adding a delay to every request sent to the local proxy
 * reproduced the timeout, and this larger allowance passed under that condition: the slowest test took
 * 6.2 s at about 230 ms per request and 10.5 s at about 380 ms per request. Why GitHub's executions
 * were slower has not been isolated, so this is an allowance for that condition, not a fix for its cause.
 *
 * 30 s is about three times the slowest case measured. A Vitest timeout fails a test when it expires;
 * it does not cancel the test's pending operations, and one local run reported a test that took 207 s
 * against a 120 s limit. So this bounds how long a test is allowed, not how long it can run. It is
 * applied to the database-backed suites only, never globally.
 */
export const DATABASE_TEST_TIMEOUT_MS = 30_000;

/** Obviously fake credentials for tests. They protect nothing. */
export const TEST_OWNER = "owner@example.test";
export const TEST_API_KEY = "test-api-key-not-a-secret-0123456789";
export const APP_ORIGIN = "https://recallfeed.example.test";

/** A request-scoped client for assertions made directly against the database. */
export function testDb(): DbClient {
  configureLocalNeonHttp(databaseUrl);
  return createDb(databaseUrl);
}

/** A name no earlier test run can have used. */
export function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * A Worker execution context shaped like the one Cloudflare Access provides.
 *
 * This is the same interface production reads (`ctx.access.getIdentity()`). The tests supply the
 * identity through it, exactly as Cloudflare does, and the application has no other way to learn an
 * identity: there is no header, query parameter, or flag a request can use to claim one.
 *
 * @param identity - The identity Access would report, or null for an anonymous visitor. Pass
 * `"absent"` to model a Worker that has no Access context at all.
 */
export function accessContext(identity: AccessIdentity | null | "absent" | "throws"): AccessExecutionContext {
  const base: AccessExecutionContext = {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as AccessExecutionContext;
  if (identity === "absent") {
    return base;
  }
  return Object.assign(base, {
    access: {
      getIdentity: (): Promise<AccessIdentity | null> =>
        identity === "throws" ? Promise.reject(new Error("access unavailable")) : Promise.resolve(identity),
    },
  });
}

/** Environment for a private deployment: one owner, identified by Cloudflare Access. */
export function privateEnv(overrides: Partial<Env> = {}): Env {
  return { DATABASE_URL: databaseUrl, FEED_VISIBILITY: "private", OWNER_EMAIL: TEST_OWNER, ...overrides };
}

/** Environment for a public deployment: anonymous reads of published cards, writes with an API key. */
export function publicEnv(overrides: Partial<Env> = {}): Env {
  return { DATABASE_URL: databaseUrl, FEED_VISIBILITY: "public", API_SECRET_KEY: TEST_API_KEY, ...overrides };
}

/** Sends a request through the real application. */
export function call(
  path: string,
  init: RequestInit,
  environment: Env,
  ctx: ExecutionContext = accessContext({ email: TEST_OWNER }),
): Promise<Response> {
  // Tests reach the disposable database through the local proxy. Production code never does this.
  if (databaseUrl) {
    configureLocalNeonHttp(databaseUrl);
  }
  return Promise.resolve(app.fetch(new Request(`${APP_ORIGIN}${path}`, init), environment, ctx));
}

/** A same-origin POST of Markdown, as a browser on the app's own pages would send it. */
export function markdownPost(markdown: string, headers: Record<string, string> = {}): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "text/markdown", Origin: APP_ORIGIN, ...headers },
    body: markdown,
  };
}

/** Parses a JSON response body. */
export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** A card created through the real import path and then adjusted with SQL. */
export type SeededCard = { id: string; sourceId: string; content: string };

/**
 * Creates one card through `POST /import/markdown`, then sets the state the test needs.
 *
 * The card is given a `last_reviewed_at` older than any card seeded before it, in this run or an
 * earlier one, so it sits at the front of the fixed feed order no matter how large the shared
 * fixture has grown. Cards seeded later in a test therefore come first in the list.
 *
 * @param state - `published` and `snoozed` set the matching columns.
 */
export async function seedCard(state: { published?: boolean; snoozed?: boolean } = {}): Promise<SeededCard> {
  const name = uniqueName("seed");
  const imported = await call(
    "/import/markdown",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": TEST_API_KEY },
      body: JSON.stringify({ content: `# Seed\n\nseeded card body ${name}`, name }),
    },
    publicEnv(),
  );
  if (imported.status !== 200) {
    throw new Error(`seeding import failed with ${imported.status}`);
  }
  const { sourceId } = await json<{ sourceId: string }>(imported);
  const rows = await testDb().query(
    `UPDATE feed_items
        SET is_published = $2,
            snoozed_until = CASE WHEN $3 THEN NOW() + interval '1 day' ELSE NULL END,
            last_reviewed_at = TIMESTAMPTZ '1900-01-01' - EXTRACT(EPOCH FROM clock_timestamp()) * interval '1 second'
      WHERE source_id = $1
      RETURNING id, content`,
    [sourceId, state.published === true, state.snoozed === true],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("seeding produced no card");
  }
  return { id: String(row.id), sourceId, content: String(row.content) };
}
