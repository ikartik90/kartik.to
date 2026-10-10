import type { APIResponse } from "@playwright/test";
import { expect, test } from "./fixtures";

// The Dive Club review copy of the homepage and its projects, under /dive.

const WIDGET_TAG =
  '<script src="https://inflight.co/widget.js" data-org="aius9qpt" data-path="/dive" async="">';

const headOf = (html: string) => html.slice(0, html.indexOf("</head>"));

// Every line of it: a Vercel preview sends its own `noindex` on every page.
const robotsTag = (response: APIResponse) =>
  response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "x-robots-tag")
    .map(({ value }) => value)
    .join("\n");

test.describe("review copy", () => {
  test.beforeEach(async ({ page }) => {
    // The widget is Inflight's to test; here it only has to be in the HTML.
    await page.route("https://inflight.co/**", (route) => route.abort());
    // The sheet then opens and closes at once: a history step taken mid-animation can strand it, here as on `/`.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("serves the Inflight widget in the head of its pages, and keeps them out of search", async ({ request }) => {
    for (const path of ["/dive", "/dive/projects/shift-scheduling", "/dive/projects/onboarding"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(robotsTag(response), path).toContain("noindex, nofollow");
      const html = await response.text();
      expect(headOf(html), path).toContain(WIDGET_TAG);
      expect(html.match(/<script src="https:\/\/inflight\.co\//g), path).toHaveLength(1);
      expect(html, path).not.toContain('rel="canonical"');
    }
  });

  test("leaves the widget off the public pages, and the review out of the sitemap", async ({ request }) => {
    for (const path of ["/", "/projects/shift-scheduling", "/playground/calchemy"]) {
      const response = await request.get(path);
      expect(robotsTag(response), path).not.toContain("nofollow");
      expect(await response.text(), path).not.toContain("inflight.co");
    }
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("/dive");
  });

  test("its projects open and close inside it, through Back and Forward", async ({ page, pageFailures }) => {
    await page.goto("/dive");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");

    const card = page.getByRole("link", { name: /^Shift scheduling:/ });
    await expect(card).toHaveAttribute("href", "/dive/projects/shift-scheduling");
    await card.click();
    const sheet = page.getByRole("dialog", { name: "Shift scheduling" });
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/dive\/projects\/shift-scheduling$/);

    await page.goBack();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page).toHaveURL(/\/dive$/);

    await page.goForward();
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/\/dive\/projects\/shift-scheduling$/);

    const next = sheet.getByRole("link", { name: /^Next/ });
    await expect(next).toHaveAttribute("href", "/dive/projects/onboarding");
    await next.click();
    await expect(page.getByRole("dialog", { name: "Company onboarding" })).toBeVisible();
    await expect(page).toHaveURL(/\/dive\/projects\/onboarding$/);

    expect(pageFailures).toEqual([]);
  });

  test("a project's own address opens on its sheet, which closes to the review's homepage", async ({
    page,
    pageFailures,
  }) => {
    const response = await page.goto("/dive/projects/onboarding");
    expect(response?.status()).toBe(200);
    const sheet = page.getByRole("dialog", { name: "Company onboarding" });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/dive$/);

    expect(pageFailures).toEqual([]);
  });

  test("a project whose sheet isn't ready is a 404 there too", async ({ page }) => {
    expect((await page.goto("/dive/projects/design-system"))?.status()).toBe(404);
  });
});
