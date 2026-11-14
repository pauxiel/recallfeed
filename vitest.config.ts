// Root Vitest config. Vitest 4 replaced `vitest.workspace.ts` with
// `test.projects`, so this file is the multi-package entry point.
// Each package under packages/* owns a vitest.config.ts that selects the
// Workers runtime via @cloudflare/vitest-plugin.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*"],
    coverage: {
      // The Workers pool supports only the istanbul provider.
      provider: "istanbul",
      include: ["packages/{core,database,feed-engine}/src/**/*.ts"],
      // Istanbul only instruments code that runs inside the Workers-runtime test process.
      // The *-node.ts and *-cli.ts files and test setup run in Node (the migration CLI and
      // vitest's global setup), so they are excluded here and verified by running them:
      // `pnpm db:migrate` twice, and the integration suite that depends on global setup.
      exclude: ["**/*.test.ts", "**/__tests__/**", "**/index.ts", "**/*-node.ts", "**/*-cli.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
