import { css } from "../../styled-system/css";
import { Typography } from "./ui/typography";
import type { Post } from "@/domain/post";

function extractDescription(post: Post): string {
  const firstParagraph = post.content.content.find(
    (n) => n.type === "paragraph",
  );
  if (!firstParagraph || firstParagraph.type !== "paragraph") return "";
  return firstParagraph.children
    .filter((n) => n.type === "text")
    .map((n) => n.text)
    .join("");
}

const cardStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
  textDecoration: "none",
  borderRadius: "token(spacing.lg)",
  _active: {
    transform: "scale(0.98)",
  },
});

const coverStyle = css({
  width: "full",
  aspectRatio: "16/9",
  borderRadius: "token(spacing.lg)",
  background: "bg.surface",
});

interface ProjectCardProps {
  project: Post;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const description = extractDescription(project);

  return (
    <a href={`/work/${project.slug}`} className={cardStyle}>
      <div className={coverStyle} role="presentation" aria-hidden="true" />
      <Typography tag="h2" type="bodyLarge">
        {project.title}
      </Typography>
      {description && (
        <Typography tag="p" type="caption">
          {description}
        </Typography>
      )}
    </a>
  );
}
