import { Client } from "@neondatabase/serverless";
import ws from "ws";
import { configureLocalNeonWebSocket } from "./local-proxy";
import { resetFixtureSchema } from "./test-fixture";
import { assertDriverTargetMatchesUrl, assertSafeTestDatabaseUrl } from "./test-safety";

/**
 * Builds a client for the disposable fixture after the URL and driver-target gates pass.
 *
 * The client is returned unconnected, so a refused URL has opened no connection.
 * Node only: the WebSocket constructor comes from the `ws` package.
 *
 * @param databaseUrl - The value of `TEST_DATABASE_URL`.
 * @returns An unconnected client whose local-proxy settings apply to it alone.
 * @throws ValidationError if the URL or the driver's effective target is not the fixture.
 */
export function createGuardedFixtureClient(databaseUrl: string): Client {
  assertSafeTestDatabaseUrl(databaseUrl);
  const client = new Client(databaseUrl);
  assertDriverTargetMatchesUrl(client, databaseUrl);
  client.neonConfig.webSocketConstructor = ws;
  configureLocalNeonWebSocket(client);
  return client;
}

/**
 * Resets the fixture's `public` schema, behind all three gates: the URL check, the
 * driver-target check, and the identity-and-marker check on the live session.
 *
 * @param databaseUrl - The value of `TEST_DATABASE_URL`.
 * @throws ValidationError if any gate refuses; no destructive SQL has run in that case.
 */
export async function resetDisposableFixture(databaseUrl: string): Promise<void> {
  const client = createGuardedFixtureClient(databaseUrl);
  await client.connect();
  try {
    await resetFixtureSchema(client);
  } finally {
    await client.end();
  }
}
