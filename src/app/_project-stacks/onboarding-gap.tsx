"use client";

import { css, cx } from "../../../styled-system/css";
import FirewallIcon from "@/assets/icons/firewall.svg";
import SkullIcon from "@/assets/icons/skull.svg";
import { eyebrowStyle, markerStyle } from "./diagram-parts";
import { featureBodyStyle } from "./feature-grid";
import { itemStyle, markIconStyle, markSlotStyle, Split, subheadingStyle } from "./gap-split";
import { ONBOARDING } from "./onboarding-content";
import { Head } from "./sheet-article";

// The onboarding UX gap: a two-by-two of allowed against blocked, threat actors against paying customers, the two
// quadrants signup got hatched, each with its legend item beside the matrix.

/** Diagonals `step` apart across a box, falling to the right. */
function hatch(x0: number, y0: number, x1: number, y1: number, step: number) {
  const lines: string[] = [];
  for (let c = Math.ceil((x0 - y1) / step) * step; c <= x1 - y0; c += step) {
    const [a, b] = [Math.max(x0, c + y0), Math.min(x1, c + y1)];
    if (b - a > 1) lines.push(`M${a} ${a - c}L${b} ${b - c}`);
  }
  return lines.join("");
}

// The square in the middle, with room round it for the axes' labels: as much each side as the wider one needs, so the
// axes cross at its middle; on a phone, the side labels wrap to fit a narrower room. The axes run `--over` past the
// square, and each label stands `--gap` beyond its axis's end.
const matrixStyle = css({
  "--ink": "token(colors.text.default)",
  "--ink-faint": "color-mix(in srgb, var(--ink) 20%, transparent)",
  "--gap": "token(spacing.md)",
  position: "relative",
  paddingInline: "var(--side)",
  paddingBlock: "var(--block)",
});
// Over everything in the matrix, and solid: `--ink` at half laid on the sheet's ground, so no hatching shows through.
const axisStyle = css({
  position: "absolute",
  zIndex: 1,
  borderWidth: 0,
  borderStyle: "solid",
  borderColor: "color-mix(in srgb, var(--ink) 50%, var(--sheet-ground, token(colors.bg.surface)))",
  "&[data-axis=x]": { insetInline: "calc(var(--side) - var(--over))", top: "50%", borderBlockStartWidth: "token(spacing.xxs)" },
  "&[data-axis=y]": { insetBlock: "calc(var(--block) - var(--over))", left: "50%", borderInlineStartWidth: "token(spacing.xxs)" },
});
const axisLabelStyle = cx(
  eyebrowStyle,
  css({
    "--reach": "calc(var(--over) + var(--gap))",
    position: "absolute",
    whiteSpace: "nowrap",
    "&[data-end=top]": { left: "50%", bottom: "calc(100% - var(--block) + var(--reach))", translate: "-50% 0" },
    "&[data-end=bottom]": { left: "50%", top: "calc(100% - var(--block) + var(--reach))", translate: "-50% 0" },
    "&[data-end=start]": { top: "50%", right: "calc(100% - var(--side) + var(--reach))", translate: "0 -50%", textAlign: "end" },
    "&[data-end=end]": { top: "50%", left: "calc(100% - var(--side) + var(--reach))", translate: "0 -50%" },
    mdDown: { "&:is([data-end=start], [data-end=end])": { whiteSpace: "normal", width: "min-content" } },
  }),
);
const squareStyle = css({ position: "relative", aspectRatio: "1", "& > svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)" } });
const hatchStroke = css({ fill: "none", stroke: "var(--ink-faint)", strokeWidth: 1, transition: "stroke 300ms ease" });
// The sheet's own ground under the hatching, over the dots.
const hatchGround = css({ fill: "var(--sheet-ground, token(colors.bg.surface))" });
const markerAt = cx(markerStyle, css({ position: "absolute", translate: "-50% -50%" }));
// The middles of the two quadrants signup got: 2 top left, 4 bottom right.
const QUADRANT = { 2: [25, 25], 4: [75, 75] } as const;

// A skull for the threat actors let in, a firewall for the customers kept out.
const Mark = ({ quadrant }: { quadrant: 2 | 4 }) =>
  quadrant === 2 ? <SkullIcon className={markIconStyle} aria-hidden /> : <FirewallIcon className={markIconStyle} aria-hidden />;

function Matrix() {
  const { up, down, left, right, items, label } = ONBOARDING.gap;
  return (
    <div className={matrixStyle} role="img" aria-label={label} data-take="gap">
      <div className={squareStyle}>
        <svg viewBox="0 0 100 100" aria-hidden>
          {items.map(({ quadrant }) => {
            const [x, y] = QUADRANT[quadrant].map((middle) => middle - 25);
            return (
              <g key={quadrant} data-link={quadrant}>
                <rect className={hatchGround} x={x} y={y} width={50} height={50} />
                <path className={hatchStroke} data-hatch={quadrant} d={hatch(x, y, x + 50, y + 50, 4)} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        {items.map(({ quadrant }) => (
          <span
            key={quadrant}
            className={markerAt}
            data-link={quadrant}
            style={{ left: `${QUADRANT[quadrant][0]}%`, top: `${QUADRANT[quadrant][1]}%` }}
          >
            <Mark quadrant={quadrant} />
          </span>
        ))}
      </div>
      <span className={axisStyle} data-axis="x" />
      <span className={axisStyle} data-axis="y" />
      <span className={axisLabelStyle} data-end="top" aria-hidden>
        {up}
      </span>
      <span className={axisLabelStyle} data-end="bottom" aria-hidden>
        {down}
      </span>
      <span className={axisLabelStyle} data-end="start" aria-hidden>
        {left}
      </span>
      <span className={axisLabelStyle} data-end="end" aria-hidden>
        {right}
      </span>
    </div>
  );
}

// Each a subheading, its marker on the subheading's first line, and a line under it. The first marker's top is level
// with the top of the matrix's upright axis and the second's with its cross axis, half the square lower: the square is
// the matrix's share of the row (3 of 5 after the row's gap, as `legendAndDiagramStyle` splits it) less the room
// either side. A long first item pushes the second down rather than meet it. On a phone, over the matrix.
const itemsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "3xl",
  textStyle: "bodyLarge",
  md: {
    display: "grid",
    gridTemplateRows:
      "minmax(calc(((100cqw - token(spacing.4xl)) * 3 / 5 - 2 * var(--side)) / 2 + var(--over)), auto) auto",
    gap: 0,
    alignItems: "start",
    marginBlockStart: "calc(var(--block) - var(--over) - (1lh - token(sizes.listMarker)) / 2)",
    "& > :first-child": { paddingBlockEnd: "3xl" },
  },
});

function Legend() {
  return (
    <ul className={itemsStyle}>
      {ONBOARDING.gap.items.map(({ text, caption, quadrant }) => (
        <li key={text} className={itemStyle} data-link={quadrant}>
          <span className={markSlotStyle}>
            <span className={markerStyle}>
              <Mark quadrant={quadrant} />
            </span>
          </span>
          <span className={subheadingStyle} data-legend-title="">
            {text}
          </span>
          <span className={featureBodyStyle}>{caption}</span>
        </li>
      ))}
    </ul>
  );
}

// With a cursor, a hatched quadrant (or its mark) or its legend item under it lights the quadrant's hatching and the
// item's subheading in the brand colour, the other item fading back.
const linkStyle = css({
  _hasCursor: {
    "&:has([data-link='2']:hover)": {
      "& [data-hatch='2']": { stroke: "text.highlight/50" },
      "& li[data-link='2'] [data-legend-title]": { color: "text.highlight" },
      "& li[data-link='4']": { opacity: 0.25 },
    },
    "&:has([data-link='4']:hover)": {
      "& [data-hatch='4']": { stroke: "text.highlight/50" },
      "& li[data-link='4'] [data-legend-title]": { color: "text.highlight" },
      "& li[data-link='2']": { opacity: 0.25 },
    },
  },
});

export function OnboardingGap() {
  return (
    <Split words={<Head caption={ONBOARDING.gap.eyebrow}>{ONBOARDING.gap.heading}</Head>} className={linkStyle}>
      <Legend />
      <Matrix />
    </Split>
  );
}
