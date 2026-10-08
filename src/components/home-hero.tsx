import type { CSSProperties } from "react";
import { css, cx } from "../../styled-system/css";
import { pageOpening } from "../../styled-system/recipes";
import { ButtonLink } from "./button-link";
import { DitherGround } from "./shaders/dither-ground";
import { HOME_HERO } from "@/data/home-hero";
import { HERO_OPENING_LINES, openingLineDelay, openingStepDelay } from "@/data/page-opening";
import { easedFadeOut } from "@/utils/eased-fade";

// The page's opening starts here: the pills and each heading line, then the buttons, then the lede.
const lineOpening = pageOpening({ part: "line" });
const stepOpening = pageOpening({ part: "step" });
const openingLine = (i: number) => ({
  "data-opening-line": "",
  style: { "--opening-delay": `${openingLineDelay(i)}ms` } as CSSProperties,
});
const openingStep = (i: number) => ({
  "data-opening-step": "",
  style: { "--opening-delay": `${openingStepDelay(HERO_OPENING_LINES, i)}ms` } as CSSProperties,
});

// Edge to edge across `main`'s gutters and up to the page top, so the dithering fills it; the words keep to 960.
const heroStyle = css({
  boxSizing: "border-box",
  position: "relative",
  isolation: "isolate",
  marginInline: "calc(-1 * token(spacing.xxl))",
  marginBlockStart: "calc(-1 * token(spacing.3xl))",
  paddingInline: "xxl",
  paddingBlock: "5xl",
  minHeight: "homeHero",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
});

// Behind the words in the hero's own stacking context: up behind the site header (its `5xl`) to the page top, and on
// through `main`'s gap to where the work starts, so the fade ends there.
const groundStyle = css({
  position: "absolute",
  zIndex: -1,
  insetInline: 0,
  insetBlockStart: "calc(-1 * token(spacing.5xl))",
  insetBlockEnd: "calc(-1 * token(spacing.5xl))",
  pointerEvents: "none",
  maskImage: "var(--fade)",
  WebkitMaskImage: "var(--fade)",
});
const groundFade = { "--fade": easedFadeOut(30) } as CSSProperties;

// Below md one column; from md the heading on the left and the lede on the right, starting in the heading's row and
// spanning the buttons' row. That row is `1fr`, so a tall lede grows only it, and the gap above the buttons holds.
const wordsStyle = css({
  width: "min(100%, token(sizes.articleShowcase))",
  marginInline: "auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gridTemplateAreas: '"pill" "heading" "lede" "ctas"',
  rowGap: "xl",
  justifyItems: "start",
  md: {
    gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)",
    gridTemplateAreas: '"pill ." "heading lede" "ctas lede"',
    gridTemplateRows: "auto auto 1fr",
    columnGap: "3xl",
  },
});

// The pills and buttons sit over moving dithering; their translucent fills blur what's under them. Panda's
// `backdropFilter` emits only the -webkit- form; the raw key is what Chromium reads.
const pillFrost = {
  "-webkit-backdrop-filter": "blur(token(spacing.md))",
  "backdrop-filter": "blur(token(spacing.md))",
};
const buttonFrost = {
  "-webkit-backdrop-filter": "blur(token(spacing.sm))",
  "backdrop-filter": "blur(token(spacing.sm))",
};

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
  ...pillFrost,
});
const dotStyle = css({ width: "listBullet", height: "listBullet", borderRadius: "full", backgroundColor: "text.highlight" });

const headingStyle = css({ gridArea: "heading", textStyle: "title", color: "text.title", textWrap: "balance", margin: 0 });
const lineStyle = css({ display: "block" });

// From md the first paragraph's cap height lines up with the heading's x-height. The hidden line, in the heading's
// type, trimmed to its baseline and pulled up by its `1ex`, is as tall as the heading's top-to-x-height; the first
// paragraph is trimmed to its cap height to sit under it.
const ledeStyle = css({ gridArea: "lede", alignSelf: "start" });
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
const paragraphStyle = css({ textStyle: "bodyLarge", color: "text.body", margin: 0, maxWidth: "articleContent" });

// `3xl` below the words above them in one column; `4xl` below the heading from md.
const ctasStyle = css({
  gridArea: "ctas",
  alignSelf: "start",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "md",
  paddingBlockStart: "xl",
  md: { paddingBlockStart: "calc(token(spacing.4xl) - token(spacing.xl))" },
  "& a": buttonFrost,
});

export function HomeHero() {
  return (
    <section className={heroStyle} aria-label="Introduction">
      <DitherGround
        shape="warp"
        type="4x4"
        size={2}
        scale={1.5}
        speed={0.25}
        ink="--colors-border-divider"
        strength={0.72}
        className={groundStyle}
        style={groundFade}
      />
      <div className={wordsStyle}>
        <div className={cx(pillsStyle, lineOpening)} {...openingLine(0)}>
          <span className={pillStyle}>
            <span className={dotStyle} aria-hidden />
            {HOME_HERO.status.available}
          </span>
          <span className={pillStyle}>{HOME_HERO.status.location}</span>
        </div>
        <h1 className={headingStyle}>
          {HOME_HERO.heading.map((line, i) => (
            <span key={line} className={cx(lineStyle, lineOpening)} {...openingLine(i + 1)}>
              {line}
            </span>
          ))}
        </h1>
        <div className={cx(ledeStyle, stepOpening)} {...openingStep(1)}>
          <div aria-hidden className={ledeGaugeStyle}>
            x
          </div>
          <div className={paragraphsStyle}>
            {HOME_HERO.lede.map((paragraph) => (
              <p key={paragraph} className={paragraphStyle}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
        <div className={cx(ctasStyle, stepOpening)} {...openingStep(0)}>
          <ButtonLink href={HOME_HERO.work.href} color="accent">
            {HOME_HERO.work.text}
          </ButtonLink>
          <ButtonLink href={HOME_HERO.resume.href} newTab>
            {HOME_HERO.resume.text}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
