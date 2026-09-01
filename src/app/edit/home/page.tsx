import { notFound } from "next/navigation";
import { css } from "../../../../styled-system/css";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";
import { HomeGrid } from "@/components/home-grid";
import { SocialLinks } from "@/components/social-links";
import { serverDemoSlots } from "@/components/demo/server-demos";
import { getGridCards } from "@/lib/grid";
import { getOrCreateHomePost } from "@/lib/home";

// ---------------------------------------------------------------------------
// The homepage, editable — the grid's `/edit/:slug`, and the whole page's.
//
// A real route rather than a mode toggled in place, because that is how every
// other editable thing here works: you go somewhere to edit and you come back
// when you are done. It also means the page can be linked, reloaded into, and
// left with the back button.
//
// The SAME editor an article gets, because the homepage is a document: the
// text around the grid is ordinary paragraphs, editable the ordinary way. The
// grid and the icon row are furniture blocks, and the two things the editor
// cannot build for itself are handed to it here — the grid because it is
// assembled from two database tables, and in its editable form because only
// this route is allowed to hand one out.
//
// `home` as the slug, and only here: the page itself stays at `/`. An edit URL
// may name what it edits; a reading URL may not.
//
// A STATIC segment, so Next matches it ahead of `/edit/[slug]`.
// ---------------------------------------------------------------------------

const socialRowStyle = css({ display: "flex", justifyContent: "center" });

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

export default async function EditHomePage() {
  // 404, not 401 — the admin routes do not admit to existing.
  if (!(await isAdmin())) notFound();

  const [post, cards] = await Promise.all([
    getOrCreateHomePost(),
    getGridCards(),
  ]);

  return (
    <main>
      <article data-home>
        <ArticleEditor
          key={post.id}
          initialPost={post}
          showTitle={false}
          slots={{
            /* The same server-rendered demos the public grid gets. A card
               inserted during THIS edit has no node here and cannot — it does
               not exist until the layout is saved — and falls back to the
               browser loader on its own. */
            project_grid: (
              <HomeGrid cards={cards} demos={serverDemoSlots(cards)} editable />
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
