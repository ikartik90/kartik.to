import { Fragment, type CSSProperties } from "react";
import { css, cx } from "../../styled-system/css";
import { pageOpening } from "../../styled-system/recipes";
import { HOME_HERO } from "@/data/home-hero";
import { HERO_OPENING_LINES, openingLineDelay, openingStepDelay } from "@/data/page-opening";
import { tokens } from "@/data/theme/tokens";
import { TYPE_SIZES } from "@/data/theme/type-sizes";

// The page's opening starts here: the pills and the heading, then the lede.
const lineOpening = pageOpening({ part: "line" });
const stepOpening = pageOpening({ part: "step" });
const openingLine = (i: number) => ({
  "data-opening-line": "",
  style: { "--opening-delay": `${openingLineDelay(i)}ms` } as CSSProperties,
});
const ledeOpening = {
  "data-opening-step": "",
  style: { "--opening-delay": `${openingStepDelay(HERO_OPENING_LINES, 0)}ms` } as CSSProperties,
};

const heroStyle = css({
  // Under the header's 5xl, whose 4xl buttons it centres, the pills sit 132px below the buttons; with main's 5xl gap
  // below, the cards sit 2 × 5xl under the words, or on a phone main's gap alone, so their top is in the first fold.
  paddingBlockStart: "5xl",
  paddingBlockEnd: { base: 0, md: "5xl" },
});

const wordsStyle = css({
  width: "min(100%, token(sizes.articleShowcase))",
  marginInline: "auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateAreas: '"pill" "heading" "lede"',
  rowGap: "xl",
  justifyItems: "start",
  md: {
    gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)",
    gridTemplateAreas: '"pill ." "heading lede"',
    columnGap: "3xl",
  },
});

const pillsStyle = css({ gridArea: "pill", display: "flex", flexWrap: "wrap", gap: "md" });
const pillStyle = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "sm",
  paddingBlock: "xs",
  paddingInline: "md",
  borderRadius: "full",
  boxShadow: "inset 0 0 0 token(spacing.xxs) var(--colors-field-border-default)",
  textStyle: "caption",
  color: "text.body",
  whiteSpace: "nowrap",
});
const dotStyle = css({ width: "listBullet", height: "listBullet", borderRadius: "full", backgroundColor: "text.highlight" });

const headingStyle = css({ gridArea: "heading", textStyle: "title", color: "text.title", textWrap: "balance", margin: 0 });
const headingLineStyle = css({ display: "block" });
// The full lines need a 405px window; the short ones' "and" a 376px one.
const shown = { display: "contents" };
const HEADINGS = [
  { lines: HOME_HERO.heading.full, className: css({ display: "none", "@media screen and (width >= 25.5rem)": shown }) },
  {
    lines: HOME_HERO.heading.short,
    className: css({ display: "none", "@media screen and (23.5rem <= width < 25.5rem)": shown }),
  },
  { lines: HOME_HERO.heading.shortest, className: css({ display: "none", "@media screen and (width < 23.5rem)": shown }) },
];

// From md the first paragraph's cap height lines up with the heading's x-height. The hidden line, in the heading's
// type, trimmed to its baseline and pulled up by its `1ex`, is as tall as the heading's top-to-x-height; the first
// paragraph is trimmed to its cap height to sit under it. From md it keeps its measure against the showcase's right
// edge.
const ledeStyle = css({ gridArea: "lede", alignSelf: "start", md: { justifySelf: "end" } });
const ledeGaugeStyle = css({
  display: "none",
  textStyle: "title",
  md: { display: "block", visibility: "hidden", textBox: "trim-end text alphabetic", marginBlockEnd: "-1ex" },
});
const paragraphsStyle = css({
  display: "grid",
  rowGap: "xl",
  md: { "& > p:first-child": { textBox: "trim-start cap alphabetic" } },
});
const paragraphStyle = css({ textStyle: "bodyLarge", color: "text.body", margin: 0, maxWidth: "var(--measure)" });
// The lede's md column at full width in ems of its desktop size, so smaller type breaks its lines in the same places.
const ledeColumn = ((parseFloat(tokens.sizes.articleShowcase.value) - parseFloat(tokens.spacing["3xl"].value)) * 5) / 12;
const ledeMeasure = { "--measure": `${ledeColumn / TYPE_SIZES.bodyLarge.desktop.size}em` } as CSSProperties;

export function HomeHero() {
  return (
    <section className={heroStyle} aria-label="Introduction">
      <div className={wordsStyle}>
        <div className={cx(pillsStyle, lineOpening)} {...openingLine(0)}>
          <span className={pillStyle}>
            <span className={dotStyle} aria-hidden />
            {HOME_HERO.status.available}
          </span>
          <span className={pillStyle}>{HOME_HERO.status.location}</span>
        </div>
        <h1 className={cx(headingStyle, lineOpening)} {...openingLine(1)}>
          {HEADINGS.map(({ lines, className }) => (
            <span key={lines[0]} className={className}>
              {lines.map((line, i) => (
                <Fragment key={line}>
                  {i > 0 && " "}
                  <span className={headingLineStyle}>{line}</span>
                </Fragment>
              ))}
            </span>
          ))}
        </h1>
        <div className={cx(ledeStyle, stepOpening)} {...ledeOpening}>
          <div aria-hidden className={ledeGaugeStyle}>
            x
          </div>
          <div className={paragraphsStyle} style={ledeMeasure}>
            {HOME_HERO.lede.map((paragraph) => (
              <p key={paragraph} className={paragraphStyle}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
