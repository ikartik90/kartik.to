import {
  expect,
  test,
  FIXTURE_ONLY_ARTICLE_SLUG,
  FIXTURE_ONLY_PROJECT_SLUG,
} from "./fixtures";
import type { Page } from "@playwright/test";
import { HOME_GRID } from "../src/data/home-grid";

const GRID_CARDS = (page: Page) =>
  page.getByRole("region", { name: HOME_GRID.heading }).getByRole("link");

test.describe("public routes", () => {
  test("the home page renders the project stack and the listing grid", async ({
    page,
    pageFailures,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(
      "Kartik Iyer: Product Designer, Engineer, Builder",
    );
    await expect(
      page.getByRole("heading", { level: 1, name: /Founding designer\s*who ships/ }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: /^At Spotwork/ })).toBeVisible();

    await expect(GRID_CARDS(page).first()).toBeVisible();

    expect(pageFailures).toEqual([]);
  });

  test("a card on the listing leads to a page that renders", async ({
    page,
    request,
    pageFailures,
  }) => {
    await page.goto("/");

    const card = GRID_CARDS(page).first();
    const href = (await card.getAttribute("href"))!;
    expect((await request.get(href)).status(), href).toBe(200);
    await card.click();

    // The shader playground moves on to its newest preset's address.
    await expect(page).toHaveURL(new RegExp(href));
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "404" })).toHaveCount(0);

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
    // CI draws WebGL in software, so the first frame can take about nine seconds.
    await expect(
      page.getByRole("complementary", { name: "Properties" }),
    ).toBeVisible({ timeout: 20_000 });
    expect(pageFailures).toEqual([]);
  });

  test("crawlers and agents can read the site", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const urls = await sitemap.text();
    expect(urls).toContain("<urlset");

    const llms = await request.get("/llms.txt");
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toMatch(/^# Kartik Iyer\n/);

    // The sitemap names the production host; the page's path is what the preview serves. A homepage project comes
    // first, and is there whatever is published.
    const page = urls.match(/<loc>[^<]*?(\/(?:projects|work|writing|prototype)\/[^<]+)<\/loc>/)?.[1];
    expect(page, "a page with a Markdown copy in the sitemap").toBeDefined();
    const markdown = await request.get(`${page}.md`);
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
