// Root Vitest config. Vitest 4 replaced `vitest.workspace.ts` with
// `test.projects`, so this file is the multi-package entry point.
// Each package under packages/* owns a vitest.config.ts that selects the
// Workers runtime via @cloudflare/vitest-plugin.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Each package may have a Workers config (vitest.config.ts) and a plain-Node config
    // (vitest.node.config.ts).
    projects: ["packages/*/vitest.config.ts", "packages/*/vitest.node.config.ts"],
    coverage: {
      // The Workers pool supports only the istanbul provider.
      provider: "istanbul",
      include: ["packages/{core,database,connectors,feed-engine,api}/src/**/*.ts"],
      // Istanbul instruments code in both the Workers and the Node test projects. Only
      // `*-cli.ts` entry points are excluded: they run as separate processes that call
      // process.exit(), so they are verified by running them (`pnpm db:migrate`). The global
      // setup (`__tests__/setup.ts`) is excluded as a test file.
      exclude: ["**/*.test.ts", "**/__tests__/**", "**/index.ts", "**/*-cli.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
