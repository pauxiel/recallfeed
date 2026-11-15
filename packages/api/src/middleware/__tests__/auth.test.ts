import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv, Env } from "../../types";
import { requireApiKey, requireOwner, requireReadAccess, requireWriteAccess } from "../auth";
import { handleError } from "../errors";
import { secureEqual } from "../secure-compare";
import { APP_ORIGIN, TEST_API_KEY, TEST_OWNER, accessContext } from "../../__tests__/helpers";

// These tests need no database: the guards run before any handler, and the handler here is a stub.
function guarded(guard: typeof requireOwner, environment: Env) {
  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.use("*", async (c, next) => {
    c.set("requestId", "test");
    await next();
  });
  app.get("/probe", guard, (c) => c.json({ reached: true }));
  return (headers: Record<string, string> = {}, ctx = accessContext({ email: TEST_OWNER })) =>
    Promise.resolve(app.fetch(new Request(`${APP_ORIGIN}/probe`, { headers }), environment, ctx));
}

const privateEnv = (overrides: Partial<Env> = {}): Env => ({
  DATABASE_URL: "unused",
  FEED_VISIBILITY: "private",
  OWNER_EMAIL: TEST_OWNER,
  ...overrides,
});
const publicEnv = (overrides: Partial<Env> = {}): Env => ({
  DATABASE_URL: "unused",
  FEED_VISIBILITY: "public",
  API_SECRET_KEY: TEST_API_KEY,
  ...overrides,
});

async function body(response: Response) {
  return (await response.json()) as { error?: string; code?: string; reached?: boolean };
}

describe("requireOwner (private mode)", () => {
  it("lets the owner through", async () => {
    const response = await guarded(requireOwner, privateEnv())();

    expect(response.status).toBe(200);
    expect((await body(response)).reached).toBe(true);
  });

  it("accepts the owner regardless of letter case or surrounding spaces", async () => {
    const send = guarded(requireOwner, privateEnv());

    expect((await send({}, accessContext({ email: "  OWNER@Example.TEST " }))).status).toBe(200);
  });

  it("no identity: 401 AUTH_REQUIRED, and the handler never runs", async () => {
    const response = await guarded(requireOwner, privateEnv())({}, accessContext(null));

    expect(response.status).toBe(401);
    expect(await body(response)).toEqual({ error: "Authentication required", code: "AUTH_REQUIRED" });
  });

  it.each([{}, { email: "" }, { email: "   " }])("an identity without a usable email %j: 401", async (identity) => {
    const response = await guarded(requireOwner, privateEnv())({}, accessContext(identity));

    expect(response.status).toBe(401);
  });

  it("a different authenticated identity: 403 AUTH_FORBIDDEN", async () => {
    const response = await guarded(requireOwner, privateEnv())({}, accessContext({ email: "someone@else.test" }));

    expect(response.status).toBe(403);
    expect((await body(response)).code).toBe("AUTH_FORBIDDEN");
  });

  it("an email that merely contains the owner's is not the owner", async () => {
    const send = guarded(requireOwner, privateEnv());

    expect((await send({}, accessContext({ email: `x${TEST_OWNER}` }))).status).toBe(403);
    expect((await send({}, accessContext({ email: `${TEST_OWNER}.evil.test` }))).status).toBe(403);
    expect((await send({}, accessContext({ email: `${TEST_OWNER},other@x.test` }))).status).toBe(403);
  });

  it("fails closed when the identity system throws: 401, never allow", async () => {
    const response = await guarded(requireOwner, privateEnv())({}, accessContext("throws"));

    expect(response.status).toBe(401);
  });

  it("fails closed with 500 when the Worker has no Access context", async () => {
    const response = await guarded(requireOwner, privateEnv())({}, accessContext("absent"));

    expect(response.status).toBe(500);
    expect((await body(response)).code).toBe("AUTH_NOT_CONFIGURED");
  });

  it.each([undefined, "", "   "])("fails closed with 500 when OWNER_EMAIL is %j", async (ownerEmail) => {
    const environment = privateEnv(ownerEmail === undefined ? { OWNER_EMAIL: undefined } : { OWNER_EMAIL: ownerEmail });
    const response = await guarded(requireOwner, environment)();

    expect(response.status).toBe(500);
    expect((await body(response)).code).toBe("AUTH_NOT_CONFIGURED");
  });

  it("an X-API-Key, a spoofed identity header, or a claimed email never substitutes for identity", async () => {
    const response = await guarded(requireOwner, privateEnv())(
      {
        "X-API-Key": TEST_API_KEY,
        "Cf-Access-Authenticated-User-Email": TEST_OWNER,
        "X-Authenticated-Email": TEST_OWNER,
        Authorization: `Bearer ${TEST_OWNER}`,
        Cookie: `email=${TEST_OWNER}`,
      },
      accessContext(null),
    );

    expect(response.status).toBe(401);
  });
});

describe("requireApiKey", () => {
  it("accepts the right key", async () => {
    const response = await guarded(requireApiKey, publicEnv())({ "X-API-Key": TEST_API_KEY });

    expect(response.status).toBe(200);
  });

  it("missing key: 401 AUTH_API_KEY_MISSING", async () => {
    const response = await guarded(requireApiKey, publicEnv())();

    expect(response.status).toBe(401);
    expect((await body(response)).code).toBe("AUTH_API_KEY_MISSING");
  });

  it("empty key: 401", async () => {
    expect((await guarded(requireApiKey, publicEnv())({ "X-API-Key": "" })).status).toBe(401);
  });

  it.each(["wrong", `${TEST_API_KEY}x`, TEST_API_KEY.slice(0, -1), TEST_API_KEY.toUpperCase(), `${TEST_API_KEY.slice(0, 5)} ${TEST_API_KEY.slice(5)}`])(
    "wrong key %j: 403 AUTH_API_KEY_INVALID (Spec 05)",
    async (key) => {
      const response = await guarded(requireApiKey, publicEnv())({ "X-API-Key": key });

      expect(response.status).toBe(403);
      expect((await body(response)).code).toBe("AUTH_API_KEY_INVALID");
    },
  );

  it.each([undefined, ""])("fails closed with 500 when API_SECRET_KEY is %j, even if the caller sends nothing or empty", async (secret) => {
    const environment = publicEnv(secret === undefined ? { API_SECRET_KEY: undefined } : { API_SECRET_KEY: secret });

    expect((await guarded(requireApiKey, environment)({ "X-API-Key": "" })).status).toBe(500);
    expect((await guarded(requireApiKey, environment)({ "X-API-Key": "anything" })).status).toBe(500);
  });

  it("is enforced in private mode too: no pass-through because of the visibility setting", async () => {
    const environment = privateEnv({ API_SECRET_KEY: TEST_API_KEY });

    expect((await guarded(requireApiKey, environment)()).status).toBe(401);
    expect((await guarded(requireApiKey, environment)({ "X-API-Key": TEST_API_KEY })).status).toBe(200);
  });

  it("the platform strips whitespace around a header value, so a padded copy of the right key is the right key", async () => {
    // Per the Fetch standard, Headers removes leading and trailing whitespace. The guard therefore
    // never sees the padding. This pins that behavior so a change in the runtime would be noticed.
    expect(new Headers({ "X-API-Key": `  ${TEST_API_KEY}  ` }).get("X-API-Key")).toBe(TEST_API_KEY);
    expect((await guarded(requireApiKey, publicEnv())({ "X-API-Key": `  ${TEST_API_KEY}  ` })).status).toBe(200);
  });

  it("never echoes the key or the expected secret in an error", async () => {
    const response = await guarded(requireApiKey, publicEnv())({ "X-API-Key": "super-secret-attempt-123" });
    const text = JSON.stringify(await body(response));

    expect(text).not.toContain("super-secret-attempt-123");
    expect(text).not.toContain(TEST_API_KEY);
  });
});

describe("requireWriteAccess chooses by deployment mode", () => {
  it("private: the owner is required, and an API key alone is refused", async () => {
    const send = guarded(requireWriteAccess, privateEnv({ API_SECRET_KEY: TEST_API_KEY }));

    expect((await send({}, accessContext({ email: TEST_OWNER }))).status).toBe(200);
    expect((await send({ "X-API-Key": TEST_API_KEY }, accessContext(null))).status).toBe(401);
  });

  it("public: the API key is required, and an owner identity alone is refused", async () => {
    const send = guarded(requireWriteAccess, publicEnv({ OWNER_EMAIL: TEST_OWNER }));

    expect((await send({ "X-API-Key": TEST_API_KEY })).status).toBe(200);
    expect((await send({}, accessContext({ email: TEST_OWNER }))).status).toBe(401);
  });

  it.each([undefined, "", "Public", "PUBLIC", "publi", "true", "1", " public", "public "])(
    "FEED_VISIBILITY %j is private (fails closed)",
    async (visibility) => {
      const environment = privateEnv(visibility === undefined ? { FEED_VISIBILITY: undefined } : { FEED_VISIBILITY: visibility });
      const response = await guarded(requireWriteAccess, environment)({ "X-API-Key": TEST_API_KEY }, accessContext(null));

      expect(response.status).toBe(401);
      expect((await body(response)).code).toBe("AUTH_REQUIRED");
    },
  );
});

describe("requireReadAccess", () => {
  it("public: anonymous reads are allowed", async () => {
    expect((await guarded(requireReadAccess, publicEnv())({}, accessContext(null))).status).toBe(200);
  });

  it("private: reads need the owner, and a stranger gets 401 or 403", async () => {
    const send = guarded(requireReadAccess, privateEnv());

    expect((await send({}, accessContext(null))).status).toBe(401);
    expect((await send({}, accessContext({ email: "x@y.test" }))).status).toBe(403);
    expect((await send({}, accessContext({ email: TEST_OWNER }))).status).toBe(200);
  });
});

describe("secureEqual", () => {
  it("is true only for identical strings, including different lengths and empty values", async () => {
    expect(await secureEqual("abc", "abc")).toBe(true);
    expect(await secureEqual("abc", "abd")).toBe(false);
    expect(await secureEqual("abc", "abcd")).toBe(false);
    expect(await secureEqual("", "")).toBe(true);
    expect(await secureEqual("", "x")).toBe(false);
    expect(await secureEqual("é", "é")).toBe(true);
  });
});
