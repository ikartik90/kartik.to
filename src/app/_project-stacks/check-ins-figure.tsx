"use client";

import { useId } from "react";
import { edgeStroke, groundFill, innerStroke, type Point } from "./figure";
import {
  Block,
  LIFT,
  NoteMark,
  PlayedFigure,
  at,
  cubic,
  fixed,
  labelsStyle,
  moveStyle,
  moving,
  note,
  pivotStyle,
  segment,
  showStyle,
  timed,
  tintFill,
  type Clock,
  type Drawing,
  type Framing,
  type PlayedProps,
  type Projection,
} from "./figure-parts";
import { timeAt } from "./shift-figure";

// Check-ins as a dial clocked in at seven; hovering sweeps the hand round to three, the hours it passes lighting up.

export const CHECK_INS_FRAMING: Framing = { scale: 1.25, shift: 4 };
export const CHECK_INS_CLOCK: Clock = { ms: 1800, ease: LIFT, press: 200, back: 900 };

// Clocked in at seven, out at three: 12-hour dial, quarter-hour ticks.
const DIAL = { r: 96, thick: 6, hand: 66, from: 7, to: 15, ticks: 48 };

function dial(p: Projection, { ms, ease, back }: Clock, id: string): Drawing {
  const { r, thick, hand } = DIAL;
  const lift = cubic(ease);
  const a0 = (DIAL.from % 12) * 30;
  const sweep = (DIAL.to - DIAL.from) * 30;
  // On the face, from its corner: twelve o'clock points away from the viewer, and the hours run clockwise.
  const toward = (deg: number, radius: number): Point => {
    const a = (deg * Math.PI) / 180;
    return [
      fixed(r + (radius * (Math.sin(a) - Math.cos(a))) / Math.SQRT2),
      fixed(r + (radius * (-Math.sin(a) - Math.cos(a))) / Math.SQRT2),
    ];
  };
  // A tick lights as the hand comes within half a tick of it, and goes out as the hand, going back, leaves it as far
  // behind: the ease-out's crawl over the last few degrees would otherwise hold the last tick, and the Out time
  // shown with it, long after the hand looks arrived.
  const near = 360 / DIAL.ticks / 2 / sweep;
  const reached = (f: number) => ms * timeAt(ease, f - near);
  const passedBack = (f: number) => back * timeAt(ease, 1 - f + near);
  const ticks = Array.from({ length: DIAL.ticks }, (_, k) => {
    const deg = (k * 360) / DIAL.ticks;
    const past = (deg - a0 + 360) % 360;
    return {
      k,
      d: segment(toward(deg, r - 8), toward(deg, r - (k % 4 === 0 ? 18 : 13))),
      f: past <= sweep ? past / sweep : undefined,
    };
  });
  // A filled sector `from`–`to` degrees, clockwise.
  const sector = (from: number, to: number) =>
    `M${r} ${r}L${toward(from, hand)}A${hand} ${hand} 0 ${to - from > 180 ? 1 : 0} 1 ${toward(to, hand)}Z`;
  const turning = moving(`rotate(${sweep}deg)`, ms, lift);
  // The hours worked, in pieces no wider than the dial's unworked span, each clipped to its own and filled by a
  // sector turning in with the hand from behind the In mark: one piece would wrap round into view past the far end.
  // Each piece's sector fills it at the end and stays out of it at rest, the spare split either side; neighbours
  // overlap by a degree, so no seam shows.
  const count = Math.ceil(sweep / ((360 - sweep) * (2 / 3)));
  const pieces = Array.from({ length: count }, (_, k) => {
    const [from, to] = [(k * sweep) / count, ((k + 1) * sweep) / count];
    return {
      clip: sector(a0 + from - (k > 0 ? 1 : 0), a0 + to + (k < count - 1 ? 1 : 0)),
      fill: sector(a0 - (sweep - from + 360 - to) / 2, a0),
    };
  });
  const face = (
    <>
      {pieces.map(({ clip, fill }, k) => (
        <g key={k}>
          <clipPath id={`${id}-worked-${k}`}>
            <path d={clip} />
          </clipPath>
          <g clipPath={`url(#${id}-worked-${k})`}>
            <g className={`${moveStyle} ${pivotStyle}`} style={turning}>
              <circle cx={r} cy={r} r={r} fill="none" />
              <path className={tintFill} d={fill} />
            </g>
          </g>
        </g>
      ))}
      <path className={innerStroke} d={ticks.map(({ d }) => d).join("")} />
      {ticks.map(({ k, d, f }) =>
        f === 0 ? (
          <path key={k} className={edgeStroke} d={d} />
        ) : f !== undefined ? (
          <g key={k} className={showStyle} style={timed(reached(f), passedBack(f), 150)}>
            <path className={edgeStroke} d={d} />
          </g>
        ) : null,
      )}
      <path className={innerStroke} d={segment(toward(a0, 0), toward(a0, hand))} />
      <g className={`${moveStyle} ${pivotStyle}`} style={turning}>
        <circle cx={r} cy={r} r={r} fill="none" />
        <path className={edgeStroke} d={segment(toward(a0 + 180, 12), toward(a0, hand))} />
      </g>
      <circle className={groundFill} cx={r} cy={r} r={4} />
      <circle className={edgeStroke} cx={r} cy={r} r={4} />
    </>
  );
  const onFloor = ([x, y]: Point, h: number) => at(p, x - r, y - r, h);
  const rim = Array.from({ length: 24 }, (_, k) => toward(k * 15, r));
  const extent = rim.map((point) => onFloor(point, thick));
  const [left, right] = [Math.min(...extent.map(([x]) => x)), Math.max(...extent.map(([x]) => x))];
  const notes = [
    { delay: 0, shown: true, note: note(onFloor(toward(a0, r), thick), "In", "07:00", { toward: "left", edge: left }) },
    {
      delay: reached(1),
      shown: false,
      note: note(onFloor(toward(a0 + sweep, r), thick), "Out", "15:00", { toward: "right", edge: right }),
    },
  ];

  return {
    // Centred on the dial alone; the labels sit either side without moving it.
    bounds: [...extent, ...rim.map((point) => onFloor(point, 0))],
    node: (
      <>
        <Block p={p} u={-r} v={-r} w={2 * r} d={2 * r} t={thick} r={r} fill={groundFill} face={face} />
        <g className={labelsStyle}>
          {notes.map(({ delay, shown, note }) =>
            shown ? (
              <NoteMark key={note.name} {...note} />
            ) : (
              <g key={note.name} className={showStyle} style={timed(delay)}>
                <NoteMark {...note} />
              </g>
            ),
          )}
        </g>
      </>
    ),
  };
}

export function CheckInsDrawing({ scale, clock, ...props }: PlayedProps) {
  const id = useId();
  return <PlayedFigure drawing={dial({ scale }, clock, id)} clock={clock} {...props} />;
}
