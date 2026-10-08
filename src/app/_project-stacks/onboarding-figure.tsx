"use client";

import { useId, type ReactNode } from "react";
import { css } from "../../../styled-system/css";
import { edgeStroke, groundFill, guideStroke, innerStroke } from "./figure";
import {
  Block,
  LIFT,
  PlayedFigure,
  at,
  cubic,
  moveStyle,
  moving,
  planeAt,
  segment,
  showStyle,
  step,
  timed,
  tintFill,
  type Clock,
  type Drawing,
  type Framing,
  type PlayedProps,
  type Projection,
} from "./figure-parts";

// Onboarding as exclusive access: speed gates with a badge over the reader; hovering presses it onto the reader and
// the glass wings slide open.

export const ONBOARDING_FRAMING: Framing = { scale: 1.6, shift: -4 };
/** `ms`: the wings sliding open; `press`: the badge pressing onto the reader; `back`: all of it in reverse, on leave. */
export const ONBOARDING_CLOCK: Clock = { ms: 700, ease: LIFT, press: 220, back: 700 };

/** Draws on a face standing upright along u, from (`u`, `v`) at `top`: x runs along u, y down. */
const upright = (p: Projection, u: number, v: number, top: number) => {
  const [ox, oy] = at(p, u, v, top);
  const [[ax, ay], [bx, by]] = [step(p, 1, 0), step(p, 0, 0, -1)];
  return `matrix(${ax} ${ay} ${bx} ${by} ${ox} ${oy})`;
};

/** Every corner of a box spanning `us` × `vs` × `hs`. */
const corners = (p: Projection, us: number[], vs: number[], hs: number[]) =>
  us.flatMap((u) => vs.flatMap((v) => hs.map((h) => at(p, u, v, h))));

// Two cabinets either side of a lane, glass wings across it, taller than the cabinets, that slide back into them,
// and a reader on the left one's top, near its front, with the badge held over it.
const CABINET = { w: 26, d: 84, h: 34, r: 8 };
const LANE = 56;
const WING = { v: -42, low: 7, high: 56, r: 7, gap: 4, stop: 3, grip: 5 };
const READER = { v: -15, size: 14, r: 3.5 };
const BADGE = { w: 21, d: 27, over: 20, r: 3.5 };
const glassFill = css({ fill: "color-mix(in srgb, var(--ink) 6%, token(colors.bg.canvas))" });

function badge(p: Projection, { ms, ease, press }: Clock, id: string): Drawing {
  const s = p.scale;
  const lift = cubic(ease);
  const { w, d, h, r } = CABINET;
  const right = w + LANE;
  // The wings' plane, from the left cabinet's outer side: x along u, y down from the wings' tops.
  const plane = upright(p, 0, WING.v, WING.high);
  const top = WING.high - h;
  const span = (LANE - WING.gap) / 2;
  const tall = WING.high - WING.low;
  // Each wing reaches `grip` into its cabinet, closed, and stops `stop` short of the cabinet's outer side, open.
  const travel = w - WING.grip - WING.stop;
  // Where each copy of a wing shows: out in the lane or above the cabinets.
  const clips = {
    left: `M${w} -100H1000V200H${w}Z M-1000 -100H1000V${top}H-1000Z`,
    lane: `M${right} -100H-1000V200H${right}Z`,
    above: `M-1000 -100H1000V${top}H-1000Z`,
  };
  const pad = { u: (w - READER.size) / 2, v: READER.v - READER.size / 2 };
  const card = { u: w / 2 - BADGE.w / 2, v: READER.v - BADGE.d / 2 };
  // The reader's middle, and the card's above it.
  const [reads, held] = [at(p, w / 2, READER.v, h), at(p, w / 2, READER.v, h + BADGE.over)];
  // Down onto the reader, held there until leave.
  const pressing = (node: ReactNode) => (
    <g className={moveStyle} style={moving(`translateY(${s * (BADGE.over - 1)}px)`, press, lift)}>
      {node}
    </g>
  );

  // The badge presses onto the reader, the reader lights, and the wings slide away; on leave the badge lifts, the
  // reader goes dark and the wings slide back.
  const opens = press + 80;
  const wing = (side: 0 | 1, clip: keyof typeof clips) => {
    const [x, by] = side === 0 ? [w - WING.grip, -travel] : [right - span, travel];
    const length = span + WING.grip;
    // A glint across the glass, near its free edge.
    const glint = side === 0 ? x + length - 10 : x + 10;
    // Where the glass meets its cabinet: down the cabinet's side on the lane, and along its top as far in as the
    // glass has gone.
    const [face, cabinet] = side === 0 ? [w, `M0 ${top - 2}H${w}V${top + 2}H0Z`] : [right, `M${right} ${top - 2}H${right + w}V${top + 2}H${right}Z`];
    const moved = moving(`translateX(${by}px)`, ms, lift, opens);
    // Rounded but for the foot of the edge inside the cabinet.
    const rw = WING.r;
    const [x0, x1] = [x, x + length];
    const pane =
      side === 0
        ? `M${x0} ${tall}V${rw}A${rw} ${rw} 0 0 1 ${x0 + rw} 0H${x1 - rw}A${rw} ${rw} 0 0 1 ${x1} ${rw}V${tall - rw}A${rw} ${rw} 0 0 1 ${x1 - rw} ${tall}Z`
        : `M${x1} ${tall}V${rw}A${rw} ${rw} 0 0 0 ${x1 - rw} 0H${x0 + rw}A${rw} ${rw} 0 0 0 ${x0} ${rw}V${tall - rw}A${rw} ${rw} 0 0 0 ${x0 + rw} ${tall}Z`;
    return (
      <g transform={plane}>
        <clipPath id={`${id}-wing-${clip}`}>
          <path d={clips[clip]} />
        </clipPath>
        <g clipPath={`url(#${id}-wing-${clip})`}>
          <g className={moveStyle} style={moved}>
            <path className={glassFill} d={pane} />
            <path className={innerStroke} d={`M${glint - 4} 18L${glint + 4} 10M${glint - 4} 26L${glint + 4} 18`} />
            <path className={edgeStroke} d={pane} />
          </g>
        </g>
        {/* Outside the clip, whose edge it lies on: clipped, half its width would go. */}
        {clip !== "above" && <path className={edgeStroke} d={`M${face} ${top}V${tall}`} />}
        {clip !== "lane" && (
          <>
            <clipPath id={`${id}-seam-${clip}`}>
              <path d={cabinet} />
            </clipPath>
            <g clipPath={`url(#${id}-seam-${clip})`}>
              <g className={moveStyle} style={moved}>
                <path className={edgeStroke} d={`M${x0} ${top}H${x1}`} />
              </g>
            </g>
          </>
        )}
      </g>
    );
  };
  const reader = (
    <>
      <rect className={innerStroke} x={pad.u} y={pad.v + d} width={READER.size} height={READER.size} rx={READER.r} />
      <g className={showStyle} style={timed(press, 0, 120)}>
        <rect className={tintFill} x={pad.u} y={pad.v + d} width={READER.size} height={READER.size} rx={READER.r} />
        <rect className={edgeStroke} x={pad.u} y={pad.v + d} width={READER.size} height={READER.size} rx={READER.r} />
      </g>
    </>
  );

  return {
    bounds: [
      ...corners(p, [0, right + w], [-d, 0], [0, h]),
      ...corners(p, [w, right], [WING.v], [WING.high]),
      ...corners(p, [card.u, card.u + BADGE.w], [card.v, card.v + BADGE.d], [h + BADGE.over]),
    ],
    node: (
      <>
        <Block p={p} u={0} v={-d} w={w} d={d} t={h} r={r} fill={groundFill} face={reader} />
        {wing(0, "left")}
        {/* The right wing in two copies: out in the lane, under the right cabinet, and above the cabinet, over it. */}
        {wing(1, "lane")}
        <Block p={p} u={right} v={-d} w={w} d={d} t={h} r={r} fill={groundFill} />
        {wing(1, "above")}
        {/* The card's path down to the reader, travelling with it, and gone where it would pass below the reader. */}
        <clipPath id={`${id}-path`}>
          <rect x={-1000} y={-1000} width={2000} height={1000 + reads[1]} />
        </clipPath>
        <g clipPath={`url(#${id}-path)`}>{pressing(<path className={guideStroke} d={segment(reads, held)} />)}</g>
        {pressing(
          <g transform={planeAt(p, card.u, card.v, h + BADGE.over)}>
            <rect className={groundFill} width={BADGE.w} height={BADGE.d} rx={BADGE.r} />
            <rect className={innerStroke} x={BADGE.w / 2 - 4} y={3} width={8} height={2.5} rx={1.25} />
            <rect className={tintFill} x={4} y={8.5} width={8} height={9} rx={1.5} />
            <path className={innerStroke} d={`M4 21H${BADGE.w - 4}M4 24H${BADGE.w - 9}`} />
            <rect className={edgeStroke} width={BADGE.w} height={BADGE.d} rx={BADGE.r} />
          </g>,
        )}
      </>
    ),
  };
}

export function OnboardingDrawing({ scale, clock, ...props }: PlayedProps) {
  const id = useId();
  return <PlayedFigure drawing={badge({ scale }, clock, id)} clock={clock} {...props} />;
}
