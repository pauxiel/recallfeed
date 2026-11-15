import { configureLocalNeonHttp } from "@recallfeed/database";
import { app } from "./app";
import type { Env } from "./types";

/**
 * LOCAL DEVELOPMENT ONLY. Used through `wrangler.local.toml`, never by a deployment.
 *
 * Production `src/index.ts` is the entry point for deployments and does none of this. Here, before
 * handling a request, the Neon driver is told that the exact host `db.localtest.me` is the local
 * proxy. That call does nothing for any other host, so a real Neon `DATABASE_URL` behaves normally.
 */
export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    configureLocalNeonHttp(env.DATABASE_URL);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
