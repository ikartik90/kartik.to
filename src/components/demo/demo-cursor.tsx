"use client";

import { css } from "../../../styled-system/css";
import type { DemoCursorTourState } from "@/hooks/use-demo-cursor-tour";

/** The arrow tip in the 20×20 asset; must match globals.css's `1 3` hotspot. */
const HOTSPOT = { x: 1, y: 3 } as const;

const cursorStyle = css({
  position: "absolute",
  top: 0,
  left: 0,
  width: "token(spacing.xxl)",
  height: "token(spacing.xxl)",
  // Above popovers (50). Render it outside the demo's stacking contexts or it sits beneath them.
  zIndex: 60,
  pointerEvents: "none",
  opacity: 0,
  transitionProperty: "transform, opacity",
  // Transform's duration is set per move; opacity's is fixed.
  transitionDuration: "0ms, 260ms",
  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1), ease",
  "&[data-visible]": { opacity: 1 },
  // The arrow mounts already visible, so the fade-in needs a starting style.
  _starting: {
    "&[data-visible]": { opacity: 0 },
  },
});

const glyphStyle = css({
  display: "block",
  width: "token(spacing.full)",
  height: "token(spacing.full)",
  backgroundImage: 'url("/cursors/cursor-selection.svg")',
  backgroundSize: "contain",
  backgroundRepeat: "no-repeat",
  // About the tip (`HOTSPOT`), so a press dips onto the date it aims at.
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
  marginLeft: "calc(-1 * token(sizes.calendarDay) / 2)",
  marginTop: "calc(-1 * token(sizes.calendarDay) / 2)",
  borderRadius: "full",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "field.text.active",
  animation: "demoCursorTap 420ms ease-out forwards",
});

export type DemoCursorProps = DemoCursorTourState;

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
      {/* Keyed by tap count, so each click mounts a fresh ring and replays it. */}
      {taps > 0 ? <span key={taps} className={tapStyle} /> : null}
    </div>
  );
}
