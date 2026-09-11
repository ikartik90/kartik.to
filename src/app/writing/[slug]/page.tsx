import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleIntro } from "@/components/article-intro";
import { ArticleRenderer } from "@/components/article-renderer";
import { SiteFooter } from "@/components/site-footer";
import { isAdmin } from "@/lib/auth/server";
import { postMetadata } from "@/lib/post-metadata";
import { resolvePost } from "@/lib/posts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await resolvePost(slug, "ARTICLE", { allowDraft: false });
  return postMetadata(article, `/writing/${slug}`, "Article");
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await resolvePost(slug, "ARTICLE", {
    allowDraft: await isAdmin(),
  });

  if (!article) notFound();

  return (
    <>
      <main>
        <article>
          <ArticleIntro title={article.title} />
          <ArticleRenderer content={article.content} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
