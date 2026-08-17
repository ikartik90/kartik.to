import { css } from "../../styled-system/css";
import { ProjectCard } from "./project-card";
import type { Post } from "@/domain/post";

const CARDS_CONTAINER_ALIGNMENT =
  "calc(token(spacing.xxl) + max(0px, calc((100% - token(sizes.articleContent)) / 2)))";
// scroll-padding % is relative to the container's own width (2×xxl wider than the containing block).
const SCROLL_PADDING =
  "calc(token(spacing.xxl) + max(0px, calc((100% - 2 * token(spacing.xxl) - token(sizes.articleContent)) / 2)))";

const scrollContainerStyle = css({
  display: "flex",
  alignItems: "flex-start",
  overflowX: "auto",
  overscrollBehaviorInline: "contain",
  scrollbarWidth: "none",
  scrollSnapType: "inline mandatory",
  scrollPaddingInline: SCROLL_PADDING,
  // Negates main's padding-inline-start; width spans full viewport.
  marginInlineStart: "calc(-1 * token(spacing.xxl))",
  width: "calc(100% + 2 * token(spacing.xxl))",
  paddingInline: CARDS_CONTAINER_ALIGNMENT,
});

const gridStyle = css({
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "token(sizes.listingCardWidth)",
  gap: "3xl",
  /* Room for the 1.5px focus ring — overflow-x: auto clips overflow on both axes */
  padding: "xs",
  // Odd cards snap in pairs; even cards join on ≤md for per-card snapping.
  "& > *:nth-child(odd)": {
    scrollSnapAlign: "start",
  },
  "& > *:nth-child(even)": {
    scrollSnapAlign: { base: "start", md: "none" },
  },
  "& > *:last-child": {
    scrollSnapAlign: "end",
  },
});

interface ProjectsSectionProps {
  projects: Post[];
}

export function ProjectsSection({ projects }: ProjectsSectionProps) {
  return (
    <section aria-label="Projects">
      <div className={scrollContainerStyle}>
        <div className={gridStyle}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}
