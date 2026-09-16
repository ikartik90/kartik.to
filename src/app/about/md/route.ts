import { ABOUT_SLUG } from "@/data/page-slugs";
import { postMarkdownResponse } from "@/lib/post-markdown";

// Served at `/about.md` through the rewrite in `next.config.ts`.
export async function GET() {
  return postMarkdownResponse(ABOUT_SLUG, "PAGE");
}
