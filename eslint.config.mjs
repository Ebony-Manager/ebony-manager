import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Old Vite app, archived as reference — not linted against the new config.
    "_legacy/**",
    // Brand design-system reference material (gitignored, not part of the app).
    "_diseño-ebony-fuente/**",
  ]),
]);

export default eslintConfig;
