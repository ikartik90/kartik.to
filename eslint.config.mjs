import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",

      "react-hooks/refs": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
      "react-hooks/immutability": "error",
      "react-hooks/globals": "error",
      "react-hooks/static-components": "error",

      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name='ADMIN_GITHUB_ID']",
          message:
            "Don't re-type the admin check. Import `isAdmin()` (or `requireAdmin()`) from `@/lib/auth/server` — it is the one server-side answer to whether the caller is the author.",
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // The only files allowed to name the admin id.
    files: [
      "src/lib/env.ts",
      "src/lib/auth/server.ts",
      "src/proxy.ts",
      "**/__tests__/**",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Playwright's fixture callback `use` reads as `React.use` to the hooks rules.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Replaces eslint-config-next's default ignores, so they are re-listed here.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "styled-system/**",
    // Worktrees are full checkouts; each lints itself from its own root.
    ".claude/worktrees/**",
    // Derived output of the Claude Design sync, not source.
    ".ds-sync/**",
    "ds-bundle/**",
  ]),
]);

export default eslintConfig;
