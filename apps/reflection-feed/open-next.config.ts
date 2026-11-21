import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache, queue or tag cache: every page reads the owner's live feed, so nothing is cached.
export default defineCloudflareConfig();
