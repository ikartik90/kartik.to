import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { DocumentSchema, PostSchema } from "@/domain/post";
import { ArticleEditor } from "@/components/article-editor";
import { parseCategory } from "@/lib/posts";

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

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

  const raw = await prisma.post.findFirst({
    where: { slug, category },
  });

  if (!raw) notFound();

  const post = PostSchema.parse({
    ...raw,
    content: DocumentSchema.parse(raw.content),
  });

  return (
    <main>
      <article>
        <ArticleEditor initialPost={post} />
      </article>
    </main>
  );
}
