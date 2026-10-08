import type { Metadata } from "next";
import { ArticleRenderer } from "@/components/article-renderer";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { TestimonialWall } from "@/components/testimonial-wall";
import { HomeGrid } from "@/components/home-grid";
import { HomeHero } from "@/components/home-hero";
import { IntroLinks } from "@/components/intro-links";
import { DEFAULT_HOME_DOCUMENT } from "@/data/home-document";
import { serverDemoSlots } from "@/components/demo/server-demos";
import { getPublishedTestimonials } from "@/app/actions/testimonial";
import { getGridCards } from "@/lib/grid";
import { getHomeDescription, getHomeDocument } from "@/lib/home";
import { homeMetadata } from "@/lib/post-metadata";
import { SITE_URL } from "@/lib/site-url";
import { homeJsonLd } from "@/utils/structured-data";
import { ProjectStacks } from "./_project-stacks/project-stacks";

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata(await getHomeDescription());
}

export default async function Home() {
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
        <ProjectStacks id="work" />
        {/* Must be an `article`: the renderer's block styles are scoped to one. */}
        <article data-home>
          <ArticleRenderer
            content={document ?? DEFAULT_HOME_DOCUMENT}
            slots={{
              project_grid: (
                <HomeGrid cards={cards} demos={serverDemoSlots(cards)} />
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
