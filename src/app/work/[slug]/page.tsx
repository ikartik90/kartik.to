import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleIntro } from "@/components/article-intro";
import { ArticleRenderer } from "@/components/article-renderer";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { isAdmin } from "@/lib/auth/server";
import { postMetadata } from "@/lib/post-metadata";
import { resolvePost } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { postJsonLd } from "@/utils/structured-data";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await resolvePost(slug, "WORK", { allowDraft: false });
  return postMetadata(project, `/work/${slug}`, "Project");
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = await resolvePost(slug, "WORK", {
    allowDraft: await isAdmin(),
  });

  if (!project) notFound();

  return (
    <>
      <main>
        <JsonLd data={postJsonLd(project, SITE_URL)} />
        <article>
          <ArticleIntro title={project.title} />
          <ArticleRenderer content={project.content} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
