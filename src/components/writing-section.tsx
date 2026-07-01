import { css } from "../../styled-system/css";
import { Typography } from "./ui/typography";
import type { Post } from "@/domain/post";

const sectionStyle = css({
  maxWidth: "articleContent",
  marginInline: "auto",
  width: "token(spacing.full)",
});

const sectionLabelStyle = css({
  textStyle: "caption",
  color: "text.default",
  marginBottom: "3xl",
});

const listStyle = css({
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
});

const listItemStyle = css({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "xl",
  paddingBlock: "xl",
  borderBottom: "none",
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "border.divider",
});

const articleLinkStyle = css({
  textStyle: "paragraph",
  color: "text.default",
  transition: "color 150ms ease",
  _hover: { color: "text.title" },
});

const dateStyle = css({
  textStyle: "caption",
  color: "text.default",
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
});

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface WritingSectionProps {
  articles: Post[];
}

export function WritingSection({ articles }: WritingSectionProps) {
  return (
    <section className={sectionStyle}>
      <p className={sectionLabelStyle}>Writing</p>
      <ul className={listStyle}>
        {articles.map((article) => (
          <li key={article.id} className={listItemStyle}>
            <a href={`/writing/${article.slug}`} className={articleLinkStyle}>
              <Typography tag="span" type="paragraph">
                {article.title}
              </Typography>
            </a>
            {article.publishedAt && (
              <time
                dateTime={article.publishedAt.toISOString()}
                className={dateStyle}
              >
                {formatDate(article.publishedAt)}
              </time>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
