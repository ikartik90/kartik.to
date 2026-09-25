"use client";

import { css, cx } from "../../styled-system/css";

// The focus-ring token, not `bg.selection`, to match the presets strip's selection ring.
const dotStyle = css({
  position: "absolute",
  insetInlineStart: "token(spacing.half)",
  translate: "-50% 0",
  // Sized through a variable, not a className, so no two atomic widths fight on source order.
  width: "var(--unsaved-dot-size, 2.5px)",
  height: "var(--unsaved-dot-size, 2.5px)",
  // `radii` has no `half`: `token(radii.half)` resolves to nothing and draws a square.
  borderRadius: "token(spacing.half)",
  backgroundColor: "border.focusRing",
  pointerEvents: "none",
});

/** `className` sets the block offset and `--unsaved-dot-size`; the parent must be relative and unclipped. */
export function UnsavedDot({ className }: { className?: string }) {
  return <span className={cx(dotStyle, className)} data-unsaved aria-hidden />;
}
