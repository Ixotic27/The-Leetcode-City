import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The vscode-extension package has its own TS config and is not
    // part of the Next.js app.  Linting it with next/typescript
    // rules causes pre-existing `no-explicit-any` errors that block
    // every contributor PR.
    "packages/**",
    // Admin / one-off scripts are not shipped in the web app.
    "scripts/**",
  ]),
]);

export default eslintConfig;
