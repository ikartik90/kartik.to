import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Everything is open to every crawler — search engines and AI agents alike —
// and the sitemap says what is worth reading.
//
// No `Disallow` for the admin surface, deliberately: a robots.txt is public,
// and naming `/edit` in it would advertise the route it exists to hide. Those
// pages answer anyone who is not the author with a 404, which is all a crawler
// needs to be told.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
