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
  padding: "3xl",
  borderRadius: "md",
  textDecoration: "none",
  background: "bg.canvas",
  // Layered box-shadow instead of border (interface-design rule 10)
  boxShadow:
    "inset 0 0 0 1px var(--colors-border-divider), 0 1px 4px 0 color-mix(in srgb, var(--colors-neutral-700) 4%, transparent)",
  transition: "box-shadow 150ms ease",
  _dark: {
    boxShadow:
      "inset 0 0 0 1px var(--colors-border-divider), 0 1px 4px 0 color-mix(in srgb, var(--colors-neutral-900) 40%, transparent)",
  },
  _hover: {
    boxShadow:
      "inset 0 0 0 1px var(--colors-text-paragraph), 0 1px 4px 0 color-mix(in srgb, var(--colors-neutral-700) 4%, transparent)",
    _dark: {
      boxShadow:
        "inset 0 0 0 1px var(--colors-text-paragraph), 0 1px 4px 0 color-mix(in srgb, var(--colors-neutral-900) 40%, transparent)",
    },
  },
  _active: {
    transform: "scale(0.98)",
  },
});

const coverStyle = css({
  width: "full",
  aspectRatio: "16/9",
  borderRadius: "sm",
  background: "bg.surface",
  marginBottom: "sm",
  // Inset outline on images (interface-design rule 11)
  outline: "1px solid var(--colors-border-imageOutline)",
  outlineOffset: "-1px",
  objectFit: "cover",
});

interface ProjectCardProps {
  project: Post;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const description = extractDescription(project);

  return (
    <a href={`/work/${project.slug}`} className={cardStyle}>
      <div className={coverStyle} role="presentation" aria-hidden="true" />
      <Typography tag="h2" type="subheading">
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
