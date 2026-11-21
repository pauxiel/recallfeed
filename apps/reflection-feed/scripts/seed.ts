/**
 * Seeds ReflectionFeed's sample content: `pnpm --filter reflection-feed seed`.
 *
 * Reads `DATABASE_URL` from the environment and imports every Markdown file in `seed/` through the shared
 * feed engine, exactly as an import request would. Each file becomes one source named after the file.
 * Imports are idempotent, so running this again changes nothing but timestamps. Runs in Node (through
 * tsx), never inside a Worker. The connection string is never printed.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configureLocalNeonHttp, createDb } from "@recallfeed/database";
import { FeedEngine } from "@recallfeed/feed-engine";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  console.error("DATABASE_URL is not set. Nothing was changed.");
  process.exit(1);
}

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

try {
  // Does nothing unless the URL's host is the local proxy (db.localtest.me).
  configureLocalNeonHttp(databaseUrl);
  const engine = new FeedEngine(createDb(databaseUrl));
  const files = (await readdir(seedDir)).filter((name) => name.endsWith(".md")).sort();
  for (const file of files) {
    const content = await readFile(join(seedDir, file), "utf8");
    const result = await engine.importMarkdown(content, { name: basename(file, ".md") });
    console.log(`${file}: ${result.notesImported} notes, ${result.feedItemsCreated} new cards`);
  }
  console.log(`done: ${files.length} files`);
} catch (error) {
  // Print the message only. Driver errors can carry connection details.
  console.error(`seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
