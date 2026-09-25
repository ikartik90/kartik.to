import { OG_SIZE, renderAvatarOgCard, renderOgCard } from "@/lib/og/card";
import { resolvePost } from "@/lib/posts";
import { ogCard } from "@/utils/og-card";
import type { PostCategory } from "@/domain/post";

// Published posts only: this route has no session, so it must never serve a draft.

/** Never throws: a failed card falls back to one without the cover, then to the site's card. */
export async function postOgImage(slug: string, category: PostCategory) {
  const post = await resolvePost(slug, category, { allowDraft: false });
  if (!post) return siteOgImage();

  try {
    return await renderOgCard(ogCard(post));
  } catch (error) {
    console.error(`[og] ${category} ${slug} — card failed to draw`, error);
    try {
      return await renderOgCard({ ...ogCard(post), cover: null, scrim: false });
    } catch {
      return siteOgImage();
    }
  }
}

export async function siteOgImage() {
  return renderAvatarOgCard();
}

export { OG_SIZE };
