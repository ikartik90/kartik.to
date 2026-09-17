import type { PostCategory } from "@/domain/post";
import { findMovedPostPath, getPublishedPostBySlug } from "@/lib/posts";
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
  if (!post) {
    // The page's own rule, for the copy of it: an address the post has left
    // sends the agent on to the copy at the new one.
    const moved = await findMovedPostPath(slug, category, {
      allowDraft: false,
    });
    return moved
      ? Response.redirect(`${SITE_URL}${moved}.md`, 308)
      : new Response("Not found", { status: 404 });
  }

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
