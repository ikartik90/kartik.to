"use client";

import { useRef } from "react";
import { css, cx } from "../../../styled-system/css";
import { eyebrowStyle, markerStyle } from "./diagram-parts";
import { Dots } from "./dots";
import { featureBodyStyle, featureTitleStyle } from "./feature-grid";
import { splitStyle } from "./gap-split";
import { Head } from "./sheet-article";
import { useFadeUnder } from "./use-fade-under";

// Each gap under the stage of a shift it struck, left to right as the shift runs, the line carrying on past the last
// stage. On a phone the line runs down the left, the gaps beside it.

export interface StageGap {
  stage: string;
  title: string;
  body: string;
}

const wordsStyle = css({ display: "flex", flexDirection: "column", gap: "md", maxWidth: "articleContent" });

const lineInk = "color-mix(in srgb, token(colors.text.default) 50%, var(--sheet-ground, token(colors.bg.surface)))";

const timelineStyle = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  rowGap: "3xl",
  listStyle: "none",
  md: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))", columnGap: "xxl" },
  _hasCursor: {
    "&:has(li:hover) li:not(:hover)": { opacity: 0.25 },
    "& li:hover [data-marker]": { backgroundImage: "none", backgroundColor: "text.highlight", color: "bg.canvas" },
    "& li:hover [data-title]": { color: "text.highlight" },
  },
});
const stageStyle = css({
  position: "relative",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  columnGap: "md",
  rowGap: "md",
  alignContent: "start",
  transition: "opacity 300ms ease",
  "& > :not([data-marker-slot])": { gridColumn: 2 },
  md: {
    gridTemplateColumns: "minmax(0, 1fr)",
    "& > :not([data-marker-slot])": { gridColumn: 1 },
    "& > [data-marker-slot]": { gridRow: 2 },
  },
});
// The line: from the marker down to the next stage's on a phone, across to it from `md`.
const markerSlotStyle = css({
  position: "relative",
  gridRow: "1 / span 3",
  display: "flex",
  justifyContent: "center",
  textStyle: "bodyLarge",
  md: { justifyContent: "flex-start", marginBlock: "xs" },
  "&::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    left: "50%",
    top: "token(sizes.listMarker)",
    bottom: "calc(-1 * token(spacing.3xl))",
    borderInlineStartWidth: "token(spacing.xxs)",
    borderInlineStartStyle: "solid",
    borderInlineStartColor: lineInk,
    md: {
      left: "token(sizes.listMarker)",
      right: "calc(-1 * token(spacing.xxl))",
      top: "50%",
      bottom: "auto",
      borderInlineStartWidth: 0,
      borderBlockStartWidth: "token(spacing.xxs)",
      borderBlockStartStyle: "solid",
      borderBlockStartColor: lineInk,
    },
  },
  "li:last-child > &": {
    "&::before": {
      maskImage: "linear-gradient(to bottom, black, transparent)",
      md: { right: 0, maskImage: "linear-gradient(to right, black, transparent)" },
    },
  },
});
const titleStyle = css({ transition: "color 300ms ease", textWrap: "balance" });

export function CheckInsGap({ eyebrow, heading, stages }: { eyebrow: string; heading: string; stages: StageGap[] }) {
  const wordsRef = useRef<HTMLDivElement>(null);
  const fade = useFadeUnder(wordsRef);
  return (
    <div className={splitStyle} data-split="" data-take-card="">
      <Dots mask={fade} />
      <div ref={wordsRef} className={wordsStyle} data-split-words="">
        <Head caption={eyebrow}>{heading}</Head>
      </div>
      <ol className={timelineStyle}>
        {stages.map(({ stage, title, body }, i) => (
          <li key={stage} className={stageStyle}>
            <span className={eyebrowStyle}>{stage}</span>
            <span className={markerSlotStyle} data-marker-slot="">
              <span className={markerStyle} data-marker="">
                {i + 1}
              </span>
            </span>
            <span className={cx(featureTitleStyle, titleStyle)} data-title="">
              {title}
            </span>
            <span className={featureBodyStyle}>{body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
