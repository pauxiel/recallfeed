import { neonConfig } from "@neondatabase/serverless";

/** The host name the local Neon-compatible proxy answers to. `*.localtest.me` resolves to 127.0.0.1. */
export const LOCAL_PROXY_HOST = "db.localtest.me";

/** The port the local proxy publishes on 127.0.0.1 (see `docker/compose.test.yaml`). */
export const LOCAL_PROXY_PORT = 4444;

/**
 * Points the Neon driver at the local proxy when, and only when, the connection
 * string's host is {@link LOCAL_PROXY_HOST}.
 *
 * `neonConfig` is process-wide state, so this is called by the migration CLI and the
 * test setup, never by production Worker code. For any other host it changes nothing,
 * so passing a real Neon URL cannot reroute queries.
 *
 * @param databaseUrl - The connection string about to be used.
 * @returns True if the driver was configured for the local proxy.
 */
export function configureLocalNeonProxy(databaseUrl: string): boolean {
  if (new URL(databaseUrl).hostname !== LOCAL_PROXY_HOST) {
    return false;
  }
  neonConfig.fetchEndpoint = (host) =>
    host === LOCAL_PROXY_HOST
      ? `http://${host}:${LOCAL_PROXY_PORT}/sql`
      : `https://${host}/sql`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.wsProxy = (host) =>
    host === LOCAL_PROXY_HOST ? `${host}:${LOCAL_PROXY_PORT}/v1` : `${host}/v2`;
  return true;
}
