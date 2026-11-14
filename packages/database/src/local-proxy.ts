import { neonConfig } from "@neondatabase/serverless";
import type { Client } from "@neondatabase/serverless";
import { ValidationError } from "@recallfeed/core";

/** The host name the local Neon-compatible proxy answers to. `*.localtest.me` resolves to 127.0.0.1. */
export const LOCAL_PROXY_HOST = "db.localtest.me";

/** The port the local proxy publishes on 127.0.0.1 (see `docker/compose.test.yaml`). */
export const LOCAL_PROXY_PORT = 4444;

/** The `fetchEndpoint` value that was in effect before this module first changed it. */
let originalFetchEndpoint: typeof neonConfig.fetchEndpoint | undefined;

/**
 * Routes HTTP queries for the local proxy host to the local proxy over plain HTTP.
 *
 * The driver reads `fetchEndpoint` only from process-wide state, so this cannot be scoped
 * to one client. The installed function therefore answers only for the exact host
 * {@link LOCAL_PROXY_HOST} and delegates every other host to the endpoint that was in
 * effect before, so a real Neon host keeps its normal HTTPS endpoint.
 *
 * Production Worker code never calls this. The migration runner and tests do.
 *
 * @param databaseUrl - The connection string about to be used.
 * @returns True if the URL's host is the local proxy host and routing was installed.
 */
export function configureLocalNeonHttp(databaseUrl: string): boolean {
  if (new URL(databaseUrl).hostname !== LOCAL_PROXY_HOST) {
    return false;
  }
  originalFetchEndpoint ??= neonConfig.fetchEndpoint;
  const fallback = originalFetchEndpoint;
  neonConfig.fetchEndpoint = (host, port, options) => {
    if (host === LOCAL_PROXY_HOST) {
      return `http://${host}:${LOCAL_PROXY_PORT}/sql`;
    }
    return typeof fallback === "function" ? fallback(host, port, options) : fallback;
  };
  return true;
}

/**
 * Lets one WebSocket client talk to the local proxy without TLS, and nothing else.
 *
 * The insecure settings are written to the client's own `neonConfig`, never to the
 * process-wide `neonConfig`. A client whose effective host is not exactly
 * {@link LOCAL_PROXY_HOST} is left untouched, so it keeps the driver's secure defaults.
 * The installed `wsProxy` refuses any other host instead of falling back to one.
 *
 * Call this after constructing the client and before `connect()`.
 *
 * @param client - A Neon client that has not connected yet.
 * @returns True if the client was configured for the local proxy.
 */
export function configureLocalNeonWebSocket(client: Client): boolean {
  if (client.host !== LOCAL_PROXY_HOST) {
    return false;
  }
  client.neonConfig.useSecureWebSocket = false;
  client.neonConfig.wsProxy = (host) => {
    if (host !== LOCAL_PROXY_HOST) {
      throw new ValidationError(
        `Refusing to open an unencrypted WebSocket to "${host}"; only ${LOCAL_PROXY_HOST} is allowed.`,
        "VALIDATION_LOCAL_PROXY_HOST",
      );
    }
    return `${host}:${LOCAL_PROXY_PORT}/v1`;
  };
  return true;
}
