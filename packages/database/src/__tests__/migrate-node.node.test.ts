import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, neonConfig } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";
import { configureLocalNeonWebSocket } from "../local-proxy";
import { MIGRATIONS_DIR, migrateDatabase, readMigrationFiles } from "../migrate-node";

const databaseUrl = process.env.TEST_DATABASE_URL ?? "";

describe("regression R2: failure paths leave no process-wide TLS relaxation", () => {
  it("a local client whose socket constructor throws rejects, and later clients keep TLS on", async () => {
    class FailingSocket {
      constructor() {
        throw new Error("simulated socket failure");
      }
    }
    const local = new Client("postgres://u:p@db.localtest.me:5432/recallfeed_test");
    local.neonConfig.webSocketConstructor = FailingSocket as unknown as typeof WebSocket;
    expect(configureLocalNeonWebSocket(local)).toBe(true);
    await expect(local.connect()).rejects.toThrow(/All attempts to open a WebSocket/);

    expect(neonConfig.useSecureWebSocket).toBe(true);
    const remote = new Client("postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed");
    expect(configureLocalNeonWebSocket(remote)).toBe(false);
    expect(remote.neonConfig.useSecureWebSocket).toBe(true);
  });
});

describe("readMigrationFiles", () => {
  it("reads the default migrations directory", async () => {
    const files = await readMigrationFiles();
    expect(files.map((f) => f.filename)).toContain("001_initial.sql");
    expect(files.find((f) => f.filename === "001_initial.sql")?.sql).toContain("CREATE TABLE sources");
  });

  it("regression: an explicit directory works with or without a trailing slash", async () => {
    const withSlash = await readMigrationFiles(MIGRATIONS_DIR);
    const withoutSlash = await readMigrationFiles(MIGRATIONS_DIR.replace(/\/$/, ""));
    expect(MIGRATIONS_DIR.endsWith("/")).toBe(true);
    expect(withoutSlash).toEqual(withSlash);
    expect(withoutSlash.length).toBeGreaterThan(0);
  });

  it("reads only .sql files from any directory it is given", async () => {
    const dir = await mkdtemp(join(tmpdir(), "recallfeed-migrations-"));
    try {
      await writeFile(join(dir, "001_a.sql"), "SELECT 1;");
      await writeFile(join(dir, "002_b.sql"), "SELECT 2;");
      await writeFile(join(dir, "notes.txt"), "not a migration");
      const files = await readMigrationFiles(dir);
      expect(files.map((f) => f.filename).sort()).toEqual(["001_a.sql", "002_b.sql"]);
      expect(files.find((f) => f.filename === "002_b.sql")?.sql).toBe("SELECT 2;");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects when the directory does not exist", async () => {
    await expect(readMigrationFiles(join(tmpdir(), "recallfeed-does-not-exist"))).rejects.toThrow(/ENOENT/);
  });
});

describe.skipIf(databaseUrl === "")("migrateDatabase connection lifecycle (live fixture)", () => {
  it("is idempotent against the live database", async () => {
    const report = await migrateDatabase(databaseUrl);
    expect(report.applied).toEqual([]);
    expect(report.skipped).toContain("001_initial.sql");
  });

  it("regression R2: connecting to the local proxy leaves no process-wide TLS relaxation behind", async () => {
    expect(neonConfig.useSecureWebSocket).toBe(true);
    await migrateDatabase(databaseUrl);
    expect(neonConfig.useSecureWebSocket).toBe(true);

    // A nonlocal client built after a local migration run still has the secure defaults.
    const remote = new Client("postgres://u:p@ep-cool-123.us-east-2.aws.neon.tech/recallfeed");
    expect(remote.neonConfig.useSecureWebSocket).toBe(true);
  });
});
