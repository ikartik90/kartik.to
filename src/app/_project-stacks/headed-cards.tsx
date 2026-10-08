import type { ReactNode } from "react";
import { css } from "../../../styled-system/css";
import { Dots } from "./dots";
import { Marked } from "./marked";

// Rows of a heading over paragraphs beside a live graphic on a dotted card, the graphic on alternate sides, each out to
// the sheet's edge on its side; on a phone, the graphic between the heading and its paragraphs, across the sheet.

export interface HeadedCard {
  title: string;
  /** Paragraphs split on blank lines; `*`s mark what's highlighted. */
  text: string;
  graphic: ReactNode;
}

// The metric card's frame and dotted ground.
export const cardStyle = css({
  position: "relative",
  isolation: "isolate",
  borderRadius: "lg",
  boxShadow: "inset 0 0 0 token(spacing.xxs) color-mix(in srgb, token(colors.neutral.500) 25%, transparent)",
});

// The frame's rules, in the sheet's own edge colour (`Frame` in sheet-card.tsx): above and below, and on the side away
// from the sheet's edge.
const edgeInk = "color-mix(in srgb, token(colors.border.divider) 50%, transparent)";
const edgeRules = (away: "left" | "right") =>
  [
    `inset 0 token(spacing.xxs) 0 0 ${edgeInk}`,
    `inset 0 calc(-1 * token(spacing.xxs)) 0 0 ${edgeInk}`,
    away === "right" ? `inset calc(-1 * token(spacing.xxs)) 0 0 0 ${edgeInk}` : `inset token(spacing.xxs) 0 0 0 ${edgeInk}`,
  ].join(", ");
const openRules = `inset 0 token(spacing.xxs) 0 0 ${edgeInk}, inset 0 calc(-1 * token(spacing.xxs)) 0 0 ${edgeInk}`;

// Out to the sheet's edge on its side, square and open there, as its dots are; on a phone, out to both, square.
const graphicStyle = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "xl",
  aspectRatio: "4 / 3",
  padding: "3xl",
  overflow: "hidden",
  // Its rules over whatever fills it.
  "&::after": {
    content: '""',
    position: "absolute",
    zIndex: 3,
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
  },
  "[data-flip] > &": {
    borderStartStartRadius: 0,
    borderEndStartRadius: 0,
    boxShadow: "none",
    "&::after": { boxShadow: edgeRules("right") },
    "& > [data-inset]": { left: 0, borderStartStartRadius: 0, borderEndStartRadius: 0, mdDown: { right: 0, borderRadius: 0 } },
  },
  ":not([data-flip]) > &": {
    borderStartEndRadius: 0,
    borderEndEndRadius: 0,
    boxShadow: "none",
    "&::after": { boxShadow: edgeRules("left") },
    "& > [data-inset]": { right: 0, borderStartEndRadius: 0, borderEndEndRadius: 0, mdDown: { left: 0, borderRadius: 0 } },
  },
  mdDown: {
    aspectRatio: "1",
    paddingBlock: "3xl",
    paddingInline: "xl",
    gap: "lg",
    "[data-flip] > &": { borderRadius: 0, "&::after": { boxShadow: openRules } },
    ":not([data-flip]) > &": { borderRadius: 0, "&::after": { boxShadow: openRules } },
  },
});

// Across a section out at the sheet's edges (`data-bleed`), the words at its margin on the side at its edge.
const rowsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "5xl",
  width: "token(spacing.full)",
  textAlign: "start",
  mdDown: { gap: "3xl" },
});
// From `md`, two fifths of words beside three of graphic; on a phone, the graphic between the heading and its
// paragraphs, which keep the sheet's margin.
const rowStyle = css({
  display: "grid",
  gridTemplateColumns: "2fr 3fr",
  gap: "4xl",
  alignItems: "start",
  "& > :first-child": { paddingInlineStart: "3xl" },
  "&[data-flip]": { gridTemplateColumns: "3fr 2fr" },
  "&[data-flip] > :first-child": { order: 2, paddingInlineStart: 0, paddingInlineEnd: "3xl" },
  mdDown: {
    gridTemplateColumns: "1fr !important",
    gap: "xl",
    "& > :first-child": { order: "0 !important", display: "contents" },
    "& > :first-child > *": { paddingInline: "xl" },
    "& > :first-child > p": { order: 1 },
  },
});
const wordsStyle = css({ display: "flex", flexDirection: "column", gap: "md" });
const headingStyle = css({ textStyle: "quote", color: "text.title", textWrap: "balance" });
const paragraphStyle = css({
  textStyle: "bodyLarge",
  color: "text.body",
  textWrap: "pretty",
  // As far apart as an article's paragraphs (`article` in globals.css).
  "& + &": { marginBlockStart: "calc(token(spacing.xl) - token(spacing.md))", mdDown: { marginBlockStart: 0 } },
});

/** `pictureFirst` puts the first row's graphic on the left, and every other row's after it. */
export function HeadedCards({ rows, pictureFirst = true }: { rows: HeadedCard[]; pictureFirst?: boolean }) {
  return (
    <div className={rowsStyle} data-take="rows">
      {rows.map(({ title, text, graphic }, i) => (
        <div key={title} className={rowStyle} data-flip={(i + (pictureFirst ? 1 : 0)) % 2 ? "" : undefined}>
          <div className={wordsStyle}>
            <h3 className={headingStyle}>{title}</h3>
            {text.split("\n\n").map((paragraph) => (
              <p key={paragraph} className={paragraphStyle}>
                <Marked text={paragraph} />
              </p>
            ))}
          </div>
          {/* Live, so not hidden: its controls work. */}
          <div className={`${cardStyle} ${graphicStyle}`} data-take-card="">
            <Dots inset />
            {graphic}
          </div>
        </div>
      ))}
    </div>
  );
}
