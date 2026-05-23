import { css } from "../../styled-system/css";
import { ProjectCard } from "./project-card";
import type { Post } from "@/domain/post";

const sectionLabelStyle = css({
  textStyle: "caption",
  color: "text.default",
  marginBottom: "3xl",
});

const gridStyle = css({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "xl",
  md: {
    gridTemplateColumns: "repeat(2, 1fr)",
  },
  lg: {
    gridTemplateColumns: "repeat(3, 1fr)",
  },
});

interface ProjectsSectionProps {
  projects: Post[];
}

export function ProjectsSection({ projects }: ProjectsSectionProps) {
  return (
    <section>
      <p className={sectionLabelStyle}>Projects</p>
      <div className={gridStyle}>
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
