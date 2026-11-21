import { describe, expect, it } from "vitest";
import { parseAllowedOrigins } from "../middleware/cors";
import { TEST_API_KEY, TEST_OWNER, accessContext, call, json, privateEnv, publicEnv } from "./helpers";

const APP = "https://reader.example.test";
const OTHER = "https://other.example.test";

/**
 * The routes under test (404 and 401 paths) need no database: a missing route and an unauthorized write
 * both answer before any query, so these tests run with or without TEST_DATABASE_URL.
 */
const ACAO = "Access-Control-Allow-Origin";

describe("parseAllowedOrigins", () => {
  it.each<[string, string | undefined, "any" | string[]]>([
    ["unset", undefined, []],
    ["blank", "  ", []],
    ["one origin", APP, [APP]],
    ["several, trimmed", ` ${APP} , ${OTHER} `, [APP, OTHER]],
    ["a wildcard anywhere wins", `${APP},*`, "any"],
    ["a trailing slash can never match, so it is dropped", `${APP}/`, []],
    ["a path can never match, so it is dropped", `${APP}/feed`, []],
    ["a missing scheme is dropped", "reader.example.test", []],
    ["garbage between good entries is dropped", `x,${APP},,%%`, [APP]],
  ])("%s", (_label, raw, expected) => {
    const parsed = parseAllowedOrigins(raw);

    expect(parsed === "any" ? "any" : [...parsed]).toEqual(expected);
  });
});

describe("publicReadCors: a browser app on another origin reading a public deployment", () => {
  const env = publicEnv({ CORS_ALLOWED_ORIGINS: APP });

  it("allows a listed origin to read, and says the answer depends on Origin", async () => {
    const response = await call("/no-such-route", { headers: { Origin: APP } }, env);

    expect(response.status).toBe(404);
    expect(response.headers.get(ACAO)).toBe(APP);
    expect(response.headers.get("Vary")).toContain("Origin");
  });

  it("an error body is readable by the listed origin too", async () => {
    const response = await call("/no-such-route", { headers: { Origin: APP } }, env);

    expect(response.headers.get(ACAO)).toBe(APP);
    expect((await json(response)).code).toBe("NOT_FOUND_ROUTE");
  });

  it("gives an unlisted origin nothing, and a request without an Origin nothing", async () => {
    const other = await call("/no-such-route", { headers: { Origin: OTHER } }, env);
    const none = await call("/no-such-route", {}, env);

    expect(other.headers.get(ACAO)).toBeNull();
    expect(none.headers.get(ACAO)).toBeNull();
  });

  it("never allows credentials", async () => {
    const response = await call("/no-such-route", { headers: { Origin: APP } }, env);

    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  it("is off when CORS_ALLOWED_ORIGINS is unset", async () => {
    const response = await call("/no-such-route", { headers: { Origin: APP } }, publicEnv());

    expect(response.headers.get(ACAO)).toBeNull();
    expect(response.headers.get("Vary")).toBeNull();
  });

  it("a wildcard answers every origin with *, and no Vary", async () => {
    const response = await call("/no-such-route", { headers: { Origin: OTHER } }, publicEnv({ CORS_ALLOWED_ORIGINS: "*" }));

    expect(response.headers.get(ACAO)).toBe("*");
  });

  it("never covers writes: a POST from a listed origin gets no CORS headers, even refused", async () => {
    const response = await call(
      "/import/markdown",
      { method: "POST", headers: { Origin: APP, "Content-Type": "application/json" }, body: "{}" },
      env,
    );

    expect(response.status).toBe(401);
    expect(response.headers.get(ACAO)).toBeNull();
  });

  it("never answers a preflight with permission, so the API key cannot be used from a browser", async () => {
    const response = await call(
      "/import/markdown",
      {
        method: "OPTIONS",
        headers: { Origin: APP, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-api-key" },
      },
      env,
    );

    expect(response.headers.get(ACAO)).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Headers")).toBeNull();
  });

  it("the API key is not accepted as a way to get CORS headers on a write", async () => {
    const response = await call(
      "/import/markdown",
      { method: "POST", headers: { Origin: APP, "X-API-Key": TEST_API_KEY, "Content-Type": "text/markdown" }, body: "" },
      env,
    );

    expect(response.headers.get(ACAO)).toBeNull();
  });
});

describe("publicReadCors: private deployments never send CORS headers", () => {
  it.each([APP, "*"])("with CORS_ALLOWED_ORIGINS=%s a private deployment sends nothing", async (setting) => {
    const response = await call(
      "/no-such-route",
      { headers: { Origin: APP } },
      privateEnv({ CORS_ALLOWED_ORIGINS: setting }),
      accessContext({ email: TEST_OWNER }),
    );

    expect(response.headers.get(ACAO)).toBeNull();
    expect(response.headers.get("Vary")).toBeNull();
  });

  it("an unset or unrecognized FEED_VISIBILITY is private, so it sends nothing either", async () => {
    for (const visibility of [undefined, "Public", "open"]) {
      const response = await call(
        "/no-such-route",
        { headers: { Origin: APP } },
        publicEnv({ FEED_VISIBILITY: visibility as string, CORS_ALLOWED_ORIGINS: "*" }),
      );

      expect(response.headers.get(ACAO)).toBeNull();
    }
  });
});
