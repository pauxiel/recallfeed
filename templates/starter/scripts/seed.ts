/**
 * Loads the starter's sample notes: `pnpm seed`.
 *
 * It talks to the running API over HTTP with @recallfeed/client, the way any app would: it imports each file in
 * `seed/`, then publishes the cards the import created (imported cards start unpublished, and a public feed shows
 * published cards only). It needs the API running (`pnpm dev`) and API_SECRET_KEY, read from the environment or from
 * the git-ignored `.dev.vars`. The key is never printed.
 *
 * A repeat run imports nothing new and publishes nothing, because an import reports only the cards it created.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RecallFeedApiError, createRecallFeedClient } from "@recallfeed/client";

try {
  process.loadEnvFile(".dev.vars");
} catch {
  // No .dev.vars file: the environment alone is used.
}

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:8790";
const apiKey = process.env.API_SECRET_KEY;
if (apiKey === undefined || apiKey === "") {
  console.error("API_SECRET_KEY is not set. Copy .dev.vars.example to .dev.vars and fill it in.");
  process.exit(1);
}

const client = createRecallFeedClient({ baseUrl: apiUrl, apiKey });
const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "seed");

try {
  let imported = 0;
  let published = 0;
  for (const file of (await readdir(seedDir)).filter((name) => name.endsWith(".md")).sort()) {
    const result = await client.importMarkdown(await readFile(join(seedDir, file), "utf8"), { name: basename(file, ".md") });
    imported += result.feedItemsCreated;
    for (const id of result.feedItemIds) {
      await client.review(id, "published");
      published += 1;
    }
    console.log(`${file}: ${result.notesImported} notes, ${result.feedItemsCreated} new cards`);
  }
  console.log(`done: ${imported} cards created, ${published} published`);
} catch (error) {
  // Print the API's message and code only. The key is never part of either.
  if (error instanceof RecallFeedApiError) {
    console.error(`${error.code} (HTTP ${error.status}): ${error.message}`);
  } else {
    console.error(`seed failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
}
