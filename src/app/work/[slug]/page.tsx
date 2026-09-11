import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleIntro } from "@/components/article-intro";
import { ArticleRenderer } from "@/components/article-renderer";
import { SiteFooter } from "@/components/site-footer";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/server";
import { postMetadata } from "@/lib/post-metadata";
import { resolvePost } from "@/lib/posts";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

async function isAdmin(): Promise<boolean> {
  const { data: session } = await auth.getSession();
  return session?.user?.email === env.ADMIN_GITHUB_ID;
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
        <article>
          <ArticleIntro title={project.title} />
          <ArticleRenderer content={project.content} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
