import { defineConfig } from "vitest/config";

// The tests cover pure functions (content splitting), so they run in plain Node, not the Workers runtime.
export default defineConfig({
  test: { name: "dev-recall", include: ["src/**/*.test.ts"], environment: "node" },
});
