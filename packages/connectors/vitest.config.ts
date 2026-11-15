import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        // Pins Workers runtime behavior so results do not drift with the installed workerd.
        compatibilityDate: "2026-10-01",
      },
    }),
  ],
  test: {
    name: "connectors",
    include: ["src/**/*.test.ts"],
  },
});
