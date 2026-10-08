import { projectPath } from "@/app/_project-stacks/data";
import { projectMarkdown } from "@/app/_project-stacks/sheet-markdown";
import { SITE_URL } from "@/lib/site-url";

// Served at `/projects/<id>.md` through the rewrite in `next.config.ts`.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = projectMarkdown(id);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${SITE_URL}${projectPath(id)}>; rel="canonical"`,
    },
  });
}
