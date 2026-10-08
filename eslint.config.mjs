import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Browser-bound and isomorphic code must never pull in server modules (pg, secrets).
    files: ["src/components/**", "src/stores/**", "src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/server/*", "@/app/api/*"], message: "Server-only module." }] },
      ],
    },
  },
  {
    // The design core is shared by the canvas, the API and the MCP server.
    files: ["src/lib/design/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/*", "@/app/*", "@/components/*", "@/stores/*"],
              message: "Keep src/lib/design pure.",
            },
            {
              group: ["react", "react-dom", "next", "next/*", "node:*"],
              message: "Keep src/lib/design isomorphic.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
