import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { configDefaults, defineConfig } from "vitest/config";

// Integration tests need a disposable database. Start it with `pnpm db:test:up` and run
// `pnpm test:integration`. Without TEST_DATABASE_URL the integration suites are skipped,
// so a plain `pnpm test` never depends on an external service.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-10-01",
        // Exposed to tests as `env.TEST_DATABASE_URL`, mirroring how production code
        // receives `env.DATABASE_URL`.
        bindings: { TEST_DATABASE_URL: testDatabaseUrl },
      },
    }),
  ],
  test: {
    name: "database",
    // Every package shares one database, and some tests seed cards that change the order other tests
    // read. Test files run one at a time so they never interleave, as in the api and feed-engine packages.
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    // Files named *.node.test.ts run in plain Node under vitest.node.config.ts.
    exclude: [...configDefaults.exclude, "src/**/*.node.test.ts"],
    // Runs in Node before the Workers-runtime tests: guards the target, resets the
    // schema, and applies migrations through the migration code under test.
    globalSetup: ["./src/__tests__/setup.ts"],
  },
});
