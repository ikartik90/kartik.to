"use client";

import { css } from "../../../styled-system/css";
import type { DemoCursorTourState } from "@/hooks/use-demo-cursor-tour";

// ---------------------------------------------------------------------------
// The stand-in cursor a self-playing demo performs with — the pointer you are
// watching rather than the one in your hand.
//
// It is drawn from `/cursors/cursor-selection.svg`, the SAME artwork globals.css
// hands the OS as the site's cursor (that rule takes the PNG exports for the
// compositor's sake; here, where it is an element like any other, the vector is
// the crisper of the two at any DPR). Using anything else would put two
// different arrows on screen at once and give the game away instantly.
//
// Everything below follows from that one asset: the box is its 20×20 frame, and
// the `1 3` hotspot in globals.css is subtracted from every position, so the
// point this component is given is where the TIP lands — which is the only
// coordinate the tour cares about.
// ---------------------------------------------------------------------------

/** The arrow tip inside the 20×20 asset — globals.css's `1 3`, in px. */
const HOTSPOT = { x: 1, y: 3 } as const;

const cursorStyle = css({
  position: "absolute",
  top: 0,
  left: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  // Above everything it can be asked to point at. That includes a POPOVER the
  // tour opened, which portals to the body at 50 — so this clears it, and the
  // cursor must be rendered outside any stacking context of the demo's own
  // (a `clip-path`, a `transform`, an `opacity` below 1) or it is trapped
  // underneath the popover whatever number it carries.
  zIndex: 60,
  // It is a picture of a pointer, so it must never behave like one: no hover
  // states stolen from the cells it crosses, no clicks intercepted.
  pointerEvents: "none",
  opacity: 0,
  transitionProperty: "transform, opacity",
  // Transform's duration is set per move (distance-timed); opacity's is fixed.
  transitionDuration: "0ms, 260ms",
  // Ease-in-out both ways: a cursor accelerates away from where it was and
  // slows into where it is going. A pure ease-out would read as thrown.
  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1), ease",
  "&[data-visible]": { opacity: 1 },
  // The walk-on is the SAME fade as the withdrawal, played the other way — and
  // it needs this to happen at all. The tour hands over `point` and `visible`
  // together, so the arrow is INSERTED already carrying `data-visible`: there is
  // no before-change style for the browser to start a transition from, and it
  // paints straight at full opacity. `@starting-style` supplies that missing
  // origin. Unlike v1's recurrence block this wants no arming flag — the element
  // exists only for the length of a run, so its first render IS the entrance.
  _starting: {
    "&[data-visible]": { opacity: 0 },
  },
});

const glyphStyle = css({
  // A span is inline by default, and an inline box takes neither width nor
  // height — so without this the arrow is a zero-sized nothing.
  display: "block",
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  backgroundImage: 'url("/cursors/cursor-selection.svg")',
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  // Scale about the TIP, so the press dips the arrow into the cell rather than
  // sliding it off the date it is aiming at.
  transformOrigin: "1px 3px",
  transition: "transform 120ms ease",
  "&[data-pressed]": { transform: "scale(0.82)" },
});

const tapStyle = css({
  position: "absolute",
  left: "1px",
  top: "3px",
  width: "token(sizes.calendarDay)",
  height: "token(sizes.calendarDay)",
  // Centred on the tip, which is where the click lands.
  marginLeft: "calc(-1 * token(sizes.calendarDay) / 2)",
  marginTop: "calc(-1 * token(sizes.calendarDay) / 2)",
  borderRadius: "full",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "field.text.active",
  animation: "demoCursorTap 420ms ease-out forwards",
});

export type DemoCursorProps = DemoCursorTourState;

/** The tour's cursor: an arrow at `point`, dipping on `pressed`. */
export function DemoCursor({
  point,
  moveMs,
  pressed,
  taps,
  visible,
}: DemoCursorProps) {
  if (!point) return null;

  return (
    <div
      aria-hidden
      data-demo-cursor
      data-visible={visible || undefined}
      className={cursorStyle}
      style={{
        transform: `translate3d(${point.x - HOTSPOT.x}px, ${point.y - HOTSPOT.y}px, 0)`,
        transitionDuration: `${moveMs}ms, 260ms`,
      }}
    >
      <span className={glyphStyle} data-pressed={pressed || undefined} />
      {/* Keyed by the tap count, so each click mounts a fresh ring and replays
          the animation instead of leaving the spent one on screen. */}
      {taps > 0 ? <span key={taps} className={tapStyle} /> : null}
    </div>
  );
}
