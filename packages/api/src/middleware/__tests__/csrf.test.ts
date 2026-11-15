import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv, Env } from "../../types";
import { cacheControl } from "../cache";
import { csrfProtection } from "../csrf";
import { handleError } from "../errors";
import { requestId } from "../request-id";
import { APP_ORIGIN, accessContext } from "../../__tests__/helpers";

function build(environment: Env) {
  const app = new Hono<AppEnv>();
  app.use("*", requestId);
  app.use("*", cacheControl);
  app.use("*", csrfProtection);
  app.all("/thing", (c) => c.json({ reached: true }));
  app.onError(handleError);
  return (method: string, headers: Record<string, string> = {}) =>
    Promise.resolve(
      app.fetch(new Request(`${APP_ORIGIN}/thing`, { method, headers }), environment, accessContext(null)),
    );
}

const privateEnv: Env = { DATABASE_URL: "unused", FEED_VISIBILITY: "private", OWNER_EMAIL: "o@x.test" };
const publicEnv: Env = { DATABASE_URL: "unused", FEED_VISIBILITY: "public", API_SECRET_KEY: "k" };

async function code(response: Response): Promise<string | undefined> {
  return ((await response.json()) as { code?: string }).code;
}

describe("csrfProtection in private mode", () => {
  const send = build(privateEnv);

  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s with the app's own Origin passes", async (method) => {
    expect((await send(method, { Origin: APP_ORIGIN })).status).toBe(200);
  });

  it.each([
    ["another site", "https://evil.example"],
    ["a sibling subdomain", "https://other.recallfeed.example.test"],
    ["the same host on another scheme", "http://recallfeed.example.test"],
    ["the same host on another port", "https://recallfeed.example.test:8443"],
    ["a look-alike that begins with the origin", `${APP_ORIGIN}.evil.example`],
    ["a look-alike with the origin as a user name", `https://recallfeed.example.test@evil.example`],
    ["the literal string null (sandboxed or redirected requests)", "null"],
    ["garbage", "not a url"],
    ["an empty value", ""],
  ])("a cross-origin POST from %s is 403 CSRF_ORIGIN_MISMATCH", async (_label, origin) => {
    const response = await send("POST", { Origin: origin });

    expect(response.status).toBe(403);
    expect(await code(response)).toBe("CSRF_ORIGIN_MISMATCH");
  });

  it("a mutation with neither Origin nor Referer is 403 CSRF_ORIGIN_MISSING", async () => {
    const response = await send("POST");

    expect(response.status).toBe(403);
    expect(await code(response)).toBe("CSRF_ORIGIN_MISSING");
  });

  it("falls back to Referer when Origin is absent: same origin passes, any other origin fails", async () => {
    expect((await send("POST", { Referer: `${APP_ORIGIN}/some/page?x=1` })).status).toBe(200);
    expect((await send("POST", { Referer: "https://evil.example/page" })).status).toBe(403);
    expect((await send("POST", { Referer: "not a url" })).status).toBe(403);
    expect((await send("POST", { Referer: `${APP_ORIGIN}.evil.example/` })).status).toBe(403);
  });

  it("Origin wins over Referer: a bad Origin is refused even with a good Referer", async () => {
    const response = await send("POST", { Origin: "https://evil.example", Referer: `${APP_ORIGIN}/` });

    expect(response.status).toBe(403);
  });

  it.each(["GET", "HEAD", "OPTIONS"])("%s is never subject to the check", async (method) => {
    expect((await send(method, { Origin: "https://evil.example" })).status).toBe(200);
    expect((await send(method)).status).toBe(200);
  });
});

describe("csrfProtection in public mode", () => {
  it("does not apply: writes are authorized by an X-API-Key header, which no browser adds by itself", async () => {
    const send = build(publicEnv);

    expect((await send("POST", { Origin: "https://anywhere.example" })).status).toBe(200);
    expect((await send("POST")).status).toBe(200);
  });
});

describe("csrfProtection fails closed when visibility is unset or invalid", () => {
  it.each([undefined, "", "PUBLIC", "garbage"])("FEED_VISIBILITY %j is treated as private", async (visibility) => {
    const send = build({ DATABASE_URL: "unused", ...(visibility === undefined ? {} : { FEED_VISIBILITY: visibility }) });

    expect((await send("POST", { Origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("cacheControl", () => {
  it("private mode: every response, success or error, is `private, no-store`", async () => {
    const send = build(privateEnv);

    const ok = await send("GET");
    const refused = await send("POST", { Origin: "https://evil.example" });

    expect(ok.headers.get("Cache-Control")).toBe("private, no-store");
    expect(refused.status).toBe(403);
    expect(refused.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("public mode: mutations are no-store; reads set no cache policy of their own", async () => {
    const send = build(publicEnv);

    expect((await send("POST")).headers.get("Cache-Control")).toBe("no-store");
    expect((await send("GET")).headers.get("Cache-Control")).toBeNull();
  });
});

describe("requestId", () => {
  it("is a fresh random UUID per request, in the X-Request-Id header, and is never taken from the caller", async () => {
    const send = build(publicEnv);

    const a = await send("GET", { "X-Request-Id": "attacker-chosen-value" });
    const b = await send("GET");

    expect(a.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.headers.get("X-Request-Id")).not.toBe("attacker-chosen-value");
    expect(a.headers.get("X-Request-Id")).not.toBe(b.headers.get("X-Request-Id"));
  });
});
