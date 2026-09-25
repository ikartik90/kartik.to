import type { PostCategory } from "@/domain/post";
import { findMovedPostPath, getPublishedPostBySlug } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { documentToMarkdown } from "@/utils/document-markdown";
import { getPostReadUrl } from "@/utils/post-urls";

/** A published post as Markdown for `/work|writing/<slug>.md`; `Link` names the HTML page as canonical. */
export async function postMarkdownResponse(
  slug: string,
  category: PostCategory,
): Promise<Response> {
  const post = await getPublishedPostBySlug(slug, category);
  if (!post) {
    // A moved post redirects to its copy at the new address.
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
