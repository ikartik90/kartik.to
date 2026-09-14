import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { siteOgImage } from "@/lib/og/post-image";
import { SITE_TITLE } from "@/data/site";

// The site's own card — what a link to the homepage turns into, and what every
// page with nothing more specific to say inherits.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = SITE_TITLE;

export default async function Image() {
  return siteOgImage();
}
