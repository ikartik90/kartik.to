import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth/server";
import { ArticleEditor } from "@/components/article-editor";
import { HomeGrid } from "@/components/home-grid";
import { IntroLinks } from "@/components/intro-links";
import { serverDemoSlots } from "@/components/demo/server-demos";
import { getGridCards, getGridShaderPresets } from "@/lib/grid";
import { getOrCreateHomePost } from "@/lib/home";

export default async function EditHomePage() {
  if (!(await isAdmin())) notFound();

  const [post, cards, shaderPresets] = await Promise.all([
    getOrCreateHomePost(),
    getGridCards(),
    getGridShaderPresets(),
  ]);

  return (
    <main>
      <article data-home>
        <ArticleEditor
          key={post.id}
          initialPost={post}
          showTitle={false}
          slots={{
            project_grid: (
              <HomeGrid
                cards={cards}
                demos={serverDemoSlots(cards)}
                shaderPresets={shaderPresets}
                editable
              />
            ),
            social_links: <IntroLinks />,
          }}
        />
      </article>
    </main>
  );
}
