"use client";

import { useId, type CSSProperties, type RefObject } from "react";
import { cubicBezier } from "@/utils/eased-fade";
import { css } from "../../../styled-system/css";
import {
  FigureFrame,
  edgeStroke,
  floor,
  floorPoint,
  groundFill,
  guideStroke,
  hatchStroke,
  innerStroke,
  inkFill,
  labelText,
  phoneZoom,
  placeIn,
  slab,
  softText,
  type Curve,
  type Fade,
  type Point,
} from "./figure";
import { LIFT, cubic, labelsStyle, segment, tintFill, type Drawing, type Projection } from "./figure-parts";

// Shift scheduling as an abstract timeline: a week of shifts on open lanes; hovering slides the schedule's end out
// and the week repeats behind it, but for a holiday in the second week.

/**
 * `ms` on `slide`: the end's slide; `step` on `land`: each shift's landing, falling `drop` px. A shift lands as the
 * end comes within `lead` days of its own: one ending where the slide stops would otherwise wait out its slow finish.
 */
type Play = { ms: number; slide: Curve; step: number; land: Curve; drop: number; lead: number };

export const TRACK = 28;
export const PLAY: Play = { ms: 1400, slide: LIFT, step: 500, land: LIFT, drop: 12, lead: 1.5 };

const THICK = 6;
const RADIUS = 4;

/** When, as a share of a slide on `curve`, it has covered `progress` of its way. */
export const timeAt = (curve: Curve, progress: number) => {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  const ease = cubicBezier(...curve);
  let [lo, hi] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < progress) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

const travelStyle = css({
  transitionProperty: "transform",
  transitionDuration: "var(--play-ms)",
  transitionTimingFunction: "var(--slide-ease)",
  "[data-play]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    transform: "translate(var(--travel-x), var(--travel-y))",
  },
  _motionReduce: { transition: "none" },
});
// A shift landing at `--in` while playing, and leaving at `--out` on the way back, falling from `--from`. It is
// solid from its first frame (shown whole at the start, hidden at the end); only its lines fade (`inkInStyle`), so
// nothing behind it shows through.
const landStyle = css({
  visibility: "hidden",
  transform: "translateY(var(--from))",
  transitionProperty: "visibility, transform",
  // Leaving, it hides as its lines finish fading.
  transitionDuration: "calc(var(--step-ms) / 2), var(--step-ms)",
  transitionTimingFunction: "linear, var(--land-ease)",
  transitionDelay: "var(--out)",
  "[data-play]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    visibility: "visible",
    transform: "none",
    transitionDelay: "var(--in)",
  },
  _motionReduce: { transition: "none" },
});
const inkInStyle = css({
  opacity: 0,
  transition: "opacity calc(var(--step-ms) / 2) ease var(--out)",
  "[data-play]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    opacity: 1,
    transitionDelay: "var(--in)",
  },
  _motionReduce: { transition: "none" },
});

// The drawing lies a quarter turn counterclockwise on the floor: its own axes (u along time, v across) are the
// floor's (v, −u).
const TURN = "matrix(0 -1 1 0 0 0)";
const project = ({ scale }: Projection, [u, v]: Point): Point => floorPoint([0, 0], u, v, scale);
const floorAt = (p: Projection, origin: Point) => floor(project(p, origin), p.scale);
/** A point on the top faces' plane; the floor is `THICK` lower. */
const at = (p: Projection, u: number, v: number): Point => project(p, [v, -u]);
const onFloor = (p: Projection, u: number, v: number): Point => {
  const [x, y] = at(p, u, v);
  return [x, y + THICK];
};
/** Draws in the drawing's own axes from (`u`, `v`). */
const planeAt = (p: Projection, u: number, v: number) => `${floorAt(p, [v, -u])} ${TURN}`;
/** A box in the drawing's axes as it lies on the floor. */
const floorBox = (u: number, v: number, w: number, d: number) => ({ u: v, v: -u - w, w: d, d: w });
/** How near a box lies, for painting the farther first. */
const nearness = (u: number, v: number, w: number, d: number) => {
  const box = floorBox(u, v, w, d);
  return box.u + box.w / 2 + box.v + box.d / 2;
};
/** Parallel lines across a `w` × `d` box, for clipping to it, at 45° on the page. */
const hatchLines = (w: number, d: number) => {
  const [ax, ay, pitch] = [3, -1, 4];
  // Not Math.hypot: engines round it differently, and the server's lines wouldn't match the browser's.
  const length = Math.sqrt(ax * ax + ay * ay);
  const [dx, dy] = [ax / length, ay / length];
  const reach = Math.sqrt(w * w + d * d);
  return Array.from({ length: 2 * Math.ceil(reach / pitch) + 1 }, (_, i) => {
    const k = (i - Math.ceil(reach / pitch)) * pitch;
    const [x, y] = [w / 2 - k * dy, d / 2 + k * dx];
    return `M${x - reach * dx} ${y - reach * dy}L${x + reach * dx} ${y + reach * dy}`;
  }).join("");
};
const minus = ([x1, y1]: Point, [x2, y2]: Point): Point => [x1 - x2, y1 - y2];

/** A slab's whole silhouette in the ground's colour: its outline swept down its depth, a pixel at a time. */
function Solid({ face, outline }: { face: string; outline: string }) {
  return Array.from({ length: THICK + 1 }, (_, t) => (
    <g key={t} transform={`translate(0 ${t})`}>
      <path className={groundFill} transform={face} d={outline} />
    </g>
  ));
}

type BarProps = { p: Projection; u: number; v: number; w: number; d: number };

/** A shift: a rounded slab `w` × `d` at (`u`, `v`), outer edges in ink, its top face's crease faint. */
function Bar({ p, u, v, w, d }: BarProps) {
  const box = floorBox(u, v, w, d);
  const { outline, silhouette, far, near } = slab(box.w, box.d, Math.min(RADIUS, w / 2, d / 2));
  const face = floorAt(p, [box.u, box.v]);
  return (
    <>
      <Solid face={face} outline={outline} />
      <g transform={`translate(0 ${THICK})`}>
        <g transform={face}>
          <path className={edgeStroke} d={near} />
        </g>
      </g>
      {silhouette.map(([su, sv]) => {
        const [x, top] = project(p, [box.u + su, box.v + sv]);
        return <path key={su} className={edgeStroke} d={`M${x} ${top}V${top + THICK}`} />;
      })}
      <g transform={face}>
        <path className={tintFill} d={outline} />
        <path className={edgeStroke} d={far} />
        <path className={innerStroke} d={near} />
      </g>
    </>
  );
}

/** A shift landing on its timing (`style`): solid at once, its lines fading in. */
function LandingBar({ style, ...bar }: BarProps & { style: CSSProperties }) {
  const { p, u, v, w, d } = bar;
  const box = floorBox(u, v, w, d);
  const { outline } = slab(box.w, box.d, Math.min(RADIUS, w / 2, d / 2));
  return (
    <g className={landStyle} style={style}>
      <Solid face={floorAt(p, [box.u, box.v])} outline={outline} />
      <g className={inkInStyle}>
        <Bar {...bar} />
      </g>
    </g>
  );
}

const timing = (inMs: number, outMs: number, from: number) =>
  ({ "--in": `${Math.round(inMs)}ms`, "--out": `${Math.round(outMs)}ms`, "--from": `${from}px` }) as CSSProperties;
const travelling = ([x, y]: Point) => ({ "--travel-x": `${x}px`, "--travel-y": `${y}px` }) as CSSProperties;

const EXTEND = {
  day: 14,
  weeks: 3,
  laneGap: 6,
  inset: 3,
  // Each lane's run of days within a week.
  runs: [
    [0, 5],
    [1, 4],
    [3, 7],
  ],
  // A public holiday: in this week and lane, the run stops at `from` and the rest of it is shaded.
  holiday: { week: 1, lane: 2, from: 5 },
  // How far the lanes run on past the schedule, fading out.
  trail: 48,
};

// An eased ramp, so a fade shows no edge.
const ramp = cubicBezier(0.63, 0, 0.48, 1);
const FADE_STOPS = 13;

/** `lane`: each track's width. */
function extend(p: Projection, { ms, slide, drop, lead }: Play, id: string, lane: number): Drawing {
  const { day, weeks, laneGap, inset, runs, holiday, trail } = EXTEND;
  const week = 7 * day;
  const end = weeks * week;
  const span = end - week;
  const depth = runs.length * (lane + laneGap) - laneGap;
  const over = 8;

  const cut = (w: number, i: number) => w === holiday.week && i === holiday.lane;
  const bars = Array.from({ length: weeks }, (_, w) =>
    runs.map(([a, run], i) => {
      const b = cut(w, i) ? holiday.from : run;
      const u = (w * 7 + a) * day + 1.5;
      const length = (b - a) * day - 3;
      const v = i * (lane + laneGap) + inset;
      const tail = u + length + 1.5;
      return {
        key: `${w}-${i}`,
        u,
        v,
        length,
        posted: w === 0,
        style: timing(
          ms * timeAt(slide, (tail - lead * day - week) / span),
          ms * timeAt(slide, (end - tail - day) / span),
          -drop,
        ),
      };
    }),
  )
    .flat()
    .sort((a, b) => nearness(a.u, a.v, a.length, lane) - nearness(b.u, b.v, b.length, lane));

  const grip = onFloor(p, week, depth + over);
  const handle = (
    <g className={travelStyle} style={travelling(minus(onFloor(p, end, 0), onFloor(p, week, 0)))}>
      <path className={edgeStroke} d={segment(onFloor(p, week, -over), grip)} />
      <circle className={inkFill} cx={grip[0]} cy={grip[1]} r={3} />
    </g>
  );
  const shaded = {
    u: (holiday.week * 7 + holiday.from) * day + 1.5,
    v: holiday.lane * (lane + laneGap) + inset,
    w: (runs[holiday.lane][1] - holiday.from) * day - 3,
    d: lane - 2 * inset,
  };
  const hatch = hatchLines(shaded.w, shaded.d);
  // The lanes' edges, open at both ends, fading out over `trail` past the schedule.
  const [from, to] = [-trail, end + trail];
  const fade = Array.from({ length: FADE_STOPS }, (_, k) => k / (FADE_STOPS - 1));
  const stops = [
    ...fade.map((t) => [(t * trail) / (to - from), ramp(t)]),
    ...fade.map((t) => [(trail + end + t * trail) / (to - from), ramp(1 - t)]),
  ];
  const edges = runs.flatMap((_, i) => [i * (lane + laneGap), i * (lane + laneGap) + lane]);
  // Each week's label is centred over the head of the guide marking its start: the lanes rise to the right, so
  // running right from it, it would cross the nearest lane.
  const labelAt = (w: number): Point => {
    const [x, y] = onFloor(p, w * week, -over);
    return [x, y - 12];
  };
  const labelBounds = Array.from({ length: weeks }, (_, w) => labelAt(w)).flatMap(([x, y]): Point[] => {
    const width = 6 * 6.3;
    const left = x - width / 2;
    return [
      [left, y - 6],
      [left + width, y + 6],
    ];
  });

  return {
    bounds: [
      onFloor(p, 0, -over),
      onFloor(p, end, -over),
      onFloor(p, end, depth + over),
      onFloor(p, 0, depth + over),
      [grip[0], grip[1] + 6],
      ...labelBounds,
    ],
    node: (
      <>
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={from} x2={to} y1={0} y2={0}>
          {stops.map(([offset, alpha], k) => (
            <stop key={k} offset={offset} stopColor="white" stopOpacity={alpha} />
          ))}
        </linearGradient>
        <mask id={`${id}-lanes`} maskUnits="userSpaceOnUse" x={-1000} y={-1000} width={3000} height={3000}>
          <g transform={`translate(0 ${THICK})`}>
            <rect
              transform={planeAt(p, 0, 0)}
              x={from}
              y={-over}
              width={to - from}
              height={depth + 2 * over}
              fill={`url(#${id}-fade)`}
            />
          </g>
        </mask>
        <g mask={`url(#${id}-lanes)`}>
          {edges.map((v) => (
            <path key={v} className={innerStroke} d={segment(onFloor(p, from, v), onFloor(p, to, v))} />
          ))}
        </g>
        <g transform={`translate(0 ${THICK})`}>
          <g transform={planeAt(p, shaded.u, shaded.v)}>
            <clipPath id={`${id}-holiday`}>
              <path d={slab(shaded.w, shaded.d, RADIUS).outline} />
            </clipPath>
            <path className={hatchStroke} d={hatch} clipPath={`url(#${id}-holiday)`} />
            <path className={innerStroke} d={slab(shaded.w, shaded.d, RADIUS).outline} />
          </g>
        </g>
        {Array.from({ length: weeks - 1 }, (_, k) => (
          <path
            key={k}
            className={guideStroke}
            d={segment(onFloor(p, (k + 1) * week, -over), onFloor(p, (k + 1) * week, depth + over))}
          />
        ))}
        <g className={labelsStyle}>
          {Array.from({ length: weeks }, (_, w) => {
            const [x, y] = labelAt(w);
            return (
              <text key={w} className={`${labelText} ${softText}`} x={x} y={y} dy="0.35em" textAnchor="middle">
                Week {w + 1}
              </text>
            );
          })}
        </g>
        {/* Beyond every shift showing, so they cover it. */}
        {handle}
        {bars.map(({ key, u, v, length, posted, style }) =>
          posted ? (
            <Bar key={key} p={p} u={u} v={v} w={length} d={lane - 2 * inset} />
          ) : (
            <LandingBar key={key} p={p} u={u} v={v} w={length} d={lane - 2 * inset} style={style} />
          ),
        )}
      </>
    ),
  };
}

export function ShiftFigure({
  line,
  dots,
  scale,
  shift,
  play,
  track,
  fade,
  headingRef,
  label,
}: {
  line: number;
  dots: boolean;
  /** The drawing's size against its 1× measure. */
  scale: number;
  /** Moves the drawing from the middle of its space, in px down. */
  shift: number;
  play: Play;
  /** Each track's width. */
  track: number;
  fade: Fade;
  headingRef?: RefObject<HTMLElement | null>;
  label: string;
}) {
  const clipId = useId();
  const { bounds, node } = extend({ scale }, play, clipId, track);

  return (
    <FigureFrame line={line} dots={dots} fade={fade} headingRef={headingRef} zoomTo={phoneZoom(bounds, shift)} label={label}>
      {(frame) => {
        const [dx, centered] = placeIn(frame, bounds);
        const dy = centered + shift;
        const timings = {
          "--play-ms": `${play.ms}ms`,
          "--slide-ease": cubic(play.slide),
          "--step-ms": `${play.step}ms`,
          "--land-ease": cubic(play.land),
        } as CSSProperties;
        return (
          <g transform={`translate(${dx} ${dy})`} style={timings}>
            {node}
          </g>
        );
      }}
    </FigureFrame>
  );
}
