import { getCloudflareContext } from "@opennextjs/cloudflare";
import { configureLocalNeonHttp, createDb } from "@recallfeed/database";
import { FeedEngine } from "@recallfeed/feed-engine";
import type { ReflectionFeedEnv } from "./env";

/** What server code needs for one request: the environment, the verified owner, and a feed engine. */
export type RequestFeed = { env: ReflectionFeedEnv; ownerEmail: string | undefined; engine: FeedEngine };

/**
 * The request's environment, the owner identity the Worker wrapper verified, and a request-scoped feed
 * engine. Server Components and Server Actions call this; they never make HTTP calls to the API.
 *
 * `configureLocalNeonHttp` matters only for local development. OpenNext bundles its own copy of the
 * database driver into the Next.js server code, so the copy configured by the local entry point is not
 * this one. For any host other than `db.localtest.me` the call does nothing.
 */
export async function requestFeed(): Promise<RequestFeed> {
  const { env, ctx } = await getCloudflareContext({ async: true });
  const workerEnv = env as unknown as ReflectionFeedEnv;
  const access = (ctx as { access?: { getIdentity: () => Promise<{ email?: string } | null> } }).access;
  const identity = await access?.getIdentity();
  configureLocalNeonHttp(workerEnv.DATABASE_URL);
  return { env: workerEnv, ownerEmail: identity?.email, engine: new FeedEngine(createDb(workerEnv.DATABASE_URL)) };
}
