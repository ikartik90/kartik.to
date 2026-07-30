import {
  expect,
  test,
  STATIC_ARTICLE_SLUG,
  STATIC_PROJECT_SLUG,
} from "./fixtures";

test.describe("public routes", () => {
  test("the home page renders both listing sections", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("kartik.to");
    // The header only renders on "/", so its presence doubles as a check that
    // the client-side `usePathname` branch hydrated.
    await expect(page.getByText("Kartik Iyer")).toBeVisible();
    await expect(page.getByText("Projects", { exact: true })).toBeVisible();
    await expect(page.getByText("Writing", { exact: true })).toBeVisible();

    // Listings merge database posts over the static fallbacks, so assert the
    // sections are populated rather than pinning an exact count.
    await expect(
      page.locator(`a[href^="/work/"]`).first(),
    ).toBeVisible();
    await expect(
      page.locator(`a[href^="/writing/"]`).first(),
    ).toBeVisible();

    expect(pageFailures).toEqual([]);
  });

  test("an article page renders its title and body", async ({
    page,
    pageFailures,
  }) => {
    await page.goto(`/writing/${STATIC_ARTICLE_SLUG}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "CSS Anchor Positioning Kills the Tooltip Library",
    );
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();

    expect(pageFailures).toEqual([]);
  });

  test("a project page renders its title", async ({ page, pageFailures }) => {
    await page.goto(`/work/${STATIC_PROJECT_SLUG}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("kartik.to");

    expect(pageFailures).toEqual([]);
  });

  test("navigating from the home listing reaches the article", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");
    await page.locator(`a[href="/writing/${STATIC_ARTICLE_SLUG}"]`).click();

    await expect(page).toHaveURL(new RegExp(`/writing/${STATIC_ARTICLE_SLUG}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(pageFailures).toEqual([]);
  });

  test("an unknown slug 404s rather than erroring", async ({ page }) => {
    const response = await page.goto("/writing/no-such-article-exists");
    expect(response?.status()).toBe(404);
  });
});

// The dev routes are the design system's living previews — every primitive
// renders there, so a Panda recipe or token regression surfaces here first.
const DEV_ROUTES = [
  "button",
  "calendar",
  "checkbox",
  "combobox",
  "datepicker",
  "demo-logger",
  "menu",
  "notice",
  "option-list",
  "shift-scheduling-v0",
  "switch",
  "text-input",
];

test.describe("design system previews", () => {
  for (const route of DEV_ROUTES) {
    test(`/dev/${route} renders without errors`, async ({
      page,
      pageFailures,
    }) => {
      const response = await page.goto(`/dev/${route}`);

      expect(response?.status()).toBe(200);

      // `200` plus a visible <main> is not proof this is our page — an
      // interstitial (Vercel's own deployment-protection login, for one)
      // satisfies both, and an earlier CI run passed all twelve of these
      // against exactly that. Assert two things only the root layout produces:
      // its metadata title, and the data-theme the inline pre-paint script
      // stamps on <html>.
      await expect(page).toHaveTitle("kartik.to");
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        /^(light|dark)$/,
      );
      await expect(page.locator("main")).toBeVisible();
      expect(pageFailures).toEqual([]);
    });
  }
});
