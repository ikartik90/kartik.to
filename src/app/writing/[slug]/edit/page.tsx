import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { DocumentSchema, PostSchema } from "@/domain/post";
import { ArticleEditor } from "@/components/article-editor";

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function EditArticlePage({ params }: Props) {
  if (!(await isAdmin())) notFound();

  const { slug } = await params;

  const raw = await prisma.post.findUnique({ where: { slug } });

  // 404 if the post doesn't exist or is already published
  if (!raw || raw.publishedAt !== null) notFound();

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
