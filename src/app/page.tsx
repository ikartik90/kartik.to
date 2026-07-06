import { IntroSection } from "@/components/intro-section";
import { ProjectsSection } from "@/components/projects-section";
import { WritingSection } from "@/components/writing-section";
import { articles } from "@/data/articles";
import { projects } from "@/data/projects";
import { getPublishedPostsByCategory, mergePosts } from "@/lib/posts";

export default async function Home() {
  const dbProjects = await getPublishedPostsByCategory("WORK");
  const mergedProjects = mergePosts(dbProjects, projects);

  const dbArticles = await getPublishedPostsByCategory("ARTICLE");
  const mergedArticles = mergePosts(dbArticles, articles);

  return (
    <>
      <main>
        <IntroSection />
        <ProjectsSection projects={mergedProjects} />
        <WritingSection articles={mergedArticles} />
      </main>
    </>
  );
}
