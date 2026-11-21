import type { DbClient } from "@recallfeed/database";

/**
 * The Worker environment. Behavior differs between deployments through these values only; no
 * application-specific code lives in this package.
 */
export type Env = {
  /** Neon PostgreSQL connection string. A Wrangler secret; never logged. */
  DATABASE_URL: string;
  /** `"public"` or `"private"`. Anything else, including unset, means private (fail closed). */
  FEED_VISIBILITY?: string;
  /** Private mode: the one email allowed to use the API. Required in private mode. */
  OWNER_EMAIL?: string;
  /** Public mode: the key writes must present in `X-API-Key`. Required for writes in public mode. */
  API_SECRET_KEY?: string;
  /**
   * How many hours a `snoozed` review action hides a card. A whole number from 1 to 8760; unset means
   * 24 (Spec 04). A set but unusable value makes the review endpoint fail with a generic 500.
   */
  SNOOZE_DEFAULT_HOURS?: string;
  /**
   * The order `GET /feed` uses: `recency` (unset means this) or `importance`. Any other value makes
   * `GET /feed` fail with a generic 500.
   */
  DEFAULT_RESURFACING_STRATEGY?: string;
  /**
   * The card types an import creates, comma-separated, such as `original,highlight`. Unset means
   * `original` only, and `original` is always created. Types without a generator yet are skipped. An
   * unknown name makes the import fail with a generic 500.
   */
  DEFAULT_CARD_TYPES?: string;
};

/** Visibility of the deployment. */
export type Visibility = "private" | "public";

/** Cloudflare Access identity, as `ctx.access.getIdentity()` returns it. */
export type AccessIdentity = {
  email?: string;
};

/** The execution context a Worker with Cloudflare Access receives. */
export type AccessExecutionContext = ExecutionContext & {
  access?: { getIdentity: () => Promise<AccessIdentity | null> };
};

/** Values middleware attaches to the Hono context. */
export type Variables = {
  /** True when the deployment is public, so reads must be limited to published content. */
  isPublicRequest: boolean;
  /** The verified owner's email in private mode. */
  authenticatedEmail?: string;
  /** Identifies a request in logs. */
  requestId: string;
  /** A request-scoped database client, created on first use by `getDb`. */
  db?: DbClient;
};

/** The Hono environment type for this application. */
export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
