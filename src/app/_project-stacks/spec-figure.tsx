"use client";

import { useId, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { css, cx } from "../../../styled-system/css";
import {
  FigureFrame,
  PHONE_CUT,
  centerOffset,
  edgeStroke,
  floor,
  floorPoint,
  groundFill,
  guideStroke,
  hatchStroke,
  heightsAcross,
  innerStroke,
  inkFill,
  labelText,
  placeholderFill,
  roundedOutline,
  slab,
  softText,
  useCycle,
  type Explode,
  type ExplodePart,
  type Fade,
  type Motion,
  type Point,
} from "./figure";

// A design system as a component's spec, its values named as tokens one at a time: a timecard as a wireframe,
// measured at 1×.

const CW = 400;
const CH = 144;
const RADIUS = 10;
const PAD = 10;
const THICKNESS = 8;
// Half a label's height, and how far a bottom-right label keeps under the card.
const LABEL_HALF = 6;
const NOTE_GAP = 24;
// A label's advance per character at its largest (`inlineCode` in `caption`), for keeping it inside the figure.
const LABEL_ADVANCE = 6.3;

const AVATAR = { cx: 37.5, cy: 37.5, r: 25 };
const CONTENT_X = 70;
const NAME = { x: CONTENT_X, y: 20, w: 118, h: 10 };
const PROFILE = { cx: CONTENT_X + 133, cy: 25, r: 8 };
const ACTIONS = [CONTENT_X + 262, CONTENT_X + 297];
const DETAILS = [
  { x: CONTENT_X, y: 51, w: 88, h: 8 },
  { x: CONTENT_X, y: 76, w: 228, h: 8 },
];
const DIVIDER_Y = 97.5;
const CHIP_Y = 105.3;
const CHIP_H = 25;
const DURATION = { x: CONTENT_X, w: 73 };
const STATUS = { x: CONTENT_X + 209, w: 111 };

const CARD = roundedOutline(
  [
    [0, 0],
    [CW, 0],
    [CW, CH],
    [0, CH],
  ],
  RADIUS,
);
// The card lies turned a quarter counterclockwise: (u, v) → (v, CW − u).
const SLAB = slab(CH, CW, RADIUS);
const TURN = `matrix(0 -1 1 0 0 ${CW})`;
const RING = `${CARD}M${PAD} ${PAD}V${CH - PAD}H${CW - PAD}V${PAD}Z`;

const hatch = (pitch: number) => {
  const d: string[] = [];
  for (let k = -CH; k <= CW; k += pitch) d.push(`M${k} ${CH}L${k + CH} 0`);
  return d.join("");
};
const HATCH_PATH = hatch(10);
const GAP_HATCH = hatch(5);

const iconStroke = css({
  fill: "none",
  stroke: "var(--ink-soft)",
  strokeWidth: "var(--line)",
  vectorEffect: "non-scaling-stroke",
  strokeLinecap: "round",
  strokeLinejoin: "round",
});
const softFill = css({ fill: "color-mix(in srgb, var(--ink) 50%, token(colors.bg.canvas))" });
// An outlined part that still covers what lies below it once raised.
const solidStroke = css({
  fill: "bg.canvas",
  stroke: "var(--ink-soft)",
  strokeWidth: "var(--line)",
  vectorEffect: "non-scaling-stroke",
});
// The same, filled: the success chip, whose surface the tokens name.
const tintStroke = css({
  fill: "color-mix(in srgb, var(--ink) 20%, token(colors.bg.canvas))",
  stroke: "var(--ink-soft)",
  strokeWidth: "var(--line)",
  vectorEffect: "non-scaling-stroke",
});
// A gap in the ground's colour around a raised part, so lines passing behind it stop short of it.
const halo = css({
  stroke: "bg.canvas",
  strokeWidth: "token(spacing.md)",
  strokeLinejoin: "round",
  paintOrder: "stroke",
  vectorEffect: "non-scaling-stroke",
});
// The same gap for an outlined part, drawn as a copy beneath it.
const haloUnder = css({
  fill: "bg.canvas",
  stroke: "bg.canvas",
  strokeWidth: "token(spacing.md)",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
});

// Exploded, each part rises by its area against the heaviest's, which rises `LIFT` spreads, and the card sinks half
// that, so the whole opens about its middle.
const LIFT = 4;
const layerStyle = css({
  transitionProperty: "transform",
  transitionDuration: "var(--explode-ms)",
  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
  // The card's drop is its resting place only: exploded, the layers land where they would without it.
  "[data-explode]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    transform: "translateY(calc(var(--offset) * var(--spread) + var(--nudge, 0px) - var(--drop, 0px)))",
  },
  _motionReduce: { transition: "none" },
});

// The tokens step aside while the card is exploded. The labels' `inlineCode` sizes itself against this.
const notesStyle = css({
  textStyle: "caption",
  transition: "opacity var(--explode-ms) ease",
  "[data-explode]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": { opacity: 0 },
});

type Box = { x: number; y: number; w: number; h: number };

const bar = ({ x, y, w, h }: Box, className: string) => (
  <rect className={className} x={x} y={y} width={w} height={h} rx={h / 2} />
);

const CHIP_MID = CHIP_Y + CHIP_H / 2;
const widthOf = (property: string, token: string) => (property.length + 1 + token.length) * LABEL_ADVANCE;

/** A design variable as CSS reads it: `Colors/Apple/100` → `var(--colors-apple-100)`. */
const cssVar = (name: string) => `var(--${name.toLowerCase().replace(/[/\s]+/g, "-")})`;

type Part = { key: ExplodePart; area: number; node: ReactNode };
const barArea = ({ w, h }: Box) => w * h;
const circleArea = (r: number) => Math.PI * r * r;

const CHIPS = [
  { x: DURATION.x, w: DURATION.w, r: 4 },
  { x: STATUS.x, w: STATUS.w, r: CHIP_H / 2 },
].map(({ x, w, r }) => ({ x, y: CHIP_Y, width: w, height: CHIP_H, rx: r }));

// The card's parts in their groups, each group lifted as one piece and weighed by its total area. `halo` and
// `haloUnder` keep the lines behind a raised part clear of it.
const PARTS: Part[] = [
  {
    key: "chips",
    area: (DURATION.w + STATUS.w) * CHIP_H,
    node: (
      <>
        {CHIPS.map((box) => (
          <rect key={box.x} className={haloUnder} {...box} />
        ))}
        <rect className={solidStroke} {...CHIPS[0]} />
        <circle className={solidStroke} cx={DURATION.x + 12.5} cy={CHIP_MID} r={8} />
        {bar({ x: DURATION.x + 27.5, y: CHIP_MID - 4, w: 38, h: 8 }, softFill)}
        <rect className={tintStroke} {...CHIPS[1]} />
        <circle className={solidStroke} cx={STATUS.x + 12.5} cy={CHIP_MID} r={8} />
        <path className={iconStroke} d={`M${STATUS.x + 9} ${CHIP_MID}l2.5 2.5l4.5-5`} />
        {bar({ x: STATUS.x + 25, y: CHIP_MID - 4, w: 76, h: 8 }, softFill)}
      </>
    ),
  },
  { key: "avatar", area: circleArea(AVATAR.r), node: <circle className={cx(placeholderFill, halo)} {...AVATAR} /> },
  {
    key: "text",
    area: barArea(NAME) + circleArea(PROFILE.r) + DETAILS.reduce((sum, line) => sum + barArea(line), 0),
    node: (
      <>
        {bar(NAME, cx(softFill, halo))}
        <circle className={haloUnder} {...PROFILE} />
        <circle className={solidStroke} {...PROFILE} />
        {DETAILS.map((line) => (
          <g key={line.y}>{bar(line, cx(placeholderFill, halo))}</g>
        ))}
      </>
    ),
  },
  {
    key: "icons",
    area: ACTIONS.length * 16 * 16,
    node: ACTIONS.map((x) => {
      const box = { x, y: 17, width: 16, height: 16, rx: 3 };
      return (
        <g key={x}>
          <rect className={haloUnder} {...box} />
          <rect className={solidStroke} {...box} />
        </g>
      );
    }),
  },
];

const HEAVIEST = Math.max(...PARTS.map(({ area }) => area));

// Flat parts lie one above another, so painting them lowest first is the true depth order.
const rise = (area: number, spread: number, nudge: number) => (LIFT * spread * area) / HEAVIEST - nudge;
const lift = (area: number, nudge: number) =>
  ({ "--offset": LIFT / 2 - (LIFT * area) / HEAVIEST, "--nudge": `${nudge}px` }) as CSSProperties;
const cardLift = (nudge: number) => ({ "--offset": LIFT / 2, "--nudge": `${nudge}px` }) as CSSProperties;

type DrawnNote = {
  property: string;
  token: string;
  marker?: ReactNode;
  x: number;
  y: number;
  leader: string;
  start: number;
  labelY: number;
};

/** The notes, one at a time. Remounted when the set in view changes, so the cycle runs through only those. */
function Notes({ notes, motion, plane }: { notes: DrawnNote[]; motion: Motion; plane: string }) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  useCycle(refs, motion);
  return (
    <g className={notesStyle}>
      {notes.map(({ property, token, marker, x, y, leader, start, labelY }, i) => (
        <g
          key={property}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={{ opacity: 0 }}
        >
          {marker && <g transform={plane}>{marker}</g>}
          <circle className={inkFill} cx={x} cy={y} r={1.5} />
          <path className={guideStroke} d={leader} />
          <text className={labelText} x={start} y={labelY} dy="0.35em">
            <tspan className={softText}>{property} </tspan>
            {token}
          </text>
        </g>
      ))}
    </g>
  );
}

export function SpecFigure({
  line,
  motion,
  dots,
  scale,
  explode,
  shift,
  drop,
  fade,
  headingRef,
  label,
}: {
  line: number;
  /** The tokens' cycle. */
  motion: Motion;
  dots: boolean;
  /** The card's drawn size against its 1× measure. */
  scale: number;
  /** Hovering the host explodes the card, hiding the tokens until the pointer leaves. */
  explode: Explode;
  /** Moves the card, at rest and exploded alike, in px down. */
  shift: number;
  /** How far below the middle of its space the card rests, in the drawing's units. */
  drop: number;
  fade: Fade;
  headingRef?: RefObject<HTMLElement | null>;
  label: string;
}) {
  const ringId = useId();

  const { outline: slabOutline, silhouette, far, near } = SLAB;
  const [w, d] = [CH, CW];
  const floorPlane = floor([0, 0], scale);
  // The card's own drawing: its parts, notes and divider.
  const plane = `${floorPlane} ${TURN}`;
  const onFloor = (u: number, v: number): Point => floorPoint([0, 0], u, v, scale);
  const map = (u: number, v: number): Point => onFloor(v, CW - u);

  const outline: Point[] = [onFloor(0, 0), onFloor(w, 0), onFloor(w, d), onFloor(0, d)];
  outline.push(...outline.map(([x, y]): Point => [x, y + THICKNESS]));
  const cardLeft = Math.min(...outline.map(([x]) => x));
  const cardWidth = Math.max(...outline.map(([x]) => x)) - cardLeft;
  // The card's highest top and lowest foot across `from`–`to`.
  const cardTop = (from: number, to: number) => Math.min(...heightsAcross(outline, from, to));
  const cardBottom = (from: number, to: number) => Math.max(...heightsAcross(outline, from, to));

  const notesSpec: { at: Point; property: string; token: string; marker?: ReactNode }[] = [
    {
      at: [CW * 0.4, PAD / 2],
      property: "Padding",
      token: cssVar("Padding/md"),
      marker: (
        <>
          <clipPath id={ringId}>
            <path d={RING} clipRule="evenodd" />
          </clipPath>
          <path className={hatchStroke} d={HATCH_PATH} clipPath={`url(#${ringId})`} />
        </>
      ),
    },
    {
      at: [CONTENT_X - 2.5, PAD],
      property: "Gap",
      token: cssVar("Spacing/xs"),
      // The gap between the avatar and the text column, the row's full height, hatched like the padding.
      marker: (
        <>
          <clipPath id={`${ringId}-gap`}>
            <rect x={CONTENT_X - 5} y={PAD} width={5} height={CH - 2 * PAD} />
          </clipPath>
          <path className={hatchStroke} d={GAP_HATCH} clipPath={`url(#${ringId}-gap)`} />
        </>
      ),
    },
    {
      at: [NAME.x + NAME.w / 2, NAME.y + NAME.h / 2],
      property: "Glyph",
      token: cssVar("Glyph/Default"),
    },
    {
      at: [STATUS.x + STATUS.w / 2, CHIP_MID],
      property: "Surface",
      token: cssVar("Surface/Success"),
    },
    {
      at: [CW * 0.5, 0],
      property: "Border",
      token: cssVar("Border/Subdued"),
    },
    {
      at: [RADIUS, CH - RADIUS],
      property: "Radius",
      token: cssVar("Radius/md"),
      marker: (
        <>
          <circle className={guideStroke} cx={RADIUS} cy={CH - RADIUS} r={RADIUS} />
          <circle className={inkFill} cx={RADIUS} cy={CH - RADIUS} r={2} />
        </>
      ),
    },
  ];

  return (
    <FigureFrame
      line={line}
      dots={dots}
      explode={explode}
      fade={fade}
      headingRef={headingRef}
      zoomTo={{ width: cardWidth, cut: PHONE_CUT }}
      label={label}
    >
      {(frame) => {
        const inset = frame.top;
        const [centered, center] = centerOffset(outline, inset, frame.width, frame.height);
        // Zoomed in, the card starts at the heading's edge and runs off the frame's right.
        const dx = frame.left === undefined ? centered : frame.left - cardLeft;
        // Zoomed in, what shows of the card sits in the middle of the space under the heading.
        const seen = [cardLeft, frame.width - dx] as const;
        const middle =
          frame.left === undefined ? center : (inset + frame.height - cardTop(...seen) - cardBottom(...seen)) / 2;
        const dy = middle + shift + drop;
        // Only the notes whose point is in view.
        const shown = notesSpec.filter(({ at }) => {
          const x = map(...at)[0] + dx;
          return x >= LABEL_HALF && x <= frame.width - 2 * LABEL_HALF;
        });
        // Top-left labels share the spot farthest from the frame's side, the heading and the card, placed for the
        // corner's widest label.
        const topLeftSpot = (() => {
          const width = Math.max(
            0,
            ...shown.filter(({ at }) => at[1] <= CH / 2).map((n) => widthOf(n.property, n.token)),
          );
          let best = { start: 0, row: 0, clear: -Infinity };
          for (let margin = 0; margin <= frame.width / 4; margin++) {
            const start = margin - dx;
            const [above, below] = [inset - dy, cardTop(start, start + width)];
            const clear = Math.min(margin, (below - above) / 2 - LABEL_HALF);
            if (Number.isFinite(below) && clear > best.clear) best = { start, row: (above + below) / 2, clear };
          }
          return best;
        })();
        // A bottom-right label keeps `NOTE_GAP` under the card, level with its point where a straight leader fits,
        // and otherwise as far from the frame's side and foot as that allows.
        const bottomRightSpot = (x: number, y: number, width: number) => {
          let best = { start: 0, row: 0, level: false, clear: -Infinity };
          for (let margin = 0; margin <= frame.width / 2; margin++) {
            const start = frame.width - margin - dx - width;
            const foot = cardBottom(start, start + width);
            const level = x < start - NOTE_GAP && y - LABEL_HALF - foot >= NOTE_GAP;
            const row = level ? y : foot + NOTE_GAP + LABEL_HALF;
            const clear = Math.min(margin, frame.height - dy - row - LABEL_HALF);
            if (Number.isFinite(foot) && clear > best.clear) best = { start, row, level, clear };
          }
          return best;
        };
        return (
          <g transform={`translate(${dx} ${dy})`} style={{ "--drop": `${drop}px` } as CSSProperties}>
            <g className={layerStyle} style={cardLift(explode.nudge.card)}>
              <g transform={`translate(0 ${THICKNESS})`}>
                <g transform={floorPlane}>
                  <path className={groundFill} d={slabOutline} />
                  <path className={edgeStroke} d={near} />
                </g>
              </g>
              {silhouette.map(([u, v]) => {
                const [x, y] = onFloor(u, v);
                return <path key={u} className={edgeStroke} d={`M${x} ${y}V${y + THICKNESS}`} />;
              })}
              <g transform={floorPlane}>
                <path className={groundFill} d={slabOutline} />
                <path className={edgeStroke} d={far} />
                <path className={innerStroke} d={near} />
              </g>
              <g transform={plane}>
                <path className={innerStroke} d={`M${CONTENT_X} ${DIVIDER_Y}H${CW - PAD}`} />
              </g>
            </g>
            {[...PARTS]
              .sort(
                (a, b) =>
                  rise(a.area, explode.spread, explode.nudge[a.key]) - rise(b.area, explode.spread, explode.nudge[b.key]),
              )
              .map((part) => (
                <g key={part.key} className={layerStyle} style={lift(part.area, explode.nudge[part.key])}>
                  <g transform={plane}>{part.node}</g>
                </g>
              ))}
            <Notes
              key={shown.map(({ property }) => property).join()}
              motion={motion}
              plane={plane}
              notes={shown.map(({ at, property, token, marker }) => {
                const [x, y] = map(...at);
                const topLeft = at[1] <= CH / 2;
                const width = widthOf(property, token);
                const spot = topLeft ? { ...topLeftSpot, level: false } : bottomRightSpot(x, y, width);
                const { start } = spot;
                const end = start + width;
                const over = x >= start && x <= end;
                // A top-left point beside its label, level with a row as clear as the corner's own, gets a straight leader.
                const level =
                  !over &&
                  (topLeft
                    ? y - LABEL_HALF - (inset - dy) >= spot.clear && cardTop(start, end) - y - LABEL_HALF >= spot.clear
                    : spot.level);
                const labelY = level ? y : spot.row;
                const toward = x < start ? start - LABEL_HALF : end + LABEL_HALF;
                const leader = over
                  ? `M${x} ${y}V${labelY + (topLeft ? 1 : -1) * (LABEL_HALF + 2)}`
                  : level
                    ? `M${x} ${y}H${toward}`
                    : `M${x} ${y}V${labelY}H${toward}`;
                return { property, token, marker, x, y, leader, start, labelY };
              })}
            />
          </g>
        );
      }}
    </FigureFrame>
  );
}
