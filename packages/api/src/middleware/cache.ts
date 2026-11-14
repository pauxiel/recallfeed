import type { Context, Next } from "hono";
import type { AppEnv } from "../types";
import { getVisibilityMode } from "./visibility";

/**
 * Sets cache headers on every response, including errors and 404s (Spec 05).
 *
 * Private mode: `Cache-Control: private, no-store`, so no shared cache and no browser cache keeps
 * the owner's data. Public mode: only mutation responses get `no-store`; published reads set no
 * cache policy of their own because Spec 05 defines none.
 *
 * It must be registered before the other middleware so that their early error responses get the
 * header too.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function cacheControl(c: Context<AppEnv>, next: Next): Promise<void> {
  await next();
  if (getVisibilityMode(c.env) === "private") {
    c.header("Cache-Control", "private, no-store");
  } else if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    c.header("Cache-Control", "no-store");
  }
}
