import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Gives `next dev` local versions of the Worker bindings through getCloudflareContext().
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // The shared packages are consumed as TypeScript source (their `main` is `src/index.ts`).
  transpilePackages: ["@recallfeed/api", "@recallfeed/core", "@recallfeed/database", "@recallfeed/feed-engine", "@recallfeed/connectors"],
};

export default nextConfig;
