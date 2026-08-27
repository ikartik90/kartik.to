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
        replaceAttrValues: { "#fff": "currentColor", "#ffffff": "currentColor" },
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
