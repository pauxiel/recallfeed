import type { Context, Next } from "hono";
import type { AppEnv } from "../types";
import { errorResponse } from "./errors";
import { getVisibilityMode } from "./visibility";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(candidate: string, own: string): boolean {
  try {
    return new URL(candidate).origin === own;
  } catch {
    return false;
  }
}

/**
 * Rejects cross-origin mutations in private mode (Spec 05 security criteria).
 *
 * In private mode the browser's Cloudflare Access cookie is an ambient credential, which is what
 * makes a forged cross-site request dangerous. Browsers always send `Origin` on a cross-site
 * POST or PUT, so a mutating request must carry an `Origin`, or failing that a `Referer`, whose
 * origin equals this application's own. A missing header, the literal `null` origin, an unparseable
 * `Referer`, and any other origin are all refused with 403. Reads are never affected.
 *
 * Public mode authenticates writes with an `X-API-Key` header, which a browser does not send on its
 * own, so there is no ambient credential to protect and this check does not apply.
 *
 * Non-browser clients of a private deployment must send an `Origin` equal to the application's
 * origin. That is a documented requirement, not an oversight.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function csrfProtection(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  if (getVisibilityMode(c.env) !== "private" || SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const own = new URL(c.req.url).origin;
  const origin = c.req.header("Origin");
  const referer = c.req.header("Referer");
  if (origin !== undefined) {
    if (origin === own) {
      await next();
      return;
    }
    return errorResponse(c, 403, "Cross-origin request rejected", "CSRF_ORIGIN_MISMATCH");
  }
  if (referer !== undefined) {
    if (sameOrigin(referer, own)) {
      await next();
      return;
    }
    return errorResponse(c, 403, "Cross-origin request rejected", "CSRF_ORIGIN_MISMATCH");
  }
  return errorResponse(c, 403, "Origin header required", "CSRF_ORIGIN_MISSING");
}
