import type { Context, Next } from "hono";
import type { AppEnv } from "../types";
import { getVisibilityMode } from "./visibility";

/** Methods whose responses may be shared with another origin. Writes never are. */
const READ_METHODS = new Set(["GET", "HEAD"]);

/**
 * Reads `CORS_ALLOWED_ORIGINS`: a comma-separated list of exact origins such as
 * `https://my-app.pages.dev`, or `*` for any origin.
 *
 * Unset or blank means no origin. Entries are trimmed. An entry that is not a bare origin (a path, a
 * trailing slash, a missing scheme) can never match a browser's `Origin` header, so it is ignored
 * rather than guessed at.
 *
 * @param raw - The setting.
 * @returns `"any"`, or the set of allowed origins (possibly empty).
 */
export function parseAllowedOrigins(raw: string | undefined): "any" | Set<string> {
  const origins = new Set<string>();
  for (const entry of (raw ?? "").split(",")) {
    const value = entry.trim();
    if (value === "*") {
      return "any";
    }
    try {
      if (value !== "" && new URL(value).origin === value) {
        origins.add(value);
      }
    } catch {
      // Not a URL: ignored.
    }
  }
  return origins;
}

/**
 * Lets a browser app on another origin read a **public** deployment (opt-in).
 *
 * It does nothing unless `FEED_VISIBILITY` is `public` and `CORS_ALLOWED_ORIGINS` lists the request's
 * origin (or `*`), and then only for `GET` and `HEAD`. It never sends `Access-Control-Allow-Credentials`
 * and never answers a preflight: a browser sends a preflight only for requests with custom headers such
 * as `X-API-Key`, and the API key must never be used from a browser. Private deployments never get
 * these headers, whatever the setting says, because their reads are guarded by an ambient cookie.
 *
 * It must be registered before the other middleware so that error and 404 responses carry the headers
 * too, which lets the app read the error body.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function publicReadCors(c: Context<AppEnv>, next: Next): Promise<void> {
  await next();
  if (getVisibilityMode(c.env) !== "public" || !READ_METHODS.has(c.req.method)) {
    return;
  }
  const allowed = parseAllowedOrigins(c.env.CORS_ALLOWED_ORIGINS);
  if (allowed === "any") {
    c.header("Access-Control-Allow-Origin", "*");
    return;
  }
  if (allowed.size === 0) {
    return;
  }
  // The answer depends on the request's Origin, so a shared cache must key on it.
  c.header("Vary", "Origin", { append: true });
  const origin = c.req.header("Origin");
  if (origin !== undefined && allowed.has(origin)) {
    c.header("Access-Control-Allow-Origin", origin);
  }
}
