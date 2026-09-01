import { css } from "../../styled-system/css";
import { ArticleRenderer } from "@/components/article-renderer";
import { HomeGrid } from "@/components/home-grid";
import { SocialLinks } from "@/components/social-links";
import { DEFAULT_HOME_DOCUMENT } from "@/data/home-document";
import { serverDemoSlots } from "@/components/demo/server-demos";
import { getGridCards } from "@/lib/grid";
import { getHomeDocument } from "@/lib/home";

// The homepage is a document, not a layout. It was three hardcoded sections —
// an intro, a project listing and a writing list — and folding the listings
// into one grid must not have cost the ability to write around it. So the page
// is an ordinary `PAGE` post whose content happens to include two pieces of
// furniture (`project_grid`, `social_links`), and everything else on it is
// text that can be edited like text anywhere else.

// The icon row is centred by its own box: `text-align` cannot reach the items
// of a flex container, so the centred paragraph above it does not carry here.
const socialRowStyle = css({ display: "flex", justifyContent: "center" });

export default async function Home() {
  const [document, cards] = await Promise.all([
    getHomeDocument(),
    getGridCards(),
  ]);

  return (
    <main>
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
            social_links: (
              <nav aria-label="Social links" className={socialRowStyle}>
                <SocialLinks />
              </nav>
            ),
          }}
        />
      </article>
    </main>
  );
}
