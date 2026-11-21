import { authorizeAccessOwner, withAccessIdentity } from "@recallfeed/api/access";
import type { AccessOwnerResult } from "@recallfeed/api/access";
import type { ReflectionFeedEnv } from "./env";

/** Anything with a Worker-style `fetch`: the shared Hono app, or OpenNext's generated handler. */
export type FetchHandler = {
  fetch(request: Request, env: ReflectionFeedEnv, ctx: ExecutionContext): Response | Promise<Response>;
};

/** Where a verified request can go. */
export type DispatchTargets = { api: FetchHandler; next: FetchHandler };

/** Verifies who is asking. Production uses {@link authorizeAccessOwner}; tests may pass their keys. */
export type Authorize = (request: Request, env: ReflectionFeedEnv) => Promise<AccessOwnerResult>;

/** `/api/feed` reaches the shared API as `/feed`. */
export const API_PREFIX = "/api";

/** True for `/api` and paths under it, but not for look-alikes such as `/apiary`. */
export function isApiPath(pathname: string): boolean {
  return pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`);
}

/**
 * Handles one request for the production Worker.
 *
 * The Access token is verified first and must belong to `OWNER_EMAIL`. Nothing else runs for a refused
 * request. The verified identity is then handed on as `ctx.access`. `/api` paths go to the shared API
 * with the prefix removed and the query string, method, headers and body kept; every other path goes
 * to Next.js unchanged.
 *
 * @param request - The incoming request.
 * @param env - The Worker environment.
 * @param ctx - The Worker execution context.
 * @param targets - The shared API and the Next.js handler.
 * @param authorize - The owner check.
 * @returns The response.
 */
export async function dispatch(
  request: Request,
  env: ReflectionFeedEnv,
  ctx: ExecutionContext,
  targets: DispatchTargets,
  authorize: Authorize = authorizeAccessOwner,
): Promise<Response> {
  const verified = await authorize(request, env);
  if (!verified.ok) {
    return verified.response;
  }
  const ownerCtx = withAccessIdentity(ctx, verified.identity);

  const url = new URL(request.url);
  if (isApiPath(url.pathname)) {
    url.pathname = url.pathname.slice(API_PREFIX.length) || "/";
    return targets.api.fetch(new Request(url, request), env, ownerCtx);
  }
  return targets.next.fetch(request, env, ownerCtx);
}
