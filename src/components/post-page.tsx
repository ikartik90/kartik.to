import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArticleIntro } from "@/components/article-intro";
import { ArticleRenderer } from "@/components/article-renderer";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { POST_CATEGORIES } from "@/data/post-categories";
import type { PostCategory } from "@/domain/post";
import { isAdmin } from "@/lib/auth/server";
import { postMetadata } from "@/lib/post-metadata";
import { findMovedPostPath, resolvePost } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { getPostReadUrl } from "@/utils/post-urls";
import { postJsonLd } from "@/utils/structured-data";

/** The `generateMetadata` of a category's reading route. */
export async function postPageMetadata(
  category: PostCategory,
  slug: string,
): Promise<Metadata> {
  const post = await resolvePost(slug, category, { allowDraft: false });
  return postMetadata(
    post,
    getPostReadUrl(category, slug),
    POST_CATEGORIES[category].label,
  );
}

export async function PostPage({
  category,
  slug,
}: {
  category: PostCategory;
  slug: string;
}) {
  const allowDraft = await isAdmin();
  const post = await resolvePost(slug, category, { allowDraft });

  if (!post) {
    const moved = await findMovedPostPath(slug, category, { allowDraft });
    if (moved) permanentRedirect(moved);
    notFound();
  }

  return (
    <>
      <main>
        <JsonLd data={postJsonLd(post, SITE_URL)} />
        <article>
          <ArticleIntro title={post.title} />
          <ArticleRenderer content={post.content} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
