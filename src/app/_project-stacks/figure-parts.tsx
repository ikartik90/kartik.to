"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { css } from "../../../styled-system/css";
import {
  FigureFrame,
  centerOffset,
  edgeStroke,
  floor,
  groundFill,
  guideStroke,
  innerStroke,
  inkFill,
  labelText,
  slab,
  softText,
  type Curve,
  type Fade,
  type Point,
} from "./figure";

// The parts the played figures draw with: hovering their host plays a move, leaving plays it back.

/** `ms` on `ease`: the main move; `press`: a pause within it; `back`: returning, on leave. */
export type Clock = { ms: number; ease: Curve; press: number; back: number };
/** A drawing's size against its 1× measure, and how far it sits from the middle of its space, in px down. */
export type Framing = { scale: number; shift: number };

export const LIFT: Curve = [0.32, 0.72, 0, 1];

// Moves to `--to` while the figure plays, and back on leave.
export const moveStyle = css({
  transitionProperty: "transform",
  transitionDuration: "var(--back-ms)",
  transitionTimingFunction: "var(--back-ease)",
  transitionDelay: "var(--out)",
  "[data-play]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    transform: "var(--to)",
    transitionDuration: "var(--dur)",
    transitionTimingFunction: "var(--ease)",
    transitionDelay: "var(--in)",
  },
  _motionReduce: { transition: "none" },
});
// Turns about the middle of what it holds.
export const pivotStyle = css({ transformBox: "fill-box", transformOrigin: "center" });
export const showStyle = css({
  opacity: 0,
  transition: "opacity var(--fade) ease var(--out)",
  "[data-play]:is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    opacity: 1,
    transitionDelay: "var(--in)",
  },
  _motionReduce: { transition: "none" },
});
// The labels' `inlineCode` sizes itself against this.
export const labelsStyle = css({ textStyle: "caption" });
export const tintFill = css({ fill: "color-mix(in srgb, var(--ink) 12%, token(colors.bg.canvas))" });

/** Isometric at `scale`. */
export type Projection = { scale: number };
export type Drawing = { bounds: Point[]; node: ReactNode };

/** A point `h` above the floor's (`u`, `v`). */
export const at = ({ scale: s }: Projection, u: number, v: number, h = 0): Point => [
  s * (u - v),
  (s * (u + v)) / 2 - s * h,
];
/** Draws in the floor's plane from (`u`, `v`), `h` up. */
export const planeAt = (p: Projection, u: number, v: number, h = 0) => floor(at(p, u, v, h), p.scale);
/** On the page, the step a move of (`u`, `v`, `h`) makes. */
export const step = (p: Projection, u: number, v: number, h = 0): Point => {
  const [[x0, y0], [x1, y1]] = [at(p, 0, 0), at(p, u, v, h)];
  return [x1 - x0, y1 - y0];
};
const msOf = (n: number) => `${Math.round(n)}ms`;
// Trigonometry rounds differently in Safari than on the server; rounded, the server's paths match the browser's.
export const fixed = (n: number) => Math.round(n * 1000) / 1000;
export const cubic = (curve: Curve) => `cubic-bezier(${curve.join(", ")})`;
export const segment = ([x1, y1]: Point, [x2, y2]: Point) => `M${x1} ${y1}L${x2} ${y2}`;

/** A move to `to` taking `dur` on `ease` after `delay`, and back on leave after `out`. */
export const moving = (to: string, dur: number, ease: string, delay = 0, out = 0) =>
  ({
    "--to": to,
    "--dur": msOf(dur),
    "--ease": ease,
    "--in": msOf(delay),
    "--out": msOf(out),
  }) as CSSProperties;
/** Showing after `delay` over `fade`, and back on leave after `out`. */
export const timed = (delay: number, out = 0, fade = 300) =>
  ({ "--in": msOf(delay), "--out": msOf(out), "--fade": msOf(fade) }) as CSSProperties;

/**
 * A rounded block `w` × `d` on the floor at (`u`, `v`), `t` deep: outer edges in ink, its top face's crease faint.
 * `face` draws on its top face, from its corner.
 */
export function Block({
  p,
  u,
  v,
  w,
  d,
  t,
  r,
  fill,
  face,
}: {
  p: Projection;
  u: number;
  v: number;
  w: number;
  d: number;
  t: number;
  r: number;
  fill: string;
  face?: ReactNode;
}) {
  const { outline, silhouette, far, near } = slab(w, d, Math.min(r, w / 2, d / 2));
  const top = planeAt(p, u, v, t);
  const depth = p.scale * t;
  return (
    <>
      {/* Its whole silhouette in the ground's colour, so what lies behind it stays hidden. */}
      {Array.from({ length: Math.ceil(depth) + 1 }, (_, k) => (
        <path key={k} className={groundFill} transform={`translate(0 ${Math.min(k, depth)}) ${top}`} d={outline} />
      ))}
      <path className={edgeStroke} transform={planeAt(p, u, v)} d={near} />
      {silhouette.map(([su, sv]) => {
        const [x, y] = at(p, u + su, v + sv, t);
        return <path key={su} className={edgeStroke} d={`M${x} ${y}V${y + depth}`} />;
      })}
      <g transform={top}>
        <path className={fill} d={outline} />
        <path className={edgeStroke} d={far} />
        <path className={innerStroke} d={near} />
        {face}
      </g>
    </>
  );
}

const NOTE_GAP = 16;

type Note = { point: Point; name: string; value: string; anchor: "start" | "end"; at: Point; leader: string };

/** A note at `point`, its label off to one side, `toward` past `edge`. */
export function note(point: Point, name: string, value: string, place: { toward: "left" | "right"; edge: number }): Note {
  const [, y] = point;
  const left = place.toward === "left";
  const start = place.edge + (left ? -NOTE_GAP : NOTE_GAP);
  return { point, name, value, anchor: left ? "end" : "start", at: [start, y], leader: segment(point, [start + (left ? 4 : -4), y]) };
}
export function NoteMark({ point, name, value, anchor, at: [x, y], leader }: Note) {
  return (
    <>
      <circle className={inkFill} cx={point[0]} cy={point[1]} r={1.5} />
      <path className={guideStroke} d={leader} />
      <text className={labelText} x={x} y={y} dy="0.35em" textAnchor={anchor}>
        {name && <tspan className={softText}>{name} </tspan>}
        {value}
      </text>
    </>
  );
}

/** What every played figure takes besides its drawing. */
export type PlayedProps = {
  line: number;
  dots: boolean;
  /** The drawing's size against its 1× measure. */
  scale: number;
  /** Moves the drawing from the middle of its space, in px down. */
  shift: number;
  clock: Clock;
  fade: Fade;
  headingRef?: RefObject<HTMLElement | null>;
  label: string;
};

/** The frame a played figure's drawing sits in the middle of, below its heading. */
export function PlayedFigure({
  drawing: { bounds, node },
  line,
  dots,
  shift,
  clock,
  fade,
  headingRef,
  label,
}: Omit<PlayedProps, "scale"> & { drawing: Drawing }) {
  return (
    <FigureFrame line={line} dots={dots} fade={fade} headingRef={headingRef} label={label}>
      {(frame) => {
        const [dx, dy] = centerOffset(bounds, frame.top, frame.width, frame.height);
        return (
          <g
            transform={`translate(${dx} ${dy + shift})`}
            style={{ "--back-ms": msOf(clock.back), "--back-ease": cubic(clock.ease) } as CSSProperties}
          >
            {node}
          </g>
        );
      }}
    </FigureFrame>
  );
}
