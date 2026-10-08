import { css } from "../../../styled-system/css";
import { articleHeadingShell } from "../../../styled-system/recipes";
import { ArticleRenderer } from "@/components/article-renderer";
import { Typography } from "@/components/ui/typography";
import type { BlockNode, InlineNode } from "@/domain/nodes";
import { MetricCard, type Metric } from "./metric-card";

// A sheet's content: the site's article, each section a caption and a statement over a line or two of prose.

export const articleStyle = css({
  gap: "4xl",
  "& > :first-child": { marginBlockStart: 0 },
  mdDown: { gap: "3xl" },
});

// A section at the sheet's width, its words on the sheet's left edge at the column's measure, its line closer to its
// heading than its grid of features or cards is. `data-bleed` takes it out past the content's padding to the sheet's
// edges.
export const wideSectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
  width: "token(spacing.full)",
  alignItems: "flex-start",
  "& > *": { width: "min(100%, token(sizes.articleContent))" },
  "&[data-bleed]": {
    width: "calc(100% + 2 * token(spacing.3xl))",
    marginInline: "calc(-1 * token(spacing.3xl))",
    mdDown: { width: "calc(100% + 2 * token(spacing.xl))", marginInline: "calc(-1 * token(spacing.xl))" },
  },
  "& > :is([data-count], [data-take])": { width: "token(spacing.full)" },
  "& > [data-count]": { marginBlockStart: "calc(token(spacing.3xl) - token(spacing.md))" },
});
// Twice the article's gap from the section before, or after.
export const roomAboveStyle = css({ marginBlockStart: "4xl", mdDown: { marginBlockStart: "3xl" } });
export const roomBelowStyle = css({ marginBlockEnd: "4xl", mdDown: { marginBlockEnd: "3xl" } });

// The North Star, across the whole sheet (out past the content's padding) under a rule, its statement centred at the
// column's measure; on a phone, to the left, as the cards under it, and only the article's gap below.
const edgeInk = "color-mix(in srgb, token(colors.border.divider) 50%, transparent)";
export const bandStyle = css({
  position: "relative",
  isolation: "isolate",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "xl",
  textAlign: "center",
  width: "calc(100% + 2 * token(spacing.3xl))",
  marginInline: "calc(-1 * token(spacing.3xl))",
  // Twice the article's gap from the sections either side.
  marginBlock: "4xl",
  // As far below the rule as the section before is above it.
  paddingInline: "3xl",
  paddingBlockStart: "5xl",
  paddingBlockEnd: 0,
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: edgeInk,
  mdDown: {
    width: "calc(100% + 2 * token(spacing.xl))",
    marginInline: "calc(-1 * token(spacing.xl))",
    marginBlockStart: "3xl",
    marginBlockEnd: 0,
    paddingInline: "xl",
    paddingBlockStart: "calc(2 * token(spacing.3xl))",
    alignItems: "flex-start",
    textAlign: "start",
  },
  "& > *": { width: "min(100%, token(sizes.articleContent))" },
});

// The outcomes card, out past the content's padding to the sheet's edges, under its own rule as the North Star's;
// the takeaways after it start at its foot, its own room below theirs.
export const closingCardStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  width: "calc(100% + 2 * token(spacing.3xl))",
  marginInline: "calc(-1 * token(spacing.3xl))",
  marginBlockEnd: "calc(-1 * token(spacing.4xl))",
  borderBlockStartWidth: "token(spacing.xxs)",
  borderBlockStartStyle: "solid",
  borderBlockStartColor: edgeInk,
  mdDown: {
    width: "calc(100% + 2 * token(spacing.xl))",
    marginInline: "calc(-1 * token(spacing.xl))",
    marginBlockEnd: "calc(-1 * token(spacing.3xl))",
  },
});

// From `md`, the heading in the left third and a paragraph in each of the others, the x-heights of their first lines
// level.
const takeawaysStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "md",
  width: "token(spacing.full)",
  md: {
    paddingBlockStart: "4xl",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    columnGap: "3xl",
    rowGap: "sm",
    alignItems: "start",
    "& > :first-child": { display: "contents" },
    "& > :first-child > :first-child": { gridColumn: "1 / -1" },
    "@supports (text-box: trim-start ex alphabetic)": {
      "& h3, & > p": { textBox: "trim-start ex alphabetic" },
      // The room trimmed off the heading, back under the eyebrow: a blank line of the heading's to its baseline, less
      // its x-height.
      "& > :first-child > :first-child::after": {
        content: '"\\200B"',
        display: "block",
        textStyle: "subheading",
        textBox: "trim-end text alphabetic",
        marginBlockEnd: "-1ex",
      },
    },
  },
});
// Justified beside the heading, from `md`, and not `pretty` there: it leaves lines short for justifying to stretch into
// gaps.
const takeawayStyle = css({
  textStyle: "bodyLarge",
  color: "text.body",
  textWrap: "pretty",
  md: { textAlign: "justify", textWrap: "wrap" },
});
// The article's caption above a statement, in the brand colour; its own recipe draws it in a gradient.
const captionStyle = css({ textStyle: "caption", color: "text.highlight" });

/** Prose: `*`s mark what's highlighted. */
function runs(text: string): InlineNode[] {
  return text
    .split("*")
    .map((part, i): InlineNode => (i % 2 ? { type: "text", text: part, marks: [{ type: "highlight" }] } : { type: "text", text: part }))
    .filter((node) => node.text);
}

export const paragraph = (text: string): BlockNode => ({ type: "paragraph", children: runs(text) });

export function Prose({ text }: { text: string }) {
  return <ArticleRenderer content={{ type: "doc", content: [paragraph(text)] }} />;
}

export function Head({ caption, children, large }: { caption: string; children: string; large?: boolean }) {
  return (
    <div className={articleHeadingShell()}>
      <span className={captionStyle}>{caption}</span>
      <Typography tag="h3" type={large ? "subheadingLarge" : "subheading"}>
        {children}
      </Typography>
    </div>
  );
}

/** The outcome on a card across the sheet, then what it taught. */
export function Closing({
  outcome,
  takeaway,
}: {
  outcome: Metric;
  takeaway: { eyebrow: string; heading: string; paragraphs: string[] };
}) {
  return (
    <>
      <div className={closingCardStyle} data-sheet-band="" data-sheet-step="">
        <MetricCard metric={outcome} variant="brand" landscape />
      </div>
      <section className={takeawaysStyle} data-sheet-step="">
        <Head caption={takeaway.eyebrow}>{takeaway.heading}</Head>
        {takeaway.paragraphs.map((text) => (
          <p key={text} className={takeawayStyle}>
            {text}
          </p>
        ))}
      </section>
    </>
  );
}
