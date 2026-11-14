import { ValidationError } from "@recallfeed/core";

/** A migration file's name and SQL text. */
export type Migration = {
  /** File name such as `001_initial.sql`. Recorded in `_schema_migrations`. */
  filename: string;
  /** The full SQL text of the file. */
  sql: string;
};

/**
 * The minimal query surface the runner needs. The Neon `Client` (WebSocket) satisfies it.
 * Migrations need multi-statement files and a transaction, which the HTTP `neon()` function
 * does not provide, so the runner takes a connected session object instead.
 */
export type MigrationClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

/** The outcome of one {@link applyMigrations} run. */
export type MigrationReport = {
  /** Filenames executed in this run, in execution order. */
  applied: string[];
  /** Filenames found already recorded in `_schema_migrations`. */
  skipped: string[];
};

const MIGRATION_FILENAME = /^(\d{3})_[a-z0-9_]+\.sql$/;

/**
 * Reads the numeric prefix of a migration filename.
 *
 * @param filename - A name like `002_add_published_state.sql`.
 * @returns The prefix as a number, or null if the name does not match `NNN_description.sql`.
 */
export function parseMigrationPrefix(filename: string): number | null {
  const match = MIGRATION_FILENAME.exec(filename);
  return match?.[1] === undefined ? null : Number.parseInt(match[1], 10);
}

/**
 * Orders migrations numerically by filename prefix (so `010_` sorts after `002_`).
 *
 * @param migrations - Migration files in any order.
 * @returns A new array sorted by numeric prefix.
 * @throws ValidationError if a filename is malformed or two files share a prefix.
 */
export function sortMigrations(migrations: readonly Migration[]): Migration[] {
  const seen = new Map<number, string>();
  const keyed = migrations.map((migration) => {
    const prefix = parseMigrationPrefix(migration.filename);
    if (prefix === null) {
      throw new ValidationError(
        `Migration filename must match NNN_description.sql: ${migration.filename}`,
        "VALIDATION_MIGRATION_FILENAME",
      );
    }
    const earlier = seen.get(prefix);
    if (earlier !== undefined) {
      throw new ValidationError(
        `Migrations ${earlier} and ${migration.filename} share the prefix ${prefix}`,
        "VALIDATION_MIGRATION_DUPLICATE_PREFIX",
      );
    }
    seen.set(prefix, migration.filename);
    return { prefix, migration };
  });
  return keyed.sort((a, b) => a.prefix - b.prefix).map((entry) => entry.migration);
}

/**
 * Applies every migration not yet recorded in `_schema_migrations`, in numeric order.
 *
 * Each file runs in its own transaction together with its tracking row, so a failure
 * leaves neither a half-applied file nor a false record. Running this twice applies each
 * file exactly once.
 *
 * @param client - A connected session (see {@link MigrationClient}).
 * @param migrations - All migration files, in any order.
 * @param log - Called with one human-readable line per migration.
 * @returns Which files were applied and which were skipped.
 */
export async function applyMigrations(
  client: MigrationClient,
  migrations: readonly Migration[],
  log: (line: string) => void = () => undefined,
): Promise<MigrationReport> {
  const ordered = sortMigrations(migrations);

  await client.query(
    `CREATE TABLE IF NOT EXISTS _schema_migrations (
       filename   TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  const recorded = await client.query("SELECT filename FROM _schema_migrations");
  const alreadyApplied = new Set(recorded.rows.map((row) => String(row.filename)));

  const report: MigrationReport = { applied: [], skipped: [] };
  for (const migration of ordered) {
    if (alreadyApplied.has(migration.filename)) {
      log(`skipped  ${migration.filename}`);
      report.skipped.push(migration.filename);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query("INSERT INTO _schema_migrations (filename) VALUES ($1)", [
        migration.filename,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    log(`applied  ${migration.filename}`);
    report.applied.push(migration.filename);
  }
  return report;
}
