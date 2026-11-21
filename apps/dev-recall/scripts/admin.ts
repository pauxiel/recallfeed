/**
 * DevRecall's admin CLI (Spec 09, option 1): `pnpm --filter dev-recall admin <command>`.
 *
 *   import <file.md> [--name <name>] [--publish]   import a Markdown file; --publish also publishes the cards it creates
 *   publish <card id>                              publish one card (the same as: review <card id> published)
 *   review <card id> <action>                      reviewed | saved | unsaved | snoozed | published | unpublished
 *   list [--limit <1-50>]                          print the published cards, as the public sees them
 *
 * An import starts every new card unpublished, so the public sees nothing until you publish. The import reports
 * the IDs of the cards it created. Without --publish they are printed so you can publish them; a repeat import
 * reports none, so keep the list.
 *
 * It runs on your machine, never in the browser. Settings come from the environment, or from a `.env` file
 * in this directory (git-ignored):
 *
 *   API_URL          the API's address, such as https://dev-recall-api.example.workers.dev
 *   API_SECRET_KEY   the deployment's key. It is sent as X-API-Key and is never printed.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { isReviewAction } from "@recallfeed/core";
import { RecallFeedApiError, createRecallFeedClient } from "@recallfeed/client";
import { publishCards } from "./publish-cards";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: the environment alone is used.
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const apiUrl = process.env.API_URL;
const apiKey = process.env.API_SECRET_KEY;
if (apiUrl === undefined || apiUrl === "") fail("API_URL is not set.");

const [command, ...args] = process.argv.slice(2);
const client = createRecallFeedClient({ baseUrl: apiUrl, ...(apiKey === undefined || apiKey === "" ? {} : { apiKey }) });

function needKey(): void {
  if (apiKey === undefined || apiKey === "") fail("API_SECRET_KEY is not set. Writes need it.");
}

try {
  if (command === "import") {
    const file = args[0];
    if (file === undefined || file.startsWith("--")) fail("Usage: admin import <file.md> [--name <name>] [--publish]");
    needKey();
    const content = await readFile(file, "utf8");
    const name = option(args, "--name") ?? basename(file, ".md");
    const result = await client.importMarkdown(content, { name });
    console.log(`imported "${name}": ${result.notesImported} notes, ${result.feedItemsCreated} new cards`);
    if (args.includes("--publish")) {
      const outcome = await publishCards(client, result.feedItemIds, (_id, position) => {
        console.log(`published ${position} of ${result.feedItemIds.length}`);
      });
      if (outcome.failed !== undefined) {
        const reason = outcome.failed.error instanceof RecallFeedApiError ? `${outcome.failed.error.code} (HTTP ${outcome.failed.error.status})` : "an unexpected error";
        console.error(`could not publish ${outcome.failed.id}: ${reason}`);
        const remaining = [outcome.failed.id, ...outcome.notAttempted];
        fail(`${outcome.published.length} published, ${remaining.length} not. Publish the rest with: admin publish <id>\n${remaining.join("\n")}`);
      }
    } else if (result.feedItemIds.length > 0) {
      console.log("new cards, not yet published (publish one with: admin publish <id>):");
      for (const id of result.feedItemIds) console.log(id);
    }
  } else if (command === "publish") {
    const id = args[0];
    if (id === undefined) fail("Usage: admin publish <card id>");
    needKey();
    const result = await client.review(id, "published");
    console.log(`published: ${result.id}`);
  } else if (command === "review") {
    const [id, action] = args;
    if (id === undefined || action === undefined || !isReviewAction(action)) {
      fail("Usage: admin review <card id> <reviewed|saved|unsaved|snoozed|published|unpublished>");
    }
    needKey();
    const result = await client.review(id, action);
    console.log(`${action}: ${result.id} is ${result.isPublished ? "published" : "unpublished"}, reviewed ${result.reviewCount} times`);
  } else if (command === "list") {
    const limit = Number(option(args, "--limit") ?? "10");
    const page = await client.listFeed({ limit });
    for (const card of page.items) {
      console.log(`${card.id}  ${card.cardType.padEnd(10)}  ${card.content.split("\n")[0]?.slice(0, 70) ?? ""}`);
    }
    console.log(page.nextCursor === null ? "(end of feed)" : "(more cards: use a larger --limit)");
  } else {
    fail("Commands: import <file.md> [--name <name>] [--publish] | publish <card id> | review <card id> <action> | list [--limit <n>]");
  }
} catch (error) {
  // Print the API's message and code only. The key is never part of either.
  if (error instanceof RecallFeedApiError) fail(`${error.code} (HTTP ${error.status}): ${error.message}`);
  fail(`failed: ${error instanceof Error ? error.message : String(error)}`);
}
