import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/card";
import { postOgImage } from "@/lib/og/post-image";

// The page is `force-dynamic` because a project can be edited and republished
// at any moment; its picture is the same card and must not be a build artefact
// that goes on showing last week's title.
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
