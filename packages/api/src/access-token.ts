import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";
import type { ErrorBody } from "./middleware/errors";
import type { AccessExecutionContext, AccessIdentity } from "./types";

/**
 * Cloudflare Access identity for Workers that do not receive `ctx.access`.
 *
 * Cloudflare documents that a Worker with Static Assets runs behind an internal router Worker that does
 * not pass `ctx.access` on, although Access still protects the application. Such a Worker verifies the
 * signed `Cf-Access-Jwt-Assertion` header that Access adds to every request it lets through, then hands
 * the shared API an execution context whose `access.getIdentity()` returns the verified identity (see
 * {@link withAccessIdentity}). The API's own authorization keeps reading identity from `ctx.access` only.
 *
 * Nothing here is specific to one application. It fails closed: missing configuration is a 500, and a
 * missing, malformed, expired or foreign token is a 401. Tokens are never logged.
 */

/** A team domain exactly as Access issues tokens for it: `https://<team-name>.cloudflareaccess.com`. */
const TEAM_DOMAIN_PATTERN = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;

/** Longer than any Access token; a cap so an oversized header is refused before any parsing. */
export const MAX_ACCESS_TOKEN_LENGTH = 8192;

/** The header Access sets on every request it authenticates. */
export const ACCESS_TOKEN_HEADER = "Cf-Access-Jwt-Assertion";

/** The settings the check reads, all from the Worker environment. */
export type AccessTokenEnv = {
  /** `https://<team-name>.cloudflareaccess.com`. It is both the token issuer and where the public keys live. */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's AUD tag. A token for any other application is refused. */
  ACCESS_AUD?: string;
  /** The one email allowed in. */
  OWNER_EMAIL?: string;
};

/** The outcome of {@link authorizeAccessOwner}: the verified owner, or the response to send instead. */
export type AccessOwnerResult = { ok: true; identity: { email: string } } | { ok: false; response: Response };

const keySets = new Map<string, JWTVerifyGetKey>();

/**
 * The team's public signing keys, fetched from `<teamDomain>/cdn-cgi/access/certs` and cached by `jose`
 * for the life of the isolate. They are fetched, not hard-coded, because Access rotates them.
 *
 * @param teamDomain - A validated team domain.
 * @returns A key resolver for `jwtVerify`.
 */
function teamKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = keySets.get(teamDomain);
  if (keys === undefined) {
    keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keys);
  }
  return keys;
}

function refuse(status: 401 | 403 | 500, error: string, code: string): AccessOwnerResult {
  const body: ErrorBody = { error, code };
  return {
    ok: false,
    response: new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    }),
  };
}

/**
 * True when a verification failure is about the token, as opposed to our ability to check it (the key
 * endpoint timing out or returning something unusable). Both are refused; only the status differs.
 */
function isTokenFault(error: unknown): boolean {
  if (!(error instanceof errors.JOSEError)) return false;
  return !(error instanceof errors.JWKSTimeout || error instanceof errors.JWKSInvalid);
}

/**
 * Verifies the request's Access token and checks that it belongs to the owner.
 *
 * The token must be RS256, signed by one of the team's current keys, issued by `ACCESS_TEAM_DOMAIN`, for
 * `ACCESS_AUD`, carry an `exp` in the future and no `nbf` in the future, and name an email. The email is
 * compared case-insensitively with `OWNER_EMAIL`, as the API's `requireOwner` does.
 *
 * @param request - The incoming request.
 * @param env - The Worker environment.
 * @param keys - Overrides the team's published keys. For tests only.
 * @returns The verified owner, or a JSON error response: 500 `AUTH_NOT_CONFIGURED` for missing or
 *   malformed settings or when the keys cannot be fetched, 401 `AUTH_REQUIRED` for no valid token, and
 *   403 `AUTH_FORBIDDEN` for a valid token of someone else.
 */
export async function authorizeAccessOwner(
  request: Request,
  env: AccessTokenEnv,
  keys?: JWTVerifyGetKey,
): Promise<AccessOwnerResult> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim() ?? "";
  const audience = env.ACCESS_AUD?.trim() ?? "";
  const owner = env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  if (!TEAM_DOMAIN_PATTERN.test(teamDomain) || audience === "" || owner === "") {
    return refuse(500, "Owner authorization is not configured", "AUTH_NOT_CONFIGURED");
  }

  const token = request.headers.get(ACCESS_TOKEN_HEADER) ?? "";
  if (token === "" || token.length > MAX_ACCESS_TOKEN_LENGTH) {
    return refuse(401, "Authentication required", "AUTH_REQUIRED");
  }

  let email: unknown;
  try {
    const { payload } = await jwtVerify(token, keys ?? teamKeys(teamDomain), {
      issuer: teamDomain,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp"],
    });
    email = payload.email;
  } catch (error) {
    if (isTokenFault(error)) {
      return refuse(401, "Authentication required", "AUTH_REQUIRED");
    }
    console.error(JSON.stringify({ error: error instanceof Error ? error.name : "unknown", source: "api", operation: "verify Access token" }));
    return refuse(500, "Owner authorization is not available", "AUTH_NOT_CONFIGURED");
  }

  if (typeof email !== "string" || email.trim() === "") {
    return refuse(401, "Authentication required", "AUTH_REQUIRED");
  }
  if (email.trim().toLowerCase() !== owner) {
    return refuse(403, "Access denied", "AUTH_FORBIDDEN");
  }
  return { ok: true, identity: { email: email.trim() } };
}

/**
 * Returns an execution context that behaves like `ctx` but carries `access.getIdentity()` for an identity
 * this Worker has already verified. Every other property and method is the original's, bound to it.
 *
 * Call it only with the result of {@link authorizeAccessOwner}. It is how the shared API and the
 * frontend read the same verified identity the way they would read Cloudflare's own `ctx.access`.
 *
 * @param ctx - The Worker's execution context.
 * @param identity - The verified identity.
 * @returns The context to dispatch with.
 */
export function withAccessIdentity(ctx: ExecutionContext, identity: AccessIdentity): AccessExecutionContext {
  const access = { getIdentity: async (): Promise<AccessIdentity> => ({ ...identity }) };
  return new Proxy(ctx, {
    get(target, property) {
      if (property === "access") return access;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    has(target, property) {
      return property === "access" || Reflect.has(target, property);
    },
  }) as AccessExecutionContext;
}
