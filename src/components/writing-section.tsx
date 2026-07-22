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

const rowLinkStyle = css({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "xl",
  width: "full",
  paddingBlock: "xl",
  borderTopWidth: "token(spacing.3xs)",
  borderTopStyle: "solid",
  borderTopColor: "border.divider",
  textDecoration: "none",
  textStyle: "bodyLarge",
  color: "text.default",
  transition: "color 150ms ease",
  _hover: { color: "text.title" },
});

const dateStyle = css({
  textStyle: "caption",
  color: "inherit",
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
          <li key={article.id}>
            <a href={`/writing/${article.slug}`} className={rowLinkStyle}>
              <Typography tag="span" type="bodyLarge">
                {article.title}
              </Typography>
              {article.publishedAt && (
                <time
                  dateTime={article.publishedAt.toISOString()}
                  className={dateStyle}
                >
                  {formatDate(article.publishedAt)}
                </time>
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
