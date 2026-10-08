"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { css, cx } from "../../../styled-system/css";
import { legendAndDiagramStyle } from "./diagram-parts";
import { Dots } from "./dots";
import { featureTitleStyle } from "./feature-grid";
import { useFadeUnder } from "./use-fade-under";

// A section across the sheet: its words, then a legend or other words beside a diagram or demo, out past the sheet's
// padding to its edges on one dotted ground, clear behind the words and fading in under their foot as a card's under
// its heading. It ends on what follows, pulled down through the article's gap and the band's margin above it
// (`articleStyle`, `bandStyle` in sheet-article.tsx).

export const splitStyle = css({
  // A matrix's room beside and above its square, and how far its axes run past it, which a legend lines up with.
  "--side": "calc(token(spacing.5xl) + token(spacing.4xl))",
  "--block": "token(spacing.4xl)",
  "--over": "token(spacing.md)",
  containerType: "inline-size",
  position: "relative",
  isolation: "isolate",
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
  mdDown: { "--side": "token(spacing.5xl)" },
  // Over the section's width for its children (`wideSectionStyle` in sheet-article.tsx).
  "&[data-split]": {
    width: "calc(100% + 2 * token(spacing.3xl))",
    marginInline: "calc(-1 * token(spacing.3xl))",
    marginBlockEnd: "calc(-2 * token(spacing.4xl))",
    paddingInline: "3xl",
    paddingBlockEnd: "4xl",
    mdDown: {
      width: "calc(100% + 2 * token(spacing.xl))",
      marginInline: "calc(-1 * token(spacing.xl))",
      marginBlockEnd: "calc(-2 * token(spacing.3xl))",
      paddingInline: "xl",
      paddingBlockEnd: "3xl",
    },
  },
  // In a section already out at the sheet's edges (`data-bleed`), at its width.
  "&[data-split][data-in-bleed]": {
    width: "token(spacing.full)",
    marginInline: 0,
    mdDown: { width: "token(spacing.full)", marginInline: 0 },
  },
  // Not isolated: a demo's cursor (z-index 60) has to rise over its date picker's popover, which opens at the sheet's
  // top level (z-index 50). The dots stay under the rest by coming first, unstacked, with the rest positioned after.
  // Its head over no more than the sheet's left half.
  "&[data-split][data-open]": {
    isolation: "auto",
    "& > [aria-hidden]:first-child": { zIndex: "auto", insetBlockEnd: "calc(-1 * var(--dots-run, 0px))" },
    "& > :not(:first-child)": { position: "relative" },
    "& > [data-split-words]": { md: { maxWidth: "min(token(sizes.articleContent), 50%)" } },
  },
});
const wordsStyle = css({ display: "flex", flexDirection: "column", gap: "md", maxWidth: "articleContent" });

// A legend item: its mark on the subheading's first line, its line under it, as the feature grid sets its features.
export const itemStyle = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  columnGap: "md",
  rowGap: "md",
  "& > :not(:first-child)": { gridColumn: 2 },
  transition: "opacity 300ms ease",
});
// Each subheading on one line of its own.
export const subheadingStyle = cx(featureTitleStyle, css({ whiteSpace: "nowrap", transition: "color 300ms ease" }));
export const markSlotStyle = css({ gridRow: "1 / span 2", textStyle: "bodyLarge", height: "1lh", display: "flex", alignItems: "center" });
export const markIconStyle = css({ width: "token(spacing.xl)", height: "token(spacing.xl)" });

/**
 * Sets `--dots-run` on the split: how far past its foot `to` starts, so its dots reach down to it. A passive effect: `to`
 * comes later in the tree, and its ref isn't attached yet when the split's layout effects run.
 */
function useDotsRun(split: RefObject<HTMLDivElement | null>, to?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = split.current;
    const end = to?.current;
    if (!box || !end) return;
    // On screen, to the subpixel (`offsetTop` rounds), then back to layout pixels through the sheet's opening scale.
    const measure = () => {
      const from = box.getBoundingClientRect();
      const scale = from.width / box.offsetWidth || 1;
      box.style.setProperty("--dots-run", `${Math.max(0, (end.getBoundingClientRect().top - from.bottom) / scale)}px`);
    };
    const observer = new ResizeObserver(measure);
    for (const watched of [box, end, end.parentElement]) if (watched) observer.observe(watched);
    measure();
    return () => observer.disconnect();
  }, [split, to]);
}

/**
 * `centre` sets the left column level with the middle of the right one, instead of its top. `inBleed`, for a split in
 * a section already at the sheet's width. `open` lets what's in it stack over the sheet's top level (a demo's cursor
 * over its popovers). `dotsTo`, an element further down the sheet its dotted ground runs on to.
 */
export function Split({
  words,
  centre,
  inBleed,
  open,
  dotsTo,
  className,
  children,
}: {
  words: ReactNode;
  centre?: boolean;
  inBleed?: boolean;
  open?: boolean;
  dotsTo?: RefObject<HTMLElement | null>;
  /** On the row of the legend beside its diagram. */
  className?: string;
  children: ReactNode;
}) {
  const wordsRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const fade = useFadeUnder(wordsRef);
  useDotsRun(splitRef, dotsTo);
  return (
    <div
      ref={splitRef}
      className={splitStyle}
      data-split=""
      data-in-bleed={inBleed ? "" : undefined}
      data-open={open ? "" : undefined}
      data-take-card=""
    >
      <Dots mask={fade} />
      <div ref={wordsRef} className={wordsStyle} data-split-words="">
        {words}
      </div>
      <div
        className={cx(legendAndDiagramStyle, className)}
        data-align={centre ? undefined : "start"}
        data-columns="wide-diagram"
      >
        {children}
      </div>
    </div>
  );
}
