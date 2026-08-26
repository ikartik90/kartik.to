"use client";

import { css, cx } from "../../styled-system/css";

// ---------------------------------------------------------------------------
// The unsaved-work mark: a 2.5px brand dot hung off the control it belongs to.
//
// Global because there are two of them now — the aspect rail marks a SHAPE
// whose framing has moved, and the presets strip marks a COVER holding edits
// that have not been written. They are the same claim about different nouns, so
// what a dot IS lives here and only WHERE it hangs is the consumer's.
//
// The brand hue, and specifically the token the focus ring uses rather than
// `bg.selection` — the two are inverted (pink/orange against orange/pink), and
// these dots share a surface with the presets strip's selection ring, which is
// already the focus-ring one. Two branded marks disagreeing about which brand
// colour they were would read as a mistake.
// ---------------------------------------------------------------------------

const dotStyle = css({
  position: "absolute",
  // Centred on whatever it is hung from; the consumer supplies the block edge.
  insetInlineStart: "token(spacing.half)",
  translate: "-50% 0",
  width: "2.5px",
  height: "2.5px",
  // 50%, which is a CIRCLE only because the box is square — `radii` has no
  // `half`, and `token(radii.half)` silently resolves to nothing and draws a
  // square. `radii.full` would round it too, but that token is the pill
  // (9999px) and means "however wide this gets, keep the ends round", which is
  // not what a fixed 2.5px dot is asking for.
  borderRadius: "token(spacing.half)",
  backgroundColor: "border.focusRing",
  // A note, not a target — it must never intercept a press aimed at the control
  // it hangs from.
  pointerEvents: "none",
});

/**
 * @param className where it hangs — the consumer's own block offset. The
 * element it is positioned against must be `position: relative` and must not
 * clip its overflow, which is the half no test can see: a clipped dot is
 * measurable in the DOM, correct in every assertion, and painted nowhere.
 */
export function UnsavedDot({ className }: { className?: string }) {
  return <span className={cx(dotStyle, className)} data-unsaved aria-hidden />;
}
