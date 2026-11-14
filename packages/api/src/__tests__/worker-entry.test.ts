import { describe, expect, it } from "vitest";
import { configureLocalNeonHttp } from "@recallfeed/database";
import worker from "../index";
import { APP_ORIGIN, TEST_OWNER, accessContext, databaseUrl, json, privateEnv, publicEnv } from "./helpers";

const request = (path: string): Request => new Request(`${APP_ORIGIN}${path}`);

describe("the production Worker entry point (src/index.ts)", () => {
  it("passes the execution context through, so Access identity decides authorization", async () => {
    const anonymous = await worker.fetch(request("/feed"), privateEnv(), accessContext(null));
    const stranger = await worker.fetch(request("/feed"), privateEnv(), accessContext({ email: "x@example.test" }));

    expect(anonymous.status).toBe(401);
    expect(stranger.status).toBe(403);
  });

  it("a private deployment with no Access context fails closed with a generic 500", async () => {
    const response = await worker.fetch(request("/feed"), privateEnv(), accessContext("absent"));

    expect(response.status).toBe(500);
    expect((await json(response)).code).toBe("AUTH_NOT_CONFIGURED");
  });

  it("an unknown path is a JSON 404 carrying the private cache policy", async () => {
    const response = await worker.fetch(request("/nope"), privateEnv(), accessContext({ email: TEST_OWNER }));

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await json(response)).code).toBe("NOT_FOUND_ROUTE");
  });

  it("does not route the local database proxy: an unconfigured database URL is a generic 500", async () => {
    // The production entry never calls configureLocalNeonHttp, so the local proxy host is not
    // special here. The request fails, and the caller learns nothing about why.
    const response = await worker.fetch(
      request("/feed"),
      publicEnv({ DATABASE_URL: "postgres://u:p@db.localtest.me:1/x" }),
      accessContext(null),
    );

    expect(response.status).toBe(500);
    const text = JSON.stringify(await json(response));
    expect(text).not.toContain("localtest");
    expect(text).not.toContain("postgres://");
  });

  it.skipIf(databaseUrl === "")("serves the public feed through the real database", async () => {
    // The production entry never routes the local proxy, so the test does it, as `call()` does.
    configureLocalNeonHttp(databaseUrl);
    const response = await worker.fetch(request("/feed?limit=1"), publicEnv(), accessContext(null));

    expect(response.status).toBe(200);
  });
});
