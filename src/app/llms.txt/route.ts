import { PostCategorySchema } from "@/domain/post";
import { getPublishedPostsByCategory } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { llmsTxt } from "@/utils/site-index";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await Promise.all(
    PostCategorySchema.options.map(getPublishedPostsByCategory),
  );
  return new Response(llmsTxt(posts.flat(), SITE_URL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
