import { ValidationError } from "@recallfeed/core";
import { describe, expect, it } from "vitest";
import { applyMigrations, parseMigrationPrefix, sortMigrations } from "../migrate";
import type { MigrationClient } from "../migrate";

/** Records every statement and fails on demand; stands in for a database session. */
function fakeClient(options: { applied?: string[]; failOn?: string } = {}) {
  const statements: string[] = [];
  const client: MigrationClient = {
    query(text: string) {
      statements.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
      if (options.failOn !== undefined && text.includes(options.failOn)) {
        return Promise.reject(new Error("boom"));
      }
      if (text.startsWith("SELECT filename")) {
        return Promise.resolve({ rows: (options.applied ?? []).map((filename) => ({ filename })) });
      }
      return Promise.resolve({ rows: [] });
    },
  };
  return { client, statements };
}

describe("parseMigrationPrefix", () => {
  it("reads the numeric prefix", () => {
    expect(parseMigrationPrefix("001_initial.sql")).toBe(1);
    expect(parseMigrationPrefix("010_add_tags.sql")).toBe(10);
  });

  it.each(["1_initial.sql", "001-initial.sql", "001_Initial.sql", "001_initial.txt", "initial.sql"])(
    "rejects %s",
    (name) => {
      expect(parseMigrationPrefix(name)).toBeNull();
    },
  );
});

describe("sortMigrations", () => {
  it("orders numerically, so 010 sorts after 002", () => {
    const sorted = sortMigrations([
      { filename: "010_add_tags.sql", sql: "" },
      { filename: "002_add_published_state.sql", sql: "" },
      { filename: "001_initial.sql", sql: "" },
    ]);
    expect(sorted.map((m) => m.filename)).toEqual([
      "001_initial.sql",
      "002_add_published_state.sql",
      "010_add_tags.sql",
    ]);
  });

  it("rejects a malformed filename with a typed error", () => {
    expect(() => sortMigrations([{ filename: "bad.sql", sql: "" }])).toThrow(ValidationError);
  });

  it("rejects two files that share a prefix", () => {
    expect(() =>
      sortMigrations([
        { filename: "001_a.sql", sql: "" },
        { filename: "001_b.sql", sql: "" },
      ]),
    ).toThrow(/share the prefix 1/);
  });
});

describe("applyMigrations", () => {
  const files = [
    { filename: "002_two.sql", sql: "SELECT 2" },
    { filename: "001_one.sql", sql: "SELECT 1" },
  ];

  it("applies unapplied files in order, each in a transaction with its tracking row", async () => {
    const { client, statements } = fakeClient();
    const report = await applyMigrations(client, files);
    expect(report).toEqual({ applied: ["001_one.sql", "002_two.sql"], skipped: [] });
    expect(statements.filter((s) => s !== "CREATE TABLE IF")).toEqual([
      "SELECT filename FROM",
      "BEGIN",
      "SELECT 1",
      "INSERT INTO _schema_migrations",
      "COMMIT",
      "BEGIN",
      "SELECT 2",
      "INSERT INTO _schema_migrations",
      "COMMIT",
    ]);
  });

  it("skips files already recorded", async () => {
    const { client } = fakeClient({ applied: ["001_one.sql"] });
    const report = await applyMigrations(client, files);
    expect(report).toEqual({ applied: ["002_two.sql"], skipped: ["001_one.sql"] });
  });

  it("rolls back and rethrows when a file fails, recording nothing for it", async () => {
    const { client, statements } = fakeClient({ failOn: "SELECT 2" });
    await expect(applyMigrations(client, files)).rejects.toThrow("boom");
    expect(statements).toContain("ROLLBACK");
    expect(statements.filter((s) => s === "INSERT INTO _schema_migrations")).toHaveLength(1);
  });
});
