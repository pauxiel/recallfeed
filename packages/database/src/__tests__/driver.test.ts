import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createDb } from "../client";
import { configureLocalNeonProxy } from "../local-proxy";

const databaseUrl = env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === "")("Neon HTTP driver in the Workers runtime", () => {
  it("runs a query through createDb() over HTTP from workerd", async () => {
    expect(navigator.userAgent).toBe("Cloudflare-Workers");
    expect(configureLocalNeonProxy(databaseUrl)).toBe(true);

    const sql = createDb(databaseUrl);
    const rows = await sql`SELECT version() AS version, current_database() AS db`;
    console.log("driver-proof:", JSON.stringify(rows[0]));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.version).toMatch(/^PostgreSQL 17\./);
    expect(rows[0]?.db).toBe("recallfeed_test");
  });
});
