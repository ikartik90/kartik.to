import { PostCategorySchema } from "@/domain/post";
import { getPublishedPostsByCategory } from "@/lib/posts";
import { SITE_URL } from "@/lib/site-url";
import { llmsTxt } from "@/utils/site-index";
import { LISTED_PROJECTS } from "../_project-stacks/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const posts = await Promise.all(
    PostCategorySchema.options.map(getPublishedPostsByCategory),
  );
  return new Response(llmsTxt(posts.flat(), SITE_URL, LISTED_PROJECTS), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
