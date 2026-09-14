import type { MetadataRoute } from "next";
import { getPublishedPostsByCategory } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { sitemapEntries } from "@/utils/site-index";

// Read on every request, like the posts it lists: a sitemap cached at build
// would leave a newly published post out of it until the next deploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await Promise.all(
    (["PAGE", "WORK", "ARTICLE"] as const).map(getPublishedPostsByCategory),
  );
  return sitemapEntries(posts.flat(), SITE_URL);
}
