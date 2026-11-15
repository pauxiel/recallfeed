import type { Context, Next } from "hono";
import type { AppEnv, Visibility } from "../types";

/**
 * Reads the deployment's visibility (Spec 05).
 *
 * Fails closed: only the exact string `"public"` makes the deployment public. Unset, empty,
 * misspelled, or differently cased values all mean private.
 *
 * @param env - The Worker environment, or just its `FEED_VISIBILITY` value.
 * @returns `"public"` or `"private"`.
 */
export function getVisibilityMode(env: { FEED_VISIBILITY?: string | undefined }): Visibility {
  return env.FEED_VISIBILITY === "public" ? "public" : "private";
}

/**
 * Records on the context whether reads must be limited to published content.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function injectPublicRequestFlag(c: Context<AppEnv>, next: Next): Promise<void> {
  c.set("isPublicRequest", getVisibilityMode(c.env) === "public");
  await next();
}
