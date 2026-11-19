import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Ported from the Express backend with logic unchanged (`// @ts-nocheck`). Typed
// incrementally — remove a file's @ts-nocheck to bring it under full checks.
const PORTED = [
  "src/server/{controllers,services,repositories,validators,routes,utils,middleware,constants,config,emails,helpers}/**/*.ts",
  "src/server/modules/**/*.ts",
  "src/server/app.ts",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: PORTED,
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-this-alias": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@next/next/no-assign-module-variable": "off",
      "prefer-const": "off",
    },
  },
  {
    // The Mongo-compatible data layer works with schemaless documents.
    files: ["src/db/**/*.ts", "src/server/lib/**/*.ts", "src/server/http/**/*.ts", "src/server/models/**/*.ts", "src/app/api/**/*.ts", "scripts/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-this-alias": "off" },
  },
  // The copied website keeps its original code style until the redesign.
  globalIgnores([".next/**", ".next-*/**", "out/**", "build/**", "next-env.d.ts", "src/legacy-ui/**", "backups/**", ".data/**"]),
]);
