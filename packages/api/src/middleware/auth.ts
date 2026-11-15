import type { Context, Next } from "hono";
import type { AccessExecutionContext, AppEnv } from "../types";
import { errorResponse } from "./errors";
import { secureEqual } from "./secure-compare";
import { getVisibilityMode } from "./visibility";

function accessOf(c: Context<AppEnv>): AccessExecutionContext["access"] {
  try {
    return (c.executionCtx as AccessExecutionContext).access;
  } catch {
    // Hono throws when no ExecutionContext was passed in. That is the same as no Access context.
    return undefined;
  }
}

/**
 * Private mode: allows the request only for the owner identified by Cloudflare Access.
 *
 * The identity comes from the trusted `ctx.access.getIdentity()` of the request's execution context.
 * Nothing in the request itself (a header, a cookie, a query parameter) can supply or fake it. If
 * the Access context or `OWNER_EMAIL` is missing, the request is refused with 500, never allowed.
 * 401 means no identity, 403 means an identity that is not the owner.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function requireOwner(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const owner = c.env.OWNER_EMAIL?.trim().toLowerCase();
  if (owner === undefined || owner === "") {
    return errorResponse(c, 500, "Owner authorization is not configured", "AUTH_NOT_CONFIGURED");
  }
  const access = accessOf(c);
  if (access === undefined) {
    return errorResponse(c, 500, "Owner authorization is not available", "AUTH_NOT_CONFIGURED");
  }
  let email: string | undefined;
  try {
    email = (await access.getIdentity())?.email;
  } catch {
    // If the identity system fails, deny. Never fall through to allow.
    return errorResponse(c, 401, "Authentication required", "AUTH_REQUIRED");
  }
  if (email === undefined || email.trim() === "") {
    return errorResponse(c, 401, "Authentication required", "AUTH_REQUIRED");
  }
  if (email.trim().toLowerCase() !== owner) {
    return errorResponse(c, 403, "Access denied", "AUTH_FORBIDDEN");
  }
  c.set("authenticatedEmail", email.trim());
  await next();
}

/**
 * Checks the `X-API-Key` header against `API_SECRET_KEY`.
 *
 * Unlike Spec 05's sketch, this never passes a request through because of the visibility mode: a
 * guard that silently allows in one mode is an open door if it is ever applied on its own. The
 * choice between owner and key lives in {@link requireWriteAccess}. A missing key is 401 and a
 * wrong key is 403, as Spec 05 specifies. The comparison is constant-time.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function requireApiKey(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const secret = c.env.API_SECRET_KEY;
  if (secret === undefined || secret === "") {
    return errorResponse(c, 500, "API key authentication is not configured", "AUTH_NOT_CONFIGURED");
  }
  const provided = c.req.header("X-API-Key");
  if (provided === undefined || provided === "") {
    return errorResponse(c, 401, "X-API-Key header required", "AUTH_API_KEY_MISSING");
  }
  if (!(await secureEqual(provided, secret))) {
    return errorResponse(c, 403, "Invalid API key", "AUTH_API_KEY_INVALID");
  }
  await next();
}

/**
 * Guards a write: the owner in private mode, the API key in public mode (Spec 05).
 *
 * The mode comes from `FEED_VISIBILITY`, which fails closed to private.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function requireWriteAccess(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  return getVisibilityMode(c.env) === "public" ? requireApiKey(c, next) : requireOwner(c, next);
}

/**
 * Guards a read: the owner in private mode, nobody in public mode (public reads are limited to
 * published content by the query, not by authentication).
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function requireReadAccess(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  if (getVisibilityMode(c.env) === "public") {
    await next();
    return;
  }
  return requireOwner(c, next);
}
