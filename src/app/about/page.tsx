import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleIntro } from "@/components/article-intro";
import { ArticleRenderer } from "@/components/article-renderer";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { ABOUT_SLUG } from "@/data/page-slugs";
import { ABOUT_TITLE } from "@/data/site";
import { isAdmin } from "@/lib/auth/server";
import { postMetadata } from "@/lib/post-metadata";
import { resolvePost } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { postJsonLd } from "@/utils/structured-data";

// The About page is an article in everything but its address: a `PAGE` post
// with the slug "about", written in the same editor (`/edit/about`) and read
// with the same intro and renderer as `/writing/:slug`. Until it is published
// it is a 404 for everyone but the author, who can read the draft here.

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = await resolvePost(ABOUT_SLUG, "PAGE", { allowDraft: false });
  return postMetadata(page, "/about", "About", { searchTitle: ABOUT_TITLE });
}

export default async function AboutPage() {
  const page = await resolvePost(ABOUT_SLUG, "PAGE", {
    allowDraft: await isAdmin(),
  });

  if (!page) notFound();

  return (
    <>
      <main>
        <JsonLd data={postJsonLd(page, SITE_URL)} />
        <article>
          <ArticleIntro title={page.title} />
          <ArticleRenderer content={page.content} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
