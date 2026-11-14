import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@neondatabase/serverless";
import ws from "ws";
import { configureLocalNeonWebSocket } from "./local-proxy";
import { applyMigrations } from "./migrate";
import type { Migration, MigrationReport } from "./migrate";

/** Directory holding the numbered `.sql` files. */
export const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

/**
 * Reads every `.sql` file in a directory.
 *
 * @param directory - A directory path, with or without a trailing separator. Defaults to
 * this package's `migrations/` directory.
 * @returns The files in directory order; sorting happens in `applyMigrations`.
 */
export async function readMigrationFiles(directory: string = MIGRATIONS_DIR): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql"));
  return Promise.all(
    names.map(async (filename) => ({
      filename,
      sql: await readFile(join(directory, filename), "utf8"),
    })),
  );
}

/**
 * Connects over WebSocket, applies pending migrations, and disconnects. Node only: this
 * never runs in a Worker.
 *
 * The migration runner needs a session so it can wrap each multi-statement file and its
 * tracking row in one transaction. The HTTP `neon()` function supports only
 * non-interactive batches of single statements, so a WebSocket `Client` is used instead.
 *
 * The unencrypted local-proxy settings apply to this one client, and only when its
 * effective host is the local proxy host. Any other target keeps the driver's secure
 * defaults.
 *
 * @param databaseUrl - Target connection string. Never logged.
 * @param log - Receives one line per migration.
 * @returns The applied and skipped filenames.
 */
export async function migrateDatabase(
  databaseUrl: string,
  log: (line: string) => void = () => undefined,
): Promise<MigrationReport> {
  const client = new Client(databaseUrl);
  client.neonConfig.webSocketConstructor = ws;
  configureLocalNeonWebSocket(client);
  await client.connect();
  try {
    return await applyMigrations(client, await readMigrationFiles(), log);
  } finally {
    await client.end();
  }
}
