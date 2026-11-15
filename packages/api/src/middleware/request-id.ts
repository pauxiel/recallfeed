import type { Context, Next } from "hono";
import type { AppEnv } from "../types";

/**
 * Gives each request a fresh random ID for logs and for the `X-Request-Id` response header.
 *
 * The ID is generated here, never taken from the request, so a caller cannot choose what appears in
 * the logs.
 *
 * @param c - The Hono context.
 * @param next - The next handler.
 */
export async function requestId(c: Context<AppEnv>, next: Next): Promise<void> {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  await next();
  c.header("X-Request-Id", id);
}
