import { authorizeAccessOwner } from "@recallfeed/api/access";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { CryptoKey, JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { dispatch, isApiPath } from "../dispatch";
import type { Authorize, FetchHandler } from "../dispatch";
import type { ReflectionFeedEnv } from "../env";

const OWNER = "owner@example.test";
const TEAM = "https://reflection-test.cloudflareaccess.com";
const AUD = "test-aud";
const ORIGIN = "https://app.example.test";
const ENV = { DATABASE_URL: "", FEED_VISIBILITY: "private", OWNER_EMAIL: OWNER, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as ReflectionFeedEnv;

let signingKey: CryptoKey;
let keys: JWTVerifyGetKey;
let authorize: Authorize;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signingKey = pair.privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k", alg: "RS256" }] });
  authorize = (request, env) => authorizeAccessOwner(request, env, keys);
});

function token(email: string): Promise<string> {
  return new SignJWT({ email }).setProtectedHeader({ alg: "RS256", kid: "k" }).setIssuer(TEAM).setAudience(AUD).setExpirationTime("10m").sign(signingKey);
}

type Seen = { url: string; method: string; body: string; email: string | undefined };

/** A stand-in handler that records what reached it, including the identity in ctx.access. */
function recorder(name: string): FetchHandler & { seen: Seen[] } {
  const seen: Seen[] = [];
  return {
    seen,
    async fetch(request, _env, ctx) {
      const identity = await (ctx as { access?: { getIdentity: () => Promise<{ email?: string } | null> } }).access?.getIdentity();
      seen.push({ url: request.url, method: request.method, body: await request.text(), email: identity?.email });
      return new Response(name);
    },
  };
}

const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined, props: {} } as unknown as ExecutionContext;

async function send(path: string, init: RequestInit & { as?: string } = {}): Promise<{ response: Response; api: Seen[]; next: Seen[] }> {
  const api = recorder("api");
  const next = recorder("next");
  const headers = new Headers(init.headers);
  if (init.as !== undefined) headers.set("Cf-Access-Jwt-Assertion", await token(init.as));
  const response = await dispatch(new Request(`${ORIGIN}${path}`, { ...init, headers }), ENV, ctx, { api, next }, authorize);
  return { response, api: api.seen, next: next.seen };
}

describe("the ReflectionFeed Worker wrapper", () => {
  it("refuses a request without an Access token with 401, and nothing else runs", async () => {
    const { response, api, next } = await send("/api/feed");
    const page = await send("/");

    expect([response.status, page.response.status]).toEqual([401, 401]);
    expect([...api, ...next, ...page.api, ...page.next]).toEqual([]);
  });

  it("refuses someone else's valid token with 403, and nothing else runs", async () => {
    const { response, api, next } = await send("/", { as: "someone@example.test" });

    expect(response.status).toBe(403);
    expect([...api, ...next]).toEqual([]);
  });

  it("refuses with a generic 500 when the Access settings are missing, even for the owner's token", async () => {
    const api = recorder("api");
    const next = recorder("next");
    const request = new Request(`${ORIGIN}/`, { headers: { "Cf-Access-Jwt-Assertion": await token(OWNER) } });

    const response = await dispatch(request, { ...ENV, ACCESS_AUD: "" }, ctx, { api, next }, authorize);

    expect(response.status).toBe(500);
    expect([...api.seen, ...next.seen]).toEqual([]);
  });

  it("sends the owner's /api requests to the shared API without the prefix, keeping query, method and body, with the verified identity", async () => {
    const { response, api, next } = await send("/api/import/markdown?name=notes", { as: OWNER, method: "POST", body: "# A note" });

    expect(await response.text()).toBe("api");
    expect(api).toEqual([{ url: `${ORIGIN}/import/markdown?name=notes`, method: "POST", body: "# A note", email: OWNER }]);
    expect(next).toEqual([]);
  });

  it("sends /api itself to the API root", async () => {
    const { api } = await send("/api", { as: OWNER });

    expect(api.map((s) => s.url)).toEqual([`${ORIGIN}/`]);
  });

  it("sends every other path to Next.js unchanged, with the verified identity", async () => {
    const { response, api, next } = await send("/apiary?x=1", { as: OWNER });

    expect(await response.text()).toBe("next");
    expect(next).toEqual([{ url: `${ORIGIN}/apiary?x=1`, method: "GET", body: "", email: OWNER }]);
    expect(api).toEqual([]);
  });

  it("ignores an identity a client tries to supply in a header", async () => {
    const { response, next } = await send("/", { headers: { "Cf-Access-Authenticated-User-Email": OWNER } });

    expect(response.status).toBe(401);
    expect(next).toEqual([]);
  });
});

describe("isApiPath", () => {
  it.each([
    ["/api", true],
    ["/api/", true],
    ["/api/feed", true],
    ["/apiary", false],
    ["/", false],
    ["/feed", false],
    ["/API/feed", false],
  ])("%s is %s", (path, expected) => {
    expect(isApiPath(path)).toBe(expected);
  });
});
