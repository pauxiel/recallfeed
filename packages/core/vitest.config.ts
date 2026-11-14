import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // Pins Workers runtime behavior so test results do not drift with the
        // installed workerd release.
        compatibilityDate: "2026-10-01",
      },
    }),
  ],
  test: {
    name: "core",
    include: ["**/*.test.ts"],
  },
});
