import { app } from "./app";
import type { Env } from "./types";

/**
 * The Cloudflare Worker entry point.
 *
 * It does nothing but hand each request to the Hono application. The environment (`env`) and the
 * execution context (`ctx`, which carries `ctx.access` under Cloudflare Access) are passed through
 * untouched, because the authorization middleware reads identity from `ctx` and nowhere else.
 */
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export type { Env } from "./types";
