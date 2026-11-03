import { projectMarkdown } from "@/app/projects/_spotwork/project-markdown";
import { movedTo, projectPath } from "@/data/project-cards";
import { SITE_URL } from "@/lib/site-url";

// Served at `/projects/<id>.md` through the rewrite in `next.config.ts`.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const moved = movedTo(id);
  if (moved) return Response.redirect(`${SITE_URL}${projectPath(moved)}.md`, 308);
  const body = projectMarkdown(id);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${SITE_URL}${projectPath(id)}>; rel="canonical"`,
    },
  });
}
