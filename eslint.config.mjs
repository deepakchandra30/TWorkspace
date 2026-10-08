import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // lib/ holds pure functions, so Vitest runs it with no framework or database.
  {
    files: ["lib/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "mongodb", "socket.io", "socket.io-client"],
          message: "lib/ stays pure: no framework, database or socket imports.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
