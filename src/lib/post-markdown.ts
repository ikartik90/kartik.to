import type { PostCategory } from "@/domain/post";
import { getPublishedPostBySlug } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { documentToMarkdown } from "@/utils/document-markdown";
import { getPostReadUrl } from "@/utils/post-urls";

/**
 * A published post as Markdown — the body of `/work/<slug>.md` and
 * `/writing/<slug>.md`, one handler for both the way `postOgImage` is one card
 * for both.
 *
 * The `Link` header names the HTML page as canonical, so a search engine that
 * finds this copy files it under the page rather than beside it.
 */
export async function postMarkdownResponse(
  slug: string,
  category: PostCategory,
): Promise<Response> {
  const post = await getPublishedPostBySlug(slug, category);
  if (!post) return new Response("Not found", { status: 404 });

  const body = documentToMarkdown(post.content, {
    title: post.title,
    origin: SITE_URL,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${SITE_URL}${getPostReadUrl(category, slug)}>; rel="canonical"`,
    },
  });
}
