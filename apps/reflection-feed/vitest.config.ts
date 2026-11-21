import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// The Worker wrapper's tests run in the Workers runtime, like the shared packages' tests. They need no
// database and no Next.js build: the API and Next.js handlers are stand-ins.
export default defineConfig({
  plugins: [cloudflareTest({ miniflare: { compatibilityDate: "2026-10-01", compatibilityFlags: ["nodejs_compat"] } })],
  test: {
    name: "reflection-feed",
    include: ["src/**/*.test.ts"],
  },
});
