/**
 * Seeds DevRecall's sample content: `pnpm --filter dev-recall seed`.
 *
 * Reads `DATABASE_URL` from the environment and imports every Markdown file in `seed/` through the shared
 * feed engine, as an import request would, creating the card types `DEFAULT_CARD_TYPES` lists (unset means
 * DevRecall's own value, copied from wrangler.toml into `APP_CARD_TYPES` below). Each file becomes one
 * source named after the file. It then publishes the cards it just imported, because imports start
 * unpublished and a public deployment shows only published cards.
 *
 * Idempotent: running it again adds only cards that are missing and publishes only cards that are not yet
 * published. Runs in Node (through tsx), never inside a Worker. The connection string is never printed.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { configureLocalNeonHttp, createDb } from "@recallfeed/database";
import { DEFAULT_SNOOZE_HOURS, FeedEngine, MAX_FEED_LIMIT, parseImportCardTypes } from "@recallfeed/feed-engine";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  console.error("DATABASE_URL is not set. Nothing was changed.");
  process.exit(1);
}

/** DevRecall's DEFAULT_CARD_TYPES, as in wrangler.toml. */
const APP_CARD_TYPES = "original,summary,code_snippet";

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

try {
  // Does nothing unless the URL's host is the local proxy (db.localtest.me).
  configureLocalNeonHttp(databaseUrl);
  const cardTypes = parseImportCardTypes(process.env.DEFAULT_CARD_TYPES ?? APP_CARD_TYPES);
  const engine = new FeedEngine(createDb(databaseUrl));

  const sources = new Set<string>();
  const files = (await readdir(seedDir)).filter((name) => name.endsWith(".md")).sort();
  for (const file of files) {
    const content = await readFile(join(seedDir, file), "utf8");
    const result = await engine.importMarkdown(content, { name: basename(file, ".md"), cardTypes });
    sources.add(result.sourceId);
    console.log(`${file}: ${result.notesImported} notes, ${result.feedItemsCreated} new cards`);
  }

  // Publish this seed's cards. The owner view (isPublicRequest false) lists unpublished cards too.
  let published = 0;
  let cursor: string | undefined;
  do {
    const page = await engine.listFeedItems({ isPublicRequest: false, limit: MAX_FEED_LIMIT, ...(cursor === undefined ? {} : { cursor }) });
    for (const card of page.items) {
      if (sources.has(card.sourceId) && !card.isPublished) {
        await engine.recordReview(card.id, "published", { snoozeHours: DEFAULT_SNOOZE_HOURS });
        published += 1;
      }
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  console.log(`done: ${files.length} files, ${published} cards published`);
} catch (error) {
  // Print the message only. Driver errors can carry connection details.
  console.error(`seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
