import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The Spotwork prototype's SW Curie components and the parts each holds alone (`Dropdown.Item` in a `Dropdown`).
const SW_CURIE_PARTS = {
  Dropdown: ["Item"],
  TypeAhead: ["Item"],
  PopoverMenu: ["Item"],
  BulkSelect: ["Item"],
  Sidebar: ["Item", "GroupLabel"],
  Multiselect: ["Option"],
  NotesAndHistory: ["Toggle"],
  Field: ["Label", "HintText"],
};

/** The component an element is, or is a holding part of (`Sidebar.Group`); a part held alone isn't one. */
const ownerOf = (name) => {
  if (name.type === "JSXIdentifier")
    return SW_CURIE_PARTS[name.name] && name.name;
  if (name.type !== "JSXMemberExpression") return undefined;
  const parts = SW_CURIE_PARTS[name.object.name];
  return parts && !parts.includes(name.property.name)
    ? name.object.name
    : undefined;
};

const swCurie = {
  rules: {
    // A part written inside another component; one built away from any is left to the runtime check.
    "item-in-its-list": {
      meta: { type: "problem", schema: [] },
      create: (context) => ({
        JSXOpeningElement(node) {
          const { name } = node;
          if (name.type !== "JSXMemberExpression") return;
          const own = name.object.name;
          if (!SW_CURIE_PARTS[own]?.includes(name.property.name)) return;
          for (
            let element = node.parent.parent;
            element;
            element = element.parent
          ) {
            const owner =
              element.type === "JSXElement" &&
              ownerOf(element.openingElement.name);
            if (!owner) continue;
            if (owner !== own)
              context.report({
                node,
                message: `${own}.${name.property.name} must be used inside ${own}, not ${owner}.`,
              });
            return;
          }
        },
      }),
    },
  },
};

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

      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@js-temporal/polyfill",
              message:
                "Import `Temporal` from `@/utils/temporal`: it is the browser's own, and the polyfill is fetched only where there is none.",
            },
          ],
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
    // The one module that loads the Temporal polyfill.
    files: ["src/utils/temporal.ts", "src/utils/__tests__/temporal.test.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Playwright's fixture callback `use` reads as `React.use` to the hooks rules.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["src/app/projects/_spotwork/**/*.tsx"],
    plugins: { "sw-curie": swCurie },
    rules: { "sw-curie/item-in-its-list": "error" },
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
