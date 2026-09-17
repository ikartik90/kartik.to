import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { ArticleEditor } from "@/components/article-editor";
import { parseCategory, parsePost } from "@/lib/posts";
import { getEditUrl } from "@/utils/post-urls";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}

export default async function EditPostPage({ params, searchParams }: Props) {
  if (!(await isAdmin())) notFound();

  const { slug } = await params;
  const { category: categoryParam } = await searchParams;
  const category = parseCategory(categoryParam);
  if (!category) notFound();

  // By slug alone: it is unique across categories. The category in the
  // address is what the post was filed under when the link was made, and the
  // metadata sidebar can have moved it since — an editor left open in another
  // tab is sent on to where the post is now, rather than to a 404.
  const raw = await prisma.post.findUnique({ where: { slug } });
  if (!raw) notFound();
  if (raw.category !== category) redirect(getEditUrl(raw.category, slug));

  const post = parsePost(raw);

  return (
    <main>
      <article>
        <ArticleEditor key={post.id} initialPost={post} />
      </article>
    </main>
  );
}
