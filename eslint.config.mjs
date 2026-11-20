// ESLint flat config (ESLint 10 reads flat config only; .eslintrc.* and
// .eslintignore are no longer supported).
//
// `pnpm lint` runs `eslint .` from the repository root, so this one config
// covers handwritten source, tests, scripts, and tool configuration files.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Every handwritten JavaScript/TypeScript extension the repository may contain. */
const SOURCE_FILES = ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"];

export default defineConfig([
  {
    // Generated output, dependencies, and caches are never linted.
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.wrangler/**",
      "**/.next/**",
      "**/.open-next/**",
      "**/next-env.d.ts",
      "**/.vite/**",
      "**/worker-configuration.d.ts",
    ],
  },
  {
    files: SOURCE_FILES,
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // Source File Length Policy (project-conventions.md): 1,000 physical
      // lines, with blank lines and comments counted.
      "max-lines": [
        "error",
        { max: 1000, skipBlankLines: false, skipComments: false },
      ],
    },
  },
  {
    // Tool configuration files and scripts run in Node.
    files: ["*.config.{js,mjs,cjs,ts}", "**/*.config.{js,mjs,cjs,ts}", "scripts/**"],
    languageOptions: { globals: globals.node },
  },
]);
