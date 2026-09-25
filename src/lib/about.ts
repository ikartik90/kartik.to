import { prisma } from "@/lib/prisma";
import { ABOUT_SLUG } from "@/data/page-slugs";
import { parsePost } from "@/lib/posts";
import type { Post } from "@/domain/post";

/** The About PAGE record, upserted as an unpublished draft; null if an article already owns the slug. */
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
