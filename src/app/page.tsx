import type { Metadata } from "next";
import { css } from "../../styled-system/css";
import { ArticleRenderer } from "@/components/article-renderer";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { TestimonialWall } from "@/components/testimonial-wall";
import { HomeGrid } from "@/components/home-grid";
import { IntroLinks } from "@/components/intro-links";
import { DEFAULT_HOME_DOCUMENT } from "@/data/home-document";
import { serverDemoSlots } from "@/components/demo/server-demos";
import { getPublishedTestimonials } from "@/app/actions/testimonial";
import { getGridCards } from "@/lib/grid";
import { getHomeDocument } from "@/lib/home";
import { isAboutPublished } from "@/lib/about";
import { SITE_URL } from "@/lib/site-url";
import { SITE_TITLE } from "@/data/site";
import { homeJsonLd } from "@/utils/structured-data";

// The homepage is a document, not a layout. It was three hardcoded sections —
// an intro, a project listing and a writing list — and folding the listings
// into one grid must not have cost the ability to write around it. So the page
// is an ordinary `PAGE` post whose content happens to include two pieces of
// furniture (`project_grid`, `social_links`), and everything else on it is
// text that can be edited like text anywhere else.

// Canonical here rather than in the root layout, which every page inherits: a
// layout-level canonical would name the homepage as the address of every page
// that does not state its own.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// The page's one heading, for screen readers and search engines. The document
// below is a grid of cards with no words of its own, so nothing on the page
// said whose it is; the visible design has no heading to give it.
const headingStyle = css({ srOnly: true });

export default async function Home() {
  const [document, cards, testimonials, aboutPublished] = await Promise.all([
    getHomeDocument(),
    getGridCards(),
    getPublishedTestimonials(),
    isAboutPublished(),
  ]);

  return (
    <>
      <main>
        <JsonLd data={homeJsonLd(SITE_URL)} />
        <h1 className={headingStyle}>{SITE_TITLE}</h1>
        {/* `article`, because the block styles the renderer relies on — the
            indent rule, the centring rule — are scoped to one. */}
        <article data-home>
          <ArticleRenderer
            content={document ?? DEFAULT_HOME_DOCUMENT}
            slots={{
              /* The demos the page can render itself go down with the cards, so
                 a card whose content is a database read arrives painted rather
                 than showing a progress bar while the browser goes and gets it.
                 See `serverDemoSlots` for which demos those are. */
              project_grid: (
                <HomeGrid cards={cards} demos={serverDemoSlots(cards)} />
              ),
              social_links: <IntroLinks aboutPublished={aboutPublished} />,
            }}
          />
        </article>
      </main>

      {/* BETWEEN THE DOCUMENT AND THE SKYLINE, and deliberately outside
          `<main>`: these are other people's words about the work rather than
          part of the page's own argument, and the document above is a post that
          can be edited like any other — a band of testimonials is not something
          it should be able to grow a second copy of.

          It renders nothing at all when nothing is published, which is the
          state every row starts in. The overlap onto the footer is the band's
          own business; see `TestimonialWall`. */}
      <TestimonialWall testimonials={testimonials} />

      <SiteFooter />
    </>
  );
}
