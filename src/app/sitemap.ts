import type { MetadataRoute } from "next";
import { PostCategorySchema } from "@/domain/post";
import { getPublishedPostsByCategory } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { sitemapEntries } from "@/utils/site-index";

// Dynamic, so a newly published post is listed without a redeploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await Promise.all(
    PostCategorySchema.options.map(getPublishedPostsByCategory),
  );
  return sitemapEntries(posts.flat(), SITE_URL);
}
