import { IntroSection } from "@/components/intro-section";
import { ProjectsSection } from "@/components/projects-section";
import { WritingSection } from "@/components/writing-section";
import { articles } from "@/data/articles";
import { projects } from "@/data/projects";

export default function Home() {
  return (
    <main>
      <IntroSection />
      <ProjectsSection projects={projects} />
      <WritingSection articles={articles} />
    </main>
  );
}
