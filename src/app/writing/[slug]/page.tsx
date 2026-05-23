import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleRenderer } from "@/components/article-renderer";
import { Typography } from "@/components/ui/typography";
import { articles } from "@/data/articles";
import { prisma } from "@/lib/prisma";
import { DocumentSchema, PostSchema, type Post } from "@/domain/post";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

async function getPublishedPost(slug: string): Promise<Post | null> {
  try {
    const raw = await prisma.post.findFirst({
      where: { slug, publishedAt: { not: null } },
    });
    if (!raw) return null;
    return PostSchema.parse({ ...raw, content: DocumentSchema.parse(raw.content) });
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dbPost = await getPublishedPost(slug);
  if (dbPost) return { title: dbPost.title ?? "Article" };
  const article = articles.find((a) => a.slug === slug);
  return { title: article?.title ?? "Article" };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;

  // Check DB first for dynamically published articles
  const dbPost = await getPublishedPost(slug);
  const article = dbPost ?? articles.find((a) => a.slug === slug);

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
