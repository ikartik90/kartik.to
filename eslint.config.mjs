import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // --- Accessibility: promote the silent warnings to hard errors. ---
      // These are enabled as warnings by eslint-config-next; a warning never
      // fails `eslint`, so invalid ARIA (e.g. aria-selected on role=menuitem)
      // slipped through. Errors make the lint gate actually block them.
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",

      // --- React Compiler rules (ship in eslint-plugin-react-hooks@7, already
      // installed via eslint-config-next). Next's config only turns on the two
      // classic rules; these catch the static-analysis class of bug the dev-time
      // runtime warnings report — e.g. writing a ref during render. ---
      "react-hooks/refs": "error",
      "react-hooks/set-state-in-render": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
      "react-hooks/immutability": "error",
      "react-hooks/globals": "error",
      "react-hooks/static-components": "error",

      // Allow the conventional "omit a key via rest" idiom and _-prefixed
      // intentional throwaways.
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
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "styled-system/**",
  ]),
]);

export default eslintConfig;
