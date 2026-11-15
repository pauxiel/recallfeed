import { RecallFeedError } from "@recallfeed/core";
import { createDb } from "@recallfeed/database";
import type { DbClient } from "@recallfeed/database";
import type { Context } from "hono";
import type { AppEnv } from "./types";

/**
 * Returns this request's database client, creating it on first use.
 *
 * The client is built inside the request, never at module load, because Worker bindings are not
 * available in the global scope (Spec 02). It is not created for requests that never touch the
 * database, such as a rejected one.
 *
 * @param c - The Hono context.
 * @throws RecallFeedError `INTERNAL_CONFIG` if `DATABASE_URL` is not set. The caller sees a generic 500.
 */
export function getDb(c: Context<AppEnv>): DbClient {
  const existing = c.get("db");
  if (existing !== undefined) {
    return existing;
  }
  if (c.env.DATABASE_URL === undefined || c.env.DATABASE_URL === "") {
    throw new RecallFeedError("Database is not configured", "INTERNAL_CONFIG");
  }
  const db = createDb(c.env.DATABASE_URL);
  c.set("db", db);
  return db;
}
