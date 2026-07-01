import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleRenderer } from "@/components/article-renderer";
import { Typography } from "@/components/ui/typography";
import { articles } from "@/data/articles";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { resolvePost } from "@/lib/posts";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await resolvePost(slug, "ARTICLE", {
    staticFallback: articles,
    allowDraft: false,
  });
  return { title: article?.title ?? "Article" };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await resolvePost(slug, "ARTICLE", {
    staticFallback: articles,
    allowDraft: await isAdmin(),
  });

  if (!article) notFound();

  return (
    <main>
      <article>
        {article.title && (
          <Typography tag="h1" type="title">
            {article.title}
          </Typography>
        )}
        <ArticleRenderer content={article.content} />
      </article>
    </main>
  );
}
