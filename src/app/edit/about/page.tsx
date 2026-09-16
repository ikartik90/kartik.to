import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";
import { getOrCreateAboutPost } from "@/lib/about";

// ---------------------------------------------------------------------------
// The About page, editable — the ordinary article editor on the `PAGE` post
// `/about` reads.
//
// Its own route rather than `/edit/[slug]` for the homepage's reason: that
// route needs a row to exist, and this one creates the About page's draft the
// first time it is opened (see `getOrCreateAboutPost`).
//
// A STATIC segment, so Next matches it ahead of `/edit/[slug]`.
// ---------------------------------------------------------------------------

export default async function EditAboutPage() {
  // 404, not 401 — the admin routes do not admit to existing.
  if (!(await isAdmin())) notFound();

  const post = await getOrCreateAboutPost();
  if (!post) notFound();

  return (
    <main>
      <article>
        <ArticleEditor key={post.id} initialPost={post} />
      </article>
    </main>
  );
}
