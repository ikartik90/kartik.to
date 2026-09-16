import {
  expect,
  test,
  FIXTURE_ONLY_ARTICLE_SLUG,
  FIXTURE_ONLY_PROJECT_SLUG,
} from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Every card on the listing that points at a post — either kind.
 *
 * A function of the page rather than a module constant because a Playwright
 * locator is bound to the page it was built from.
 */
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
    // The header only renders on "/", so its presence doubles as a check that
    // the client-side `usePathname` branch hydrated. The name is the logo's
    // alt text now that nothing spells it out beside the picture — which is
    // also the assertion that would catch the alt going back to decorative
    // and taking the name off the page.
    await expect(page.getByAltText("Kartik Iyer")).toBeVisible();
    // ONE listing now, not two. Projects and articles share a single masonry
    // grid because a pin names an absolute seat, and "seat 3" means nothing
    // while there are two lists it might be seat 3 of. The grid draws no
    // heading, so the region's accessible name is what says it is there.
    await expect(page.getByRole("region", { name: "Work" })).toBeVisible();

    // Populated, rather than an exact count or a required mix of kinds. The
    // listing is the database's alone now, so what is ON it is a content
    // decision — the site currently publishes work and no writing, and a suite
    // that demanded one of each would be red for having nothing to say rather
    // than for a fault. That a card of EITHER kind is rendered is the part
    // that is about the code.
    await expect(POST_CARDS(page).first()).toBeVisible();

    expect(pageFailures).toEqual([]);
  });

  // Follows whatever the listing actually holds rather than a slug written
  // down here. Three tests used to name `css-anchor-positioning` and
  // `kartik-to` outright, which worked only because `src/data` was served as
  // real content; pinning a database slug in their place would buy the same
  // brittleness back, and go red the day that post is taken down to be edited.
  //
  // The card and its page agreeing is also a stronger claim than either alone:
  // it is the listing's href, followed, arriving somewhere that renders.
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
    // The 404 renders an `h1` of its own, so "a heading is visible" would pass
    // against exactly the failure this test exists to catch.
    await expect(heading).not.toHaveText("404");

    expect(pageFailures).toEqual([]);
  });

  // The other half of taking the seed posts off the site: they are still in
  // the tree, still importable by the playgrounds, and no longer reachable.
  // A regression here would not look like a crash — it would look like these
  // pages quietly coming back — so it is asserted rather than assumed.
  test("a slug only `src/data` knows is a 404", async ({ page }) => {
    for (const path of [
      `/writing/${FIXTURE_ONLY_ARTICLE_SLUG}`,
      `/work/${FIXTURE_ONLY_PROJECT_SLUG}`,
    ]) {
      expect((await page.goto(path))?.status(), path).toBe(404);
    }
  });

  // The playground used to live at `/edit/card-studio` behind the stealth gate,
  // where an anonymous request got a 404. It writes nothing, so it is public
  // now — and 200-for-anonymous is the whole of that change, which makes this
  // the test that would catch the gate creeping back over it.
  test("the shader playground is public", async ({ page, pageFailures }) => {
    const response = await page.goto("/playground/shader");

    expect(response?.status()).toBe(200);
    // Its own name AND the author's, because the root layout titles every page
    // below it through a `%s — Kartik Iyer` template. The homepage is the one
    // exception and keeps its own title (`title.default`), which is what the
    // listing test above asserts — so the two together are what would catch
    // the template being dropped or reaching one page too far.
    await expect(page).toHaveTitle("Waveform Studio — Kartik Iyer");
    // The rail, which is the page — asserting it rules out an interstitial
    // that also answers 200: Vercel's own deployment-protection login is one,
    // and an earlier CI run went green against exactly that.
    await expect(
      page.getByRole("complementary", { name: "Properties" }),
    ).toBeVisible();
    expect(pageFailures).toEqual([]);
  });

  // What search engines and AI agents read instead of the page. Each is built
  // from the database per request, so this is the check that they build on the
  // deployment and not only in a unit test's mocks.
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

    // A published post's Markdown copy, found from the listing like the card
    // test above rather than from a slug written down here.
    await page.goto("/");
    const href = await POST_CARDS(page).first().getAttribute("href");
    const markdown = await request.get(`${href}.md`);
    expect(markdown.status()).toBe(200);
    expect(markdown.headers()["content-type"]).toContain("text/markdown");
    expect((await markdown.text()).trim()).not.toBe("");
  });

  // Reached the way a visitor reaches it — the homepage only links to About
  // once it is published, so an unpublished page skips rather than fails.
  test("the About page is titled and described for search", async ({ page }) => {
    await page.goto("/");
    const link = page.locator('a[href="/about"]').first();
    test.skip((await link.count()) === 0, "About is not published");

    await page.goto("/about");
    // The tab and the result say who it is about; the heading stays the post's.
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
