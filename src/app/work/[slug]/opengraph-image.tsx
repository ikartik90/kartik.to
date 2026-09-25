import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { postOgImage } from "@/lib/og/post-image";

// Dynamic: a republished project must not keep an old card.
export const dynamic = "force-dynamic";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "Project card";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return postOgImage(slug, "WORK");
}
