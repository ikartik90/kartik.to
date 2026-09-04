import { configDefaults, defineConfig } from "vitest/config";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    svgr({
      include: "**/*.svg",
      // Mirror next.config's svgr so tests handle icons exactly like the app —
      // notably `removeViewBox: false`, so imported SVGs keep their viewBox and
      // scale correctly when CSS-sized (e.g. tooltip icons at 14px).
      svgrOptions: {
        replaceAttrValues: {
          "#fff": "currentColor",
          "#ffffff": "currentColor",
        },
        svgoConfig: {
          plugins: [
            {
              name: "preset-default",
              params: { overrides: { removeViewBox: false } },
            },
          ],
        },
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    // Vitest's default is 5s, which is not enough for this app's heaviest
    // interaction suites on a machine that is busy. The demo walkthrough and
    // the calchemy playground each mount a whole feature — an engine, a
    // virtualised grid, a scripted performance — and then drive it with real
    // typing and clicking rather than by poking state. A case costs ~1.4s
    // alone, clears 5s comfortably on a quiet machine, and does not on a CI
    // runner sharing its cores: two calchemy cases timed out there while
    // passing locally, and running two suites at once here reproduces it with
    // a dozen more in `shift-scheduling-v1`.
    //
    // Measured at the same cost on `main`, so this is the machine, not a
    // regression — and global rather than per-file because it is the DEFAULT
    // that is wrong for this codebase, not those two files. Still short enough
    // that a genuinely hung test fails the run rather than hanging it.
    testTimeout: 20_000,
    // Playwright specs also match the default `*.spec.ts` glob; without this
    // Vitest picks them up and dies on `@playwright/test`'s runner imports.
    //
    // `.claude/worktrees/**` for the same reason ESLint ignores it: a worktree
    // is a full checkout that runs its own suite from its own root, and one
    // left behind at an older commit fails tests that pass here — 21 of them,
    // which is enough noise to hide a real regression in the tree you edited.
    exclude: [...configDefaults.exclude, "e2e/**", ".claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
