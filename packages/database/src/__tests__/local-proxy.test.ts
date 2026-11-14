import { Client, neonConfig } from "@neondatabase/serverless";
import { ValidationError } from "@recallfeed/core";
import { afterEach, describe, expect, it } from "vitest";
import {
  LOCAL_PROXY_HOST,
  LOCAL_PROXY_PORT,
  configureLocalNeonHttp,
  configureLocalNeonWebSocket,
} from "../local-proxy";

const LOCAL_URL = `postgres://u:p@${LOCAL_PROXY_HOST}:5432/recallfeed_test`;
const REMOTE_URL = "postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed";

// neonConfig.fetchEndpoint is process-wide and cannot be scoped to a client, so tests restore it.
const originalFetchEndpoint = neonConfig.fetchEndpoint;
afterEach(() => {
  neonConfig.fetchEndpoint = originalFetchEndpoint;
});

function wsProxyOf(client: Client): (host: string, port: number | string) => string {
  const { wsProxy } = client.neonConfig;
  if (typeof wsProxy !== "function") {
    throw new Error("expected wsProxy to be a function");
  }
  return wsProxy;
}

describe("configureLocalNeonHttp (process-wide HTTP routing)", () => {
  it.each([
    REMOTE_URL,
    "postgres://u:p@localhost:5432/recallfeed_test",
    "postgres://u:p@db.localtest.me.evil.example/recallfeed_test",
  ])("does nothing for %s", (url) => {
    expect(configureLocalNeonHttp(url)).toBe(false);
    expect(neonConfig.fetchEndpoint).toBe(originalFetchEndpoint);
  });

  it("sends the proxy host to the local proxy over HTTP and keeps the default for every other host", () => {
    expect(configureLocalNeonHttp(LOCAL_URL)).toBe(true);
    const endpoint = neonConfig.fetchEndpoint;
    if (typeof endpoint !== "function" || typeof originalFetchEndpoint !== "function") {
      throw new Error("expected fetchEndpoint to be a function");
    }
    expect(endpoint(LOCAL_PROXY_HOST, 5432)).toBe(`http://${LOCAL_PROXY_HOST}:${LOCAL_PROXY_PORT}/sql`);
    expect(endpoint("ep-cool-123.neon.tech", 5432)).toBe(originalFetchEndpoint("ep-cool-123.neon.tech", 5432));
    expect(endpoint("ep-cool-123.neon.tech", 5432)).toMatch(/^https:\/\//);
  });

  it("does not stack wrappers when called repeatedly", () => {
    configureLocalNeonHttp(LOCAL_URL);
    configureLocalNeonHttp(LOCAL_URL);
    configureLocalNeonHttp(LOCAL_URL);
    const endpoint = neonConfig.fetchEndpoint;
    if (typeof endpoint !== "function" || typeof originalFetchEndpoint !== "function") {
      throw new Error("expected fetchEndpoint to be a function");
    }
    expect(endpoint("ep-cool-123.neon.tech", 5432)).toBe(originalFetchEndpoint("ep-cool-123.neon.tech", 5432));
  });
});

describe("configureLocalNeonWebSocket (per-client TLS relaxation)", () => {
  it("relaxes TLS on the local client only, never on the process-wide config", () => {
    const globalBefore = neonConfig.useSecureWebSocket;
    const client = new Client(LOCAL_URL);
    expect(configureLocalNeonWebSocket(client)).toBe(true);
    expect(client.neonConfig.useSecureWebSocket).toBe(false);
    expect(wsProxyOf(client)(LOCAL_PROXY_HOST, 5432)).toBe(`${LOCAL_PROXY_HOST}:${LOCAL_PROXY_PORT}/v1`);
    expect(neonConfig.useSecureWebSocket).toBe(globalBefore);
    expect(neonConfig.useSecureWebSocket).toBe(true);
  });

  it("regression R2: a nonlocal client created after a local one keeps TLS on", () => {
    const local = new Client(LOCAL_URL);
    configureLocalNeonWebSocket(local);

    const remote = new Client(REMOTE_URL);
    expect(configureLocalNeonWebSocket(remote)).toBe(false);
    expect(remote.neonConfig.useSecureWebSocket).toBe(true);
    expect(neonConfig.useSecureWebSocket).toBe(true);
    expect(local.neonConfig.useSecureWebSocket).toBe(false);
  });

  it("regression R2: the local client refuses an unencrypted WebSocket to any other host", () => {
    const client = new Client(LOCAL_URL);
    configureLocalNeonWebSocket(client);
    const wsProxy = wsProxyOf(client);
    expect(() => wsProxy("ep-cool-123.neon.tech", 5432)).toThrow(ValidationError);
    expect(() => wsProxy("ep-cool-123.neon.tech", 5432)).toThrow(/Refusing to open an unencrypted WebSocket/);
  });

  it("regression R1+R2: a URL that shows the proxy host but overrides it with ?host= gets no TLS relaxation", () => {
    const disguised = new Client(`${LOCAL_URL}?host=ep-example.neon.tech`);
    expect(disguised.host).toBe("ep-example.neon.tech");
    expect(configureLocalNeonWebSocket(disguised)).toBe(false);
    expect(disguised.neonConfig.useSecureWebSocket).toBe(true);
  });
});
