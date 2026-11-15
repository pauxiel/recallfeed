import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Integration tests need the disposable database (see packages/database/README.md). Without
// TEST_DATABASE_URL they skip, so a plain `pnpm test` never needs an external service.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-10-01",
        // Exposed to tests as `env.TEST_DATABASE_URL`, like production code gets `env.DATABASE_URL`.
        bindings: { TEST_DATABASE_URL: testDatabaseUrl },
      },
    }),
  ],
  test: {
    name: "api",
    include: ["src/**/*.test.ts"],
    // Every package shares one database. Test files run one at a time so they never interleave.
    fileParallelism: false,
    // Runs in Node first: applies migrations to the disposable fixture, never resets it.
    globalSetup: ["./src/__tests__/setup.ts"],
  },
});
