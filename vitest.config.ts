import { defineConfig } from "vitest/config";
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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
