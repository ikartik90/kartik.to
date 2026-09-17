import { prisma } from "@/lib/prisma";
import { ABOUT_SLUG } from "@/data/page-slugs";
import { parsePost } from "@/lib/posts";
import type { Post } from "@/domain/post";

/**
 * The About page's record, created as an empty draft if it has none yet.
 *
 * The homepage's pattern (`getOrCreateHomePost`): an upsert on the unique slug,
 * idempotent on every load of `/edit/about`. It is needed at all because a
 * post's slug is fixed when it is created, from the title, and there is no
 * other way to mint a PAGE whose slug is "about".
 *
 * Unpublished on creation, unlike the homepage: `/about` has nothing to say
 * until it is written, so it stays a 404 for visitors until it is published.
 *
 * Null when the slug is already owned by a post that is not a PAGE — an article
 * titled "About" — so the edit route 404s rather than opening that article as
 * the About page.
 */
export async function getOrCreateAboutPost(): Promise<Post | null> {
  const row = await prisma.post.upsert({
    where: { slug: ABOUT_SLUG },
    update: {},
    create: {
      slug: ABOUT_SLUG,
      category: "PAGE",
      title: "About",
      content: { type: "doc", content: [] },
      publishedAt: null,
    },
  });
  return row.category === "PAGE" ? parsePost(row) : null;
}
