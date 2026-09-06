import { test as base, expect } from "@playwright/test";

/**
 * A crashed Server Component or a hydration mismatch still paints markup, so a
 * text assertion alone will happily pass against a broken deploy. Every test
 * that loads a page therefore also asserts the page came up *clean*.
 *
 * Uncaught exceptions are a hard failure. Console errors are filtered to the
 * React-lifecycle ones — a preview deployment logs plenty of unrelated noise
 * (blocked third parties, aborted prefetches) that would only make this flaky.
 */
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

/**
 * Slugs that exist ONLY in `src/data`, and must not resolve anywhere.
 *
 * These used to be the suite's anchor: seed posts that the site served out of
 * `articles.ts` / `projects.ts`, so a detail page could be asserted against an
 * empty database. That is exactly what stopped — the modules stayed in the
 * tree for the playgrounds, but nothing publishes them — so the same two slugs
 * now pin the opposite guarantee, and the suite tests the site's real content
 * instead of its fixtures.
 */
export const FIXTURE_ONLY_ARTICLE_SLUG = "css-anchor-positioning";
export const FIXTURE_ONLY_PROJECT_SLUG = "kartik-to";
