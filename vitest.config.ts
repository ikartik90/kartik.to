import { configDefaults, defineConfig } from "vitest/config";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    svgr({
      include: "**/*.svg",
      // Mirrors next.config's svgr options.
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
    // 20s: the heaviest interaction suites exceed the 5s default on a busy CI runner.
    testTimeout: 20_000,
    // Playwright specs match `*.spec.ts`; worktrees are full checkouts with their own suites.
    exclude: [...configDefaults.exclude, "e2e/**", ".claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
