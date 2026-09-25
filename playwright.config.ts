import { defineConfig, devices } from "@playwright/test";

const externalTarget = process.env.E2E_BASE_URL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL: externalTarget ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Pinned: the theme resolves `system` off `prefers-color-scheme`.
    colorScheme: "light",
    // Vercel Deployment Protection bypass; the cookie carries it onto RSC and chunk requests.
    ...(bypassSecret
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": bypassSecret,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
  },

  // Drops the descriptor's Windows UA so the page and the keyboard agree on the platform.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], userAgent: undefined } },
  ],

  ...(externalTarget
    ? {}
    : {
        webServer: {
          // Production build: dev-mode overlays hide the errors this suite catches.
          command: "npm run build && npm run start",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
      }),
});
