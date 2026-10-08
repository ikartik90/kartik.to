import { ArticleRenderer } from "@/components/article-renderer";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { TestimonialWall } from "@/components/testimonial-wall";
import { HomeGrid } from "@/components/home-grid";
import { HomeHero } from "@/components/home-hero";
import { IntroLinks } from "@/components/intro-links";
import { DEFAULT_HOME_DOCUMENT } from "@/data/home-document";
import { HOME_GRID } from "@/data/home-grid";
import { serverDemoSlots } from "@/components/demo/server-demos";
import { getPublishedTestimonials } from "@/app/actions/testimonial";
import { ProjectStacks } from "@/app/_project-stacks/project-stacks";
import { getGridCards } from "@/lib/grid";
import { getHomeDocument } from "@/lib/home";
import { SITE_URL } from "@/lib/site-url";
import { homeJsonLd } from "@/utils/structured-data";

/** `sheet`: a project whose sheet opens over the page, at its own address. */
export async function HomePage({ sheet }: { sheet?: string }) {
  const [document, cards, testimonials] = await Promise.all([
    getHomeDocument(),
    getGridCards(),
    getPublishedTestimonials(),
  ]);

  return (
    <>
      <main>
        <JsonLd data={homeJsonLd(SITE_URL)} />
        <HomeHero />
        <ProjectStacks id="work" sheet={sheet} />
        {/* Must be an `article`: the renderer's block styles are scoped to one. */}
        <article data-home>
          <ArticleRenderer
            content={document ?? DEFAULT_HOME_DOCUMENT}
            slots={{
              project_grid: (
                <HomeGrid
                  cards={cards}
                  demos={serverDemoSlots(cards)}
                  heading={HOME_GRID.heading}
                />
              ),
              social_links: <IntroLinks />,
            }}
          />
        </article>
      </main>

      <TestimonialWall testimonials={testimonials} />

      <SiteFooter />
    </>
  );
}
