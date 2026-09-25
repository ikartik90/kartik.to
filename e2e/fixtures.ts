import { test as base, expect } from "@playwright/test";

// Only React-lifecycle console errors count; preview deploys log unrelated noise.
const REACT_FAILURE = /minified react error|hydration failed|hydrat/i;

export const test = base.extend<{ pageFailures: string[] }>({
  pageFailures: async ({ page }, use) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`uncaught: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && REACT_FAILURE.test(message.text())) {
        failures.push(`console: ${message.text()}`);
      }
    });
    await use(failures);
  },
});

export { expect };

/** Slugs that exist only in `src/data` and must not resolve anywhere. */
export const FIXTURE_ONLY_ARTICLE_SLUG = "css-anchor-positioning";
export const FIXTURE_ONLY_PROJECT_SLUG = "kartik-to";
