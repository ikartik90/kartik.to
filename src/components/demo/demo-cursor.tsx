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
  // About the tip (`HOTSPOT`), so a press dips onto the date it aims at.
  transformOrigin: "1px 3px",
  transition: "transform 120ms ease",
  "&[data-pressed]": { transform: "scale(0.82)" },
  "& > svg": { display: "block", width: "token(spacing.full)", height: "token(spacing.full)" },
});

// A selected date's colours, reversed: the secondary brand colour edging the brand colour.
const edgeStyle = css({ stroke: "field.bg.active" });
const bodyStyle = css({ fill: "field.text.active", stroke: "field.text.active" });

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
      {/* The site's selection cursor (public/cursors/cursor-selection.svg), inline so it takes the brand colours. */}
      <span className={glyphStyle} data-pressed={pressed || undefined}>
        <svg viewBox="0 0 20 20" fill="none">
          <path
            className={edgeStyle}
            d="M0.996094 4.18555C0.85963 3.48048 1.57427 2.9411 2.19824 3.21289L2.32129 3.27832L14.6816 11.0615C15.3988 11.5131 15.1198 12.6182 14.2744 12.6748L8.43066 13.0645C8.11121 13.0858 7.82865 13.2797 7.69434 13.5703L5.39258 18.5576C5.03652 19.3291 3.90089 19.1915 3.73926 18.3574L0.996094 4.18555Z"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className={bodyStyle}
            d="M1.60965 4.06651L4.35261 18.2385C4.39874 18.4768 4.7233 18.5162 4.82504 18.2957L7.12669 13.3088C7.3568 12.8103 7.84095 12.4773 8.38885 12.4407L14.2325 12.0512C14.4741 12.0351 14.554 11.7192 14.3491 11.5902L1.9883 3.80745C1.80309 3.69084 1.56806 3.85164 1.60965 4.06651Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {/* Keyed by tap count, so each click mounts a fresh ring and replays it. */}
      {taps > 0 ? <span key={taps} className={tapStyle} /> : null}
    </div>
  );
}
