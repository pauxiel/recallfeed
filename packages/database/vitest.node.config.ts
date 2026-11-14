import { defineConfig } from "vitest/config";

// Tests that must run in plain Node because they use the filesystem, the `ws` package, or
// the Node-only migration and fixture code. The Workers-runtime tests live in
// vitest.config.ts. Like the integration suites there, the database-backed tests here skip
// unless TEST_DATABASE_URL is set; `pnpm test:integration` sets it.
export default defineConfig({
  test: {
    name: "database-node",
    environment: "node",
    include: ["src/**/*.node.test.ts"],
  },
});
