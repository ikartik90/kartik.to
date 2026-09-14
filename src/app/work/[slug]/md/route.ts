import { postMarkdownResponse } from "@/lib/post-markdown";

// Served at `/work/<slug>.md` through the rewrite in `next.config.ts`.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return postMarkdownResponse(slug, "WORK");
}
