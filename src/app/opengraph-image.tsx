import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { siteOgImage } from "@/lib/og/post-image";

// The site's own card — what a link to the homepage turns into, and what every
// page with nothing more specific to say inherits.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "kartik.to — Kartik Iyer's design portfolio and blog";

export default async function Image() {
  return siteOgImage();
}
