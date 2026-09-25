import {
  expect,
  test,
  FIXTURE_ONLY_ARTICLE_SLUG,
  FIXTURE_ONLY_PROJECT_SLUG,
} from "./fixtures";
import type { Page } from "@playwright/test";

const POST_CARDS = (page: Page) =>
  page.locator(`a[href^="/work/"], a[href^="/writing/"]`);

test.describe("public routes", () => {
  test("the home page renders the listing grid", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(
      "Kartik Iyer: Product Designer, Engineer, Builder",
    );
    await expect(page.getByAltText("Kartik Iyer")).toBeVisible();
    await expect(page.getByRole("region", { name: "Work" })).toBeVisible();

    await expect(POST_CARDS(page).first()).toBeVisible();

    expect(pageFailures).toEqual([]);
  });

  test("a card on the listing leads to a page that renders", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    const card = POST_CARDS(page).first();
    const href = await card.getAttribute("href");
    await card.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    // The 404 page renders an `h1` too.
    await expect(heading).not.toHaveText("404");

    expect(pageFailures).toEqual([]);
  });

  test("a slug only `src/data` knows is a 404", async ({ page }) => {
    for (const path of [
      `/writing/${FIXTURE_ONLY_ARTICLE_SLUG}`,
      `/work/${FIXTURE_ONLY_PROJECT_SLUG}`,
    ]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });

  test("the shader playground is public", async ({ page, pageFailures }) => {
    const response = await page.goto("/playground/shader");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("Waveform Studio — Kartik Iyer");
    // Rules out a 200 interstitial such as Vercel's deployment-protection login.
    await expect(
      page.getByRole("complementary", { name: "Properties" }),
    ).toBeVisible();
    expect(pageFailures).toEqual([]);
  });

  test("crawlers and agents can read the site", async ({ page, request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");

    const llms = await request.get("/llms.txt");
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toMatch(/^# Kartik Iyer\n/);

    await page.goto("/");
    const href = await POST_CARDS(page).first().getAttribute("href");
    const markdown = await request.get(`${href}.md`);
    expect(markdown.status()).toBe(200);
    expect(markdown.headers()["content-type"]).toContain("text/markdown");
    expect((await markdown.text()).trim()).not.toBe("");
  });

  test("the About page is titled and described for search", async ({ page }) => {
    await page.goto("/");
    const link = page.locator('a[href="/about"]').first();
    test.skip((await link.count()) === 0, "About is not published");

    await page.goto("/about");
    await expect(page).toHaveTitle(
      "About Kartik Iyer — Product Designer & Design Engineer in Toronto",
    );
    const graph = JSON.parse(
      (await page
        .locator('script[type="application/ld+json"]')
        .textContent()) ?? "{}",
    )["@graph"] as { "@type": string; alternateName?: string }[];
    expect(graph.map((node) => node["@type"])).toContain("AboutPage");
    expect(graph.find((node) => node["@type"] === "Person")?.alternateName).toBe(
      "Shanker Kartik Iyer",
    );
  });

  test("an unknown slug 404s rather than erroring", async ({ page }) => {
    const response = await page.goto("/writing/no-such-article-exists");
    expect(response?.status()).toBe(404);
  });
});
