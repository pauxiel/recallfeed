import { defineConfig } from "vitest/config";

// The tests cover pure functions (content splitting, the publish loop), so they run in plain Node, not the Workers runtime.
export default defineConfig({
  test: { name: "dev-recall", include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], environment: "node" },
});
