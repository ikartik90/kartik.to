import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// No `Disallow: /edit`: robots.txt is public, and naming the route would advertise it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
