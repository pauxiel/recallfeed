import { neonConfig } from "@neondatabase/serverless";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_PROXY_HOST, LOCAL_PROXY_PORT, configureLocalNeonProxy } from "../local-proxy";

// neonConfig is process-wide, so every test restores what it changed.
const original = {
  fetchEndpoint: neonConfig.fetchEndpoint,
  wsProxy: neonConfig.wsProxy,
  useSecureWebSocket: neonConfig.useSecureWebSocket,
};

afterEach(() => {
  neonConfig.fetchEndpoint = original.fetchEndpoint;
  neonConfig.wsProxy = original.wsProxy;
  neonConfig.useSecureWebSocket = original.useSecureWebSocket;
});

describe("configureLocalNeonProxy", () => {
  it.each([
    "postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed",
    "postgres://u:p@localhost:5432/recallfeed_test",
    "postgres://u:p@db.localtest.me.evil.example/recallfeed_test",
  ])("leaves the driver untouched for %s, so real Neon URLs are never rerouted", (url) => {
    expect(configureLocalNeonProxy(url)).toBe(false);
    expect(neonConfig.fetchEndpoint).toBe(original.fetchEndpoint);
    expect(neonConfig.wsProxy).toBe(original.wsProxy);
    expect(neonConfig.useSecureWebSocket).toBe(original.useSecureWebSocket);
  });

  it("routes HTTP queries for the proxy host to the local proxy over plain HTTP", () => {
    expect(configureLocalNeonProxy(`postgres://u:p@${LOCAL_PROXY_HOST}:5432/recallfeed_test`)).toBe(true);
    const endpoint = neonConfig.fetchEndpoint;
    if (typeof endpoint !== "function") {
      throw new Error("expected fetchEndpoint to be a function");
    }
    expect(endpoint(LOCAL_PROXY_HOST, 5432)).toBe(`http://${LOCAL_PROXY_HOST}:${LOCAL_PROXY_PORT}/sql`);
    // Any other host keeps the normal HTTPS endpoint shape.
    expect(endpoint("ep-cool-123.neon.tech", 5432)).toBe("https://ep-cool-123.neon.tech/sql");
  });

  it("routes WebSocket traffic for the proxy host to the local proxy without TLS", () => {
    configureLocalNeonProxy(`postgres://u:p@${LOCAL_PROXY_HOST}:5432/recallfeed_test`);
    const wsProxy = neonConfig.wsProxy;
    if (typeof wsProxy !== "function") {
      throw new Error("expected wsProxy to be a function");
    }
    expect(neonConfig.useSecureWebSocket).toBe(false);
    expect(wsProxy(LOCAL_PROXY_HOST, 5432)).toBe(`${LOCAL_PROXY_HOST}:${LOCAL_PROXY_PORT}/v1`);
    expect(wsProxy("ep-cool-123.neon.tech", 5432)).toBe("ep-cool-123.neon.tech/v2");
  });
});
