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
      exclude: ["**/*.test.ts", "**/__tests__/**", "**/index.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
});
