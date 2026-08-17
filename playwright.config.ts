import { defineConfig, devices } from "@playwright/test";

/**
 * One suite, two targets.
 *
 * - CI points `E2E_BASE_URL` at the Vercel *preview* deployment for the PR's
 *   head commit, so the tests exercise the real artifact — real env, real Neon
 *   database, real proxy — rather than a runner-local build with stubbed
 *   config. That is the only way a "does this PR break the deployed site?"
 *   check can catch infrastructure-shaped failures.
 * - With `E2E_BASE_URL` unset (i.e. locally), Playwright builds and boots the
 *   app itself so `npm run test:e2e` just works.
 */
const externalTarget = process.env.E2E_BASE_URL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // A stray `test.only` would silently shrink the gate that guards main.
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
    // Pin the scheme: the theme resolves `system` off `prefers-color-scheme`,
    // so leaving it to the runner's default makes the theme assertions
    // non-deterministic.
    colorScheme: "light",
    // Vercel Deployment Protection answers unauthenticated preview traffic with
    // a redirect to vercel.com/login. The bypass secret is the documented way
    // for automation to get through; `set-bypass-cookie` carries it onto the
    // follow-up requests the browser makes for RSC payloads and chunks.
    ...(bypassSecret
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": bypassSecret,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
  },

  // `userAgent: undefined` drops the descriptor's own UA string, which pins
  // `Windows NT 10.0` on every host — and Chromium derives `userAgentData`
  // from the override too, so the page CLAIMS Windows while the keyboard is
  // driven from the real OS. Anything platform-shaped then reads one machine's
  // truth and the other's keys: the palette's shortcut is ⌘K or Ctrl K by that
  // claim, so a Mac would emulate Windows, be told Ctrl, and be sent ⌘.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], userAgent: undefined } },
  ],

  ...(externalTarget
    ? {}
    : {
        webServer: {
          // Production build, not `next dev` — dev-mode overlays and the
          // unminified runtime hide the errors this suite exists to catch.
          command: "npm run build && npm run start",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
        },
      }),
});
