import { OG_SIZE, renderOgCard } from "@/lib/og/card";
import { resolvePost } from "@/lib/posts";
import { ogCard } from "@/utils/og-card";
import type { PostCategory } from "@/domain/post";

// ---------------------------------------------------------------------------
// The Open Graph image for one post — the half of it that is the same for an
// article and a project.
//
// The two route files are three lines each and differ only in which category
// they look the slug up under, which is the only thing about them that IS
// different: `/writing/x` and `/work/x` are separate namespaces, and a project
// must not be served the article of the same name.
//
// PUBLISHED ONLY, never a draft. This route has no session — a crawler brings
// no cookie — so there is nobody to authorise, and an image route that served
// unpublished work to anyone who guessed a slug would be a hole in the same
// wall the pages are behind.
// ---------------------------------------------------------------------------

/**
 * Never throws, and that is the contract this exists for.
 *
 * The picture is composed from a document somebody wrote: a cover whose host
 * is down, a format Satori's decoder does not know, a font that would not read.
 * Any of those is a 500 on `og:image`, and a 500 there is the whole link
 * preview gone — which is the failure this feature was built to fix. So the
 * card is attempted, and a failure falls back to the site's own image, which
 * needs nothing but a font.
 */
export async function postOgImage(slug: string, category: PostCategory) {
  const post = await resolvePost(slug, category, { allowDraft: false });
  if (!post) return siteOgImage();

  try {
    return await renderOgCard(ogCard(post));
  } catch (error) {
    // Said out loud, once. A silent fallback is a card that quietly stops
    // being the post's card and gives nobody anything to go on.
    console.error(`[og] ${category} ${slug} — card failed to draw`, error);
    // Without the cover this time. Whatever failed, the picture is the part
    // this route does not control, and a card with the post's name on a plain
    // ground is still the post's card.
    try {
      return await renderOgCard({ ...ogCard(post), cover: null, scrim: false });
    } catch {
      return siteOgImage();
    }
  }
}

/** The site's own card, for the homepage and for anything that would not draw. */
export async function siteOgImage() {
  return renderOgCard({
    title: "kartik.to",
    meta: "Design engineering",
    tone: "dark",
    scrim: false,
    cover: null,
  });
}

export { OG_SIZE };
