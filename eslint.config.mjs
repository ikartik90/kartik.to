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

      // --- One spelling of "is this the author". ---
      // The predicate was re-typed at eleven call sites in four different
      // spellings before this rule existed. They agreed only because
      // `env.ADMIN_GITHUB_ID` is `z.email()` and so can never be empty — an
      // unstated dependency that would have changed behaviour in half of them
      // if that line were ever loosened. `isAdmin()` / `requireAdmin()` in
      // `src/lib/auth/server.ts` is the authorization boundary; everything
      // else asks it. The three files allowed to name the variable are
      // exempted below.
      // One selector, not a MemberExpression pair: `env.ADMIN_GITHUB_ID` puts
      // the name in an `Identifier` node either way, so matching the identifier
      // alone catches `env.X`, `process.env.X` and a bare `X` — and reports one
      // error per violation rather than two.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name='ADMIN_GITHUB_ID']",
          message:
            "Don't re-type the admin check. Import `isAdmin()` (or `requireAdmin()`) from `@/lib/auth/server` — it is the one server-side answer to whether the caller is the author.",
        },
      ],

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
  {
    // The three files that are ALLOWED to name the admin id, and the only
    // three: where it is declared, where the shared predicate is written, and
    // the proxy — which cannot call `isAdmin()` because it runs against a
    // `NextRequest` and verifies the session cookie itself. Tests may name it
    // too: a mocked `@/lib/env` is how they stand an environment up at all.
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
    // Playwright fixtures hand control back through a callback conventionally
    // named `use`, which the React Hooks rules read as a misplaced `React.use`.
    // Nothing under e2e/ is React, so the whole family is off here rather than
    // per-file — a new fixture file would otherwise trip the same wire.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
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
    // An agent's worktree is a FULL checkout of this repo — its own `src/`, its
    // own generated `styled-system/`. Linting from the root would lint all of
    // it a second time, and the patterns above cannot stop that: a flat-config
    // ignore with no leading `**/` is anchored to the directory THIS file sits
    // in, so `styled-system/**` covers ours and none of theirs. Left in, one
    // stale worktree put 1927 errors and 8886 warnings in front of a source
    // tree that reports zero of either, which is the same as having no lint
    // gate at all. A worktree lints itself, from its own root.
    ".claude/worktrees/**",
    // The Claude Design sync's working directory and the bundle it emits.
    // Neither is source: both are DERIVED from `src/` and `panda.config.ts` and
    // come back by re-running the sync, so neither is committed — and a lint
    // gate that reports on generated output is a lint gate nobody reads. One
    // sync run put 130 errors and 2224 warnings in front of a source tree that
    // has none of either, which is the same failure `.claude/worktrees/**`
    // above was added for.
    ".ds-sync/**",
    "ds-bundle/**",
  ]),
]);

export default eslintConfig;
