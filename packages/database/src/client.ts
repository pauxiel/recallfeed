import { neon } from "@neondatabase/serverless";

/** The Worker environment bindings this package reads. */
export type DatabaseEnv = {
  /** Neon PostgreSQL connection string. A Wrangler secret; never logged or committed. */
  DATABASE_URL: string;
};

/**
 * Creates a request-scoped Neon SQL client that sends each query over HTTP.
 *
 * Call this inside a route handler or workflow function with `env.DATABASE_URL`.
 * Never call it at module initialization: Worker bindings are not available in the
 * global scope for I/O. There is no pooling, retry wrapper, or transaction helper
 * in the MVP (Spec 02).
 *
 * @param databaseUrl - A PostgreSQL connection string, normally `env.DATABASE_URL`.
 * @returns A tagged-template SQL function. Use `sql.query(text, params)` for
 * parameterized queries built from strings.
 */
export function createDb(databaseUrl: string) {
  return neon(databaseUrl);
}

/** The SQL client type returned by {@link createDb}. */
export type DbClient = ReturnType<typeof createDb>;
