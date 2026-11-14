import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Client, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { configureLocalNeonProxy } from "./local-proxy";
import { applyMigrations } from "./migrate";
import type { Migration, MigrationReport } from "./migrate";

/** Directory holding the numbered `.sql` files. */
export const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

/**
 * Reads every `.sql` file in a directory.
 *
 * @param directory - Defaults to this package's `migrations/` directory.
 * @returns The files in directory order; sorting happens in `applyMigrations`.
 */
export async function readMigrationFiles(directory: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql"));
  return Promise.all(
    names.map(async (filename) => ({
      filename,
      sql: await readFile(new URL(filename, `file://${directory}`), "utf8"),
    })),
  );
}

/**
 * Connects over WebSocket (Node has no global WebSocket constructor for the driver),
 * applies pending migrations, and disconnects. Node only: this never runs in a Worker.
 *
 * @param databaseUrl - Target connection string. Never logged.
 * @param log - Receives one line per migration.
 * @returns The applied and skipped filenames.
 */
export async function migrateDatabase(
  databaseUrl: string,
  log: (line: string) => void = () => undefined,
): Promise<MigrationReport> {
  configureLocalNeonProxy(databaseUrl);
  neonConfig.webSocketConstructor = ws;
  const client = new Client(databaseUrl);
  await client.connect();
  try {
    return await applyMigrations(client, await readMigrationFiles(), log);
  } finally {
    await client.end();
  }
}
