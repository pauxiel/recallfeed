/**
 * Command line entry point: `pnpm --filter @recallfeed/database db:migrate`.
 *
 * Reads `DATABASE_URL` from the environment and applies pending migrations. Runs in Node
 * (through tsx), never inside a Worker.
 */
import { migrateDatabase } from "./migrate-node";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  console.error("DATABASE_URL is not set. Nothing was changed.");
  process.exit(1);
}

try {
  const report = await migrateDatabase(databaseUrl, (line) => console.log(line));
  console.log(`done: ${report.applied.length} applied, ${report.skipped.length} skipped`);
} catch (error) {
  // Print the message only. Driver errors can carry connection details.
  console.error(`migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
