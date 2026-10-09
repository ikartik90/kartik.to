"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cubicBezier } from "@/utils/eased-fade";
import { css } from "../../../styled-system/css";

export type Motion = { move: number; hold: number };
export type Point = [number, number];

// Isometric at 2:1: x runs down-right, z (toward the viewer) down-left.
/** A drawing in the floor's plane (u along x, v along z) at `origin`. */
export const floor = ([x, y]: Point, scale = 1) => `matrix(${scale} ${scale / 2} ${-scale} ${scale / 2} ${x} ${y})`;
export const floorPoint = ([x, y]: Point, u: number, v: number, scale = 1): Point => [
  x + scale * (u - v),
  y + (scale * (u + v)) / 2,
];

// A full-size card (400px tall, 4:3), so a unit is a pixel there and labels draw at their text style's size.
const VIEW_W = 533;
const VIEW_H = 400;

/** How far a drawing spanning `points` moves to sit in the middle of a `width` × `height` frame, below `top`. */
export function centerOffset(points: Point[], top: number, width: number, height: number): Point {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [
    width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2,
    (top + height) / 2 - (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}

/** The frame a drawing lays out in, in its units: `top` is the heading's foot; zoomed in, `left` is its left edge. */
type Frame = { width: number; height: number; top: number; left?: number };

/** The face in px: `foot` is the heading's foot, `left` its inset. */
type Box = { width: number; height: number; foot: number; left: number };

// On a phone, how much of a drawing runs off the card's right.
export const PHONE_CUT = 1 / 3;

/** A drawing `width` wide, from the heading's left edge with `cut` of it off the right; no taller than `height` fits under the heading, its inset clear above and below. */
export type ZoomTo = { width: number; cut: number; height?: number };

/** A drawing spanning `bounds`, moved `shift` down from the middle, zoomed in on a phone no taller than fits. */
export function phoneZoom(bounds: Point[], shift: number): ZoomTo {
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  return {
    width: span(bounds.map(([x]) => x)),
    cut: PHONE_CUT,
    height: span(bounds.map(([, y]) => y)) + 2 * Math.abs(shift),
  };
}

/** The scale `zoom` draws at on `box`, in px a unit. */
export function zoomScale({ width, cut, height }: ZoomTo, box: Box) {
  const across = (box.width - box.left) / ((1 - cut) * width);
  return height ? Math.min(across, (box.height - box.foot - 2 * box.left) / height) : across;
}

/** Where the outline through `points` reaches across `from`–`to`: the heights of every line between them there. */
export function heightsAcross(points: Point[], from: number, to: number) {
  const ys: number[] = [];
  const xs = [from, to, ...points.map(([px]) => px).filter((px) => px > from && px < to)];
  points.forEach(([x1, y1], a) =>
    points.slice(a + 1).forEach(([x2, y2]) =>
      xs.forEach((x) => {
        if (x1 !== x2 && (x - x1) * (x - x2) <= 0) ys.push(y1 + ((x - x1) / (x2 - x1)) * (y2 - y1));
      }),
    ),
  );
  return ys;
}

/**
 * How far a drawing spanning `bounds` moves in `frame`: to the middle of the space under the heading or, zoomed in,
 * to start at the heading's edge (centred across, if it fits) with what shows of it in the middle of that space.
 */
export function placeIn(frame: Frame, bounds: Point[]): Point {
  const [centered, center] = centerOffset(bounds, frame.top, frame.width, frame.height);
  if (frame.left === undefined) return [centered, center];
  const left = Math.min(...bounds.map(([x]) => x));
  const dx = Math.max(centered, frame.left - left);
  const ys = heightsAcross(bounds, left, frame.width - dx);
  return [dx, (frame.top + frame.height - Math.min(...ys) - Math.max(...ys)) / 2];
}

export type Curve = [number, number, number, number];
/** The dots' fade below the heading: `start` and `length` in px from its foot, eased by `amount` (0 linear, 1 `curve`). */
export type Fade = { start: number; length: number; amount: number; curve: Curve };
export const FADE: Fade = { start: -40, length: 160, amount: 1, curve: [0.4, 0.4, 0.24, 1] };

function eased({ amount, curve }: Fade) {
  const ease = cubicBezier(...curve);
  return (t: number) => Math.min(1, Math.max(0, t + (ease(t) - t) * amount));
}
// From `from` px down, its lengths at the drawing's scale `k`; 65 stops, so the ramp shows no edge.
export const fadeBelow = (from: number, fade: Fade, k: number) => {
  const alpha = eased(fade);
  return `linear-gradient(to bottom, ${Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    return `rgb(0 0 0 / ${alpha(t).toFixed(4)}) ${(from + (fade.start + fade.length * t) * k).toFixed(1)}px`;
  }).join(", ")})`;
};

/** An outline through `points` (clockwise) with every corner, convex or concave, rounded to `radius`. */
export function roundedOutline(points: Point[], radius: number) {
  const n = points.length;
  const corners = points.map((p, i) => {
    const prev = points[(i + n - 1) % n];
    const next = points[(i + 1) % n];
    const lengthIn = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    const lengthOut = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const a = [(p[0] - prev[0]) / lengthIn, (p[1] - prev[1]) / lengthIn];
    const b = [(next[0] - p[0]) / lengthOut, (next[1] - p[1]) / lengthOut];
    const cross = a[0] * b[1] - a[1] * b[0];
    const half = Math.tan(Math.atan2(Math.abs(cross), a[0] * b[0] + a[1] * b[1]) / 2);
    // Each corner takes at most half of either edge, so neighbouring corners never overlap.
    const reach = Math.min(radius * half, lengthIn / 2, lengthOut / 2);
    return {
      from: `${p[0] - a[0] * reach} ${p[1] - a[1] * reach}`,
      to: `${p[0] + b[0] * reach} ${p[1] + b[1] * reach}`,
      r: half > 0 ? reach / half : 0,
      sweep: cross > 0 ? 1 : 0,
    };
  });
  const turn = ({ from, to, r, sweep }: (typeof corners)[number]) => `L${from}A${r} ${r} 0 0 ${sweep} ${to}`;
  return `M${corners[0].to}${corners.slice(1).map(turn).join("")}${turn(corners[0])}Z`;
}

/**
 * A rounded slab `w` × `d` on the floor. Its outline turns away halfway round the left and right corners,
 * where the side edges drop (`silhouette`); `far` is the top face's outline between them and `near` the rest of the
 * way round: creases on the top face, the outline at the slab's foot.
 */
export function slab(w: number, d: number, radius: number) {
  const corner = radius * (1 - Math.SQRT1_2);
  const turn = (u: number, v: number) => `A${radius} ${radius} 0 0 1 ${u} ${v}`;
  const silhouette: Point[] = [
    [corner, d - corner],
    [w - corner, corner],
  ];
  const [[lu, lv], [ru, rv]] = silhouette;
  return {
    outline: roundedOutline(
      [
        [0, 0],
        [w, 0],
        [w, d],
        [0, d],
      ],
      radius,
    ),
    silhouette,
    far: `M${lu} ${lv}${turn(0, d - radius)}V${radius}${turn(radius, 0)}H${w - radius}${turn(ru, rv)}`,
    near: `M${ru} ${rv}${turn(w, radius)}V${d - radius}${turn(w - radius, d)}H${radius}${turn(lu, lv)}`,
  };
}

const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** Fades each element in and out in turn, one after the other, forever. */
export function useCycle(refs: RefObject<(Element | null)[]>, { move, hold }: Motion) {
  useEffect(() => {
    const elements = refs.current.filter((el): el is SVGElement => el instanceof SVGElement);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const first = elements[0];
      if (first) first.style.opacity = "1";
      return () => {
        if (first) first.style.opacity = "";
      };
    }
    const step = 2 * move + hold;
    const total = step * elements.length;
    const animations = elements.map((el, i) =>
      el.animate(
        [
          { opacity: 0, offset: 0, easing: EASE },
          { opacity: 1, offset: move / total, easing: EASE },
          { opacity: 1, offset: (move + hold) / total, easing: EASE },
          { opacity: 0, offset: step / total },
          { opacity: 0, offset: 1 },
        ],
        { duration: total, delay: i * step, iterations: Infinity },
      ),
    );
    // On the page's clock, so every copy of a figure shows the same note.
    animations.forEach((animation) => (animation.startTime = 0));
    return () => animations.forEach((animation) => animation.cancel());
  }, [refs, move, hold]);
}

export const groundFill = css({ fill: "bg.canvas" });
// An object's outer edges draw in full ink, the edges within it (creases, one part over another) faint.
export const edgeStroke = css({
  fill: "none",
  stroke: "var(--ink)",
  strokeWidth: "var(--line)",
  vectorEffect: "non-scaling-stroke",
  strokeLinejoin: "round",
  strokeLinecap: "round",
});
export const innerStroke = css({
  fill: "none",
  stroke: "var(--ink-inner)",
  strokeWidth: "var(--line)",
  vectorEffect: "non-scaling-stroke",
  strokeLinejoin: "round",
  strokeLinecap: "round",
});
export const guideStroke = css({
  fill: "none",
  stroke: "var(--ink-soft)",
  strokeWidth: "var(--line)",
  strokeDasharray: "token(spacing.xs) token(spacing.xs)",
  vectorEffect: "non-scaling-stroke",
});
export const hatchStroke = css({
  stroke: "var(--ink-soft)",
  strokeOpacity: 0.5,
  strokeWidth: "var(--line)",
  vectorEffect: "non-scaling-stroke",
});
// Opaque, so a part lifted over another covers it.
export const placeholderFill = css({ fill: "color-mix(in srgb, var(--ink) 20%, token(colors.bg.canvas))" });
export const inkFill = css({ fill: "var(--ink)" });
export const labelText = css({ textStyle: "inlineCode", fill: "var(--ink)", whiteSpace: "pre" });
export const softText = css({ fill: "var(--ink-soft)" });

const BRAND = "token(colors.text.highlight)";

// A figure turns on while its host (`figureHost`) is hovered, focused from the keyboard, or held (`data-figure-held`).
const panelStyle = css({
  "--ink": "token(colors.text.default)",
  "--ink-soft": "color-mix(in srgb, var(--ink) 50%, transparent)",
  "--ink-inner": "color-mix(in srgb, var(--ink) 35%, transparent)",
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  backgroundColor: "bg.canvas",
  // The dots turn brand by colour, not by fading a layer in: Safari puts whatever lies over a fading layer on a
  // layer of its own, half a pixel off, and the drawing shakes.
  "&[data-dots]::before": {
    content: '""',
    position: "absolute",
    zIndex: 0,
    inset: 0,
    // Not `--ink`, so the drawing turning brand on hover leaves the dots as they are.
    color: "text.default",
    backgroundImage:
      "radial-gradient(circle, color-mix(in srgb, currentColor 10%, transparent) 0 token(spacing.3xs), transparent token(spacing.xxs))",
    backgroundSize: "token(spacing.sm) token(spacing.sm)",
    pointerEvents: "none",
    transition: "color 300ms ease",
    maskImage: "var(--dots-mask, none)",
  },
  ":is([data-hover-ink=dots], [data-hover-ink=both]):is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": {
    "&[data-dots]::before": { color: BRAND },
  },
  ":is([data-hover-ink=card], [data-hover-ink=both]):is(:hover, [data-figure-held], html[data-keyboard-focus] :focus-visible) &": { "--ink": BRAND },
  "& :is(path, rect, circle, text, tspan)": { transition: "fill 300ms ease, stroke 300ms ease" },
});

const svgStyle = css({
  position: "absolute",
  zIndex: 1,
  insetInline: 0,
  insetBlockEnd: 0,
  display: "block",
  width: "token(spacing.full)",
  aspectRatio: "4 / 3",
  "&[data-zoomed]": { insetBlockStart: 0, height: "token(spacing.full)", aspectRatio: "auto" },
});

export type ExplodePart = "card" | "chips" | "avatar" | "text" | "icons";
/** `nudge` moves each part from its share of the spread, in px down. */
export type Explode = { spread: number; ms: number; nudge: Record<ExplodePart, number> };
/** What turns to the brand colour while the host is hovered. */
export type HoverInk = "dots" | "card" | "both";

/** What a figure's host carries for the figure to turn on with it. */
export const figureHost = ({
  explode,
  play,
  hoverInk,
  hoverHeading,
}: {
  explode?: boolean;
  play?: boolean;
  hoverInk?: HoverInk;
  hoverHeading?: boolean;
}) => ({
  "data-explode": explode ? "" : undefined,
  "data-play": play ? "" : undefined,
  "data-hover-ink": hoverInk,
  "data-hover-heading": hoverHeading ? "" : undefined,
});

/** The drawing and its ground, filling a host that brings the heading (`headingRef`) the drawing lays out below. */
export function FigureFrame({
  line,
  dots,
  explode,
  fade,
  headingRef,
  zoomTo,
  label,
  children,
}: {
  line: number;
  dots: boolean;
  explode?: Explode;
  fade: Fade;
  headingRef?: RefObject<HTMLElement | null>;
  /** On a face narrower than 4:3, the drawing zooms in (`zoomScale`). */
  zoomTo?: ZoomTo;
  label: string;
  children: (frame: Frame) => ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({ width: 0, height: 0, foot: 0, left: 0 });

  useEffect(() => {
    const panel = panelRef.current;
    const head = headingRef?.current;
    if (!panel) return;
    const measure = () => {
      const [width, height] = [panel.clientWidth, panel.clientHeight];
      const foot = head ? head.offsetTop + head.offsetHeight : 0;
      const left = head ? head.offsetLeft + parseFloat(getComputedStyle(head).paddingLeft) : 0;
      setBox({ width, height, foot, left });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    if (head) observer.observe(head);
    return () => observer.disconnect();
  }, [headingRef]);

  // The face's scale against a full-size card, and the frame the drawing lays out in.
  const k = box.width / VIEW_W;
  const narrow = box.height > 0 && box.width / box.height < VIEW_W / VIEW_H - 0.01;
  const z = narrow && zoomTo ? zoomScale(zoomTo, box) : 0;
  const zoomed = z > 0;
  const frame: Frame = zoomed
    ? { width: box.width / z, height: box.height / z, top: box.foot / z, left: box.left / z }
    : {
        width: VIEW_W,
        height: VIEW_H,
        top: k ? Math.max(0, box.foot - (box.height - (box.width * VIEW_H) / VIEW_W)) / k : 0,
      };

  return (
    <div
      ref={panelRef}
      className={panelStyle}
      data-dots={dots ? "" : undefined}
      style={
        {
          "--line": `${line}px`,
          ...(explode && { "--spread": `${explode.spread}px`, "--explode-ms": `${explode.ms}ms` }),
          ...(box.foot > 0 && { "--dots-mask": fadeBelow(box.foot, fade, k) }),
        } as CSSProperties
      }
    >
      <svg
        className={svgStyle}
        data-zoomed={zoomed ? "" : undefined}
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        role="img"
        aria-label={label}
      >
        {children(frame)}
      </svg>
    </div>
  );
}
