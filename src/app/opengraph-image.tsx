import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { siteOgImage } from "@/lib/og/post-image";
import { SITE_TITLE } from "@/data/site";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = SITE_TITLE;

export default async function Image() {
  return siteOgImage();
}
