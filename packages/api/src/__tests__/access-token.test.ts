import { SignJWT, UnsecuredJWT, createLocalJWKSet, errors, exportJWK, generateKeyPair } from "jose";
import type { CryptoKey, JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { ACCESS_TOKEN_HEADER, MAX_ACCESS_TOKEN_LENGTH, authorizeAccessOwner, withAccessIdentity } from "../access-token";
import type { AccessTokenEnv } from "../access-token";
import { DATABASE_TEST_TIMEOUT_MS, TEST_OWNER, accessContext, call, databaseUrl, json, privateEnv } from "./helpers";

const TEAM = "https://recallfeed-test.cloudflareaccess.com";
const AUD = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const ENV: AccessTokenEnv = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, OWNER_EMAIL: TEST_OWNER };

let signingKey: CryptoKey;
let foreignKey: CryptoKey;
let keys: JWTVerifyGetKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  const foreign = await generateKeyPair("RS256");
  signingKey = pair.privateKey;
  foreignKey = foreign.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  keys = createLocalJWKSet({ keys: [{ ...jwk, kid: "current", alg: "RS256", use: "sig" }] });
});

type Claims = { email?: unknown; iss?: string; aud?: string | string[]; exp?: number | null; nbf?: number };

/** A token shaped like Access's, with any claim overridable. `exp: null` leaves it out. */
async function token(claims: Claims = {}, key: CryptoKey = signingKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const { iss = TEAM, aud = [AUD], exp = now + 600, nbf } = claims;
  // `email: undefined` must mean "no email claim", so it is not given a default here.
  const email = "email" in claims ? claims.email : TEST_OWNER;
  const jwt = new SignJWT(email === undefined ? { type: "app" } : { email, type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: "current" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt(now);
  if (exp !== null) jwt.setExpirationTime(exp);
  if (nbf !== undefined) jwt.setNotBefore(nbf);
  return jwt.sign(key);
}

function request(value?: string): Request {
  const headers = new Headers();
  if (value !== undefined) headers.set(ACCESS_TOKEN_HEADER, value);
  return new Request("https://app.example.test/feed", { headers });
}

async function refusal(result: Awaited<ReturnType<typeof authorizeAccessOwner>>): Promise<[number, unknown, string | null]> {
  if (result.ok) throw new Error("expected a refusal");
  return [result.response.status, await result.response.json(), result.response.headers.get("Cache-Control")];
}

describe("authorizeAccessOwner: verifying the Access token in the Worker", () => {
  it("accepts the owner's valid token and returns the verified email", async () => {
    const result = await authorizeAccessOwner(request(await token()), ENV, keys);

    expect(result).toEqual({ ok: true, identity: { email: TEST_OWNER } });
  });

  it("compares the owner email case-insensitively, as requireOwner does", async () => {
    const result = await authorizeAccessOwner(request(await token({ email: TEST_OWNER.toUpperCase() })), ENV, keys);

    expect(result.ok).toBe(true);
  });

  it("refuses a valid token for someone else with 403 AUTH_FORBIDDEN", async () => {
    const result = await authorizeAccessOwner(request(await token({ email: "someone@example.test" })), ENV, keys);

    expect(await refusal(result)).toEqual([403, { error: "Access denied", code: "AUTH_FORBIDDEN" }, "private, no-store"]);
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a header that is not a token", "not-a-jwt"],
    ["a header longer than the cap", "a".repeat(MAX_ACCESS_TOKEN_LENGTH + 1)],
  ])("refuses %s with 401 AUTH_REQUIRED", async (_label, value) => {
    const result = await authorizeAccessOwner(request(value), ENV, keys);

    expect(await refusal(result)).toEqual([401, { error: "Authentication required", code: "AUTH_REQUIRED" }, "private, no-store"]);
  });

  it.each<[string, () => Promise<string>]>([
    ["signed by another key", () => token({}, foreignKey)],
    ["from another issuer", () => token({ iss: "https://attacker.cloudflareaccess.com" })],
    ["for another application", () => token({ aud: ["another-application"] })],
    ["expired", () => token({ exp: Math.floor(Date.now() / 1000) - 60 })],
    ["not valid yet", () => token({ nbf: Math.floor(Date.now() / 1000) + 600 })],
    ["without an expiry", () => token({ exp: null })],
    ["without an email", () => token({ email: undefined })],
    ["with an email that is not a string", () => token({ email: ["owner@example.test"] })],
    ["with a blank email", () => token({ email: "  " })],
    ["unsigned (alg none)", async () => new UnsecuredJWT({ email: TEST_OWNER }).setIssuer(TEAM).setAudience(AUD).setExpirationTime("10m").encode()],
    ["signed with a shared secret (HS256)", async () =>
      new SignJWT({ email: TEST_OWNER }).setProtectedHeader({ alg: "HS256", kid: "current" }).setIssuer(TEAM).setAudience(AUD).setExpirationTime("10m").sign(new TextEncoder().encode("a-shared-secret-of-sufficient-length!"))],
  ])("refuses a token %s with 401 AUTH_REQUIRED", async (_label, make) => {
    const result = await authorizeAccessOwner(request(await make()), ENV, keys);

    expect(await refusal(result)).toEqual([401, { error: "Authentication required", code: "AUTH_REQUIRED" }, "private, no-store"]);
  });

  it("ignores spaces around OWNER_EMAIL", async () => {
    const result = await authorizeAccessOwner(request(await token()), { ...ENV, OWNER_EMAIL: `  ${TEST_OWNER}  ` }, keys);

    expect(result.ok).toBe(true);
  });

  it.each<[string, AccessTokenEnv]>([
    ["no team domain", { ...ENV, ACCESS_TEAM_DOMAIN: undefined }],
    ["a team domain with a trailing slash", { ...ENV, ACCESS_TEAM_DOMAIN: `${TEAM}/` }],
    ["a team domain over http", { ...ENV, ACCESS_TEAM_DOMAIN: TEAM.replace("https:", "http:") }],
    ["a team domain on another host", { ...ENV, ACCESS_TEAM_DOMAIN: "https://recallfeed-test.example.com" }],
    ["a team domain with a path", { ...ENV, ACCESS_TEAM_DOMAIN: `${TEAM}/cdn-cgi` }],
    ["no audience", { ...ENV, ACCESS_AUD: undefined }],
    ["a blank audience", { ...ENV, ACCESS_AUD: "  " }],
    ["no owner", { ...ENV, OWNER_EMAIL: undefined }],
  ])("fails closed with 500 AUTH_NOT_CONFIGURED for %s, even with a valid token", async (_label, env) => {
    const result = await authorizeAccessOwner(request(await token()), env, keys);

    expect(await refusal(result)).toEqual([500, { error: "Owner authorization is not configured", code: "AUTH_NOT_CONFIGURED" }, "private, no-store"]);
  });

  it.each<[string, JWTVerifyGetKey]>([
    ["time out", () => { throw new errors.JWKSTimeout(); }],
    ["return an unusable key set", () => { throw new errors.JWKSInvalid(); }],
    ["fail with a network error", () => { throw new TypeError("fetch failed"); }],
  ])("fails closed with 500 when the keys %s", async (_label, failing) => {
    const result = await authorizeAccessOwner(request(await token()), ENV, failing);

    expect(await refusal(result)).toEqual([500, { error: "Owner authorization is not available", code: "AUTH_NOT_CONFIGURED" }, "private, no-store"]);
  });

  it("refuses a token signed with a key of another algorithm, even when that key is in the key set", async () => {
    // Access signs with RS256 only. A key set that also held an ES256 key must still not accept ES256.
    const ec = await generateKeyPair("ES256", { extractable: true });
    const rsaJwk = await exportJWK((await generateKeyPair("RS256", { extractable: true })).publicKey);
    const mixed = createLocalJWKSet({ keys: [{ ...rsaJwk, kid: "rsa", alg: "RS256" }, { ...(await exportJWK(ec.publicKey)), kid: "ec" }] });
    const es256 = await new SignJWT({ email: TEST_OWNER })
      .setProtectedHeader({ alg: "ES256", kid: "ec" })
      .setIssuer(TEAM)
      .setAudience(AUD)
      .setExpirationTime("10m")
      .sign(ec.privateKey);

    const result = await authorizeAccessOwner(request(es256), ENV, mixed);

    expect(await refusal(result)).toEqual([401, { error: "Authentication required", code: "AUTH_REQUIRED" }, "private, no-store"]);
  });

  it("refuses a validly signed owner token longer than the cap before verifying it", async () => {
    const now = Math.floor(Date.now() / 1000);
    const oversized = await new SignJWT({ email: TEST_OWNER, padding: "x".repeat(MAX_ACCESS_TOKEN_LENGTH) })
      .setProtectedHeader({ alg: "RS256", kid: "current" })
      .setIssuer(TEAM)
      .setAudience(AUD)
      .setExpirationTime(now + 600)
      .sign(signingKey);

    const result = await authorizeAccessOwner(request(oversized), ENV, keys);

    expect(oversized.length).toBeGreaterThan(MAX_ACCESS_TOKEN_LENGTH);
    expect(await refusal(result)).toEqual([401, { error: "Authentication required", code: "AUTH_REQUIRED" }, "private, no-store"]);
  });

  it("never echoes the token in a refusal", async () => {
    const forged = await token({}, foreignKey);
    const result = await authorizeAccessOwner(request(forged), ENV, keys);

    if (result.ok) throw new Error("expected a refusal");
    expect(await result.response.text()).not.toContain(forged.slice(0, 40));
  });
});

describe("withAccessIdentity: handing the verified identity on", () => {
  it("reports the verified identity through access.getIdentity()", async () => {
    const ctx = withAccessIdentity(accessContext("absent"), { email: TEST_OWNER });

    expect("access" in ctx).toBe(true);
    expect(await ctx.access?.getIdentity()).toEqual({ email: TEST_OWNER });
  });

  it("replaces an access context already present, and a caller cannot change the identity it returns", async () => {
    const ctx = withAccessIdentity(accessContext({ email: "someone@example.test" }), { email: TEST_OWNER });
    const first = await ctx.access?.getIdentity();
    if (first) first.email = "changed@example.test";

    expect(await ctx.access?.getIdentity()).toEqual({ email: TEST_OWNER });
  });

  it("keeps every other property and calls the original methods on the original context", () => {
    const calls: unknown[] = [];
    const original = {
      props: { a: 1 },
      waitUntil(this: unknown, promise: Promise<unknown>) {
        calls.push([this, promise]);
      },
      passThroughOnException: () => undefined,
    } as unknown as ExecutionContext;
    const ctx = withAccessIdentity(original, { email: TEST_OWNER });
    const pending = Promise.resolve();

    ctx.waitUntil(pending);

    expect(ctx.props).toEqual({ a: 1 });
    expect(calls).toHaveLength(1);
    // Identity, not structural equality: the proxy would compare equal to the original.
    expect((calls[0] as unknown[])[0]).toBe(original);
    expect((calls[0] as unknown[])[1]).toBe(pending);
  });
});

describe.skipIf(databaseUrl === "")("the shared API accepts the handed-on identity (real PostgreSQL through the proxy)", { timeout: DATABASE_TEST_TIMEOUT_MS }, () => {
  it("a private GET /feed with a verified owner is served; the same request without it is refused", async () => {
    const verified = await authorizeAccessOwner(request(await token()), ENV, keys);
    if (!verified.ok) throw new Error("expected the owner to be verified");

    const served = await call("/feed?limit=1", {}, privateEnv(), withAccessIdentity(accessContext("absent"), verified.identity));
    const refused = await call("/feed?limit=1", {}, privateEnv(), accessContext("absent"));

    expect(served.status).toBe(200);
    expect(Object.keys(await json(served)).sort()).toEqual(["items", "nextCursor"]);
    expect(refused.status).toBe(500);
    expect((await json(refused)).code).toBe("AUTH_NOT_CONFIGURED");
  });
});
