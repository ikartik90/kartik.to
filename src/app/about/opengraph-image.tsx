import { ABOUT_SLUG } from "@/data/page-slugs";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { postOgImage } from "@/lib/og/post-image";

// The same card an article gets — see `writing/[slug]/opengraph-image.tsx`.
export const dynamic = "force-dynamic";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "About card";

export default async function Image() {
  return postOgImage(ABOUT_SLUG, "PAGE");
}
