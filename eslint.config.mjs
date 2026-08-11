import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler readiness rules — this project doesn't opt into the
    // compiler (--no-react-compiler), so these don't apply.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build artifacts and plain-CJS Electron bootstrap (not app source).
    "dist-server/**",
    "dist-electron/**",
    "release/**",
    "electron/**",
    "next-standalone/**",
    "resources/**",
  ]),
]);

export default eslintConfig;
