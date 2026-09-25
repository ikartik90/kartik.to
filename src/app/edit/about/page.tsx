import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";
import { getOrCreateAboutPost } from "@/lib/about";

export default async function EditAboutPage() {
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
