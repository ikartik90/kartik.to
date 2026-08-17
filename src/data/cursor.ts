// The custom cursor is drawn by the OS via `cursor: image-set(...)` in
// globals.css (asset + hotspot live there). These offsets place a tooltip
// relative to that cursor's visual position.
export const CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } as const;

/** Kept clear of the viewport edge when the label has to be pinned to it. */
const EDGE_MARGIN = 12;

interface TooltipFit {
  /** The label's measured width. */
  width: number;
  viewportWidth: number;
}

/**
 * Places a fixed tooltip at the bottom-right of the custom selection cursor.
 *
 * Given the label's width it will also keep it on screen. The offset above is a
 * point on the cursor's bottom edge that the label hangs from by its top-LEFT
 * corner, trailing off to the right. A control in the right-hand gutter opens
 * its label straight into the viewport edge, so there the label hangs from that
 * same point by its top-RIGHT corner instead: it drops below the cursor rather
 * than beside it, which is the direction with room in it. Swinging about the
 * one anchor is what keeps the two placements reading as one label — it never
 * detaches from the cursor to reappear across a gap on the far side.
 *
 * Under the cursor it can still be too wide for the viewport — a long label on
 * a phone. Then it gives up hanging from the cursor before it gives up being
 * readable, and pins clear of the near edge.
 *
 * Called without `fit` (no measurement to hand) it is the plain offset it
 * always was.
 */
export function getCursorTooltipPosition(
  clientX: number,
  clientY: number,
  fit?: TooltipFit,
) {
  const top = `${clientY + CURSOR_TOOLTIP_OFFSET.y}px`;
  const anchor = clientX + CURSOR_TOOLTIP_OFFSET.x;

  if (!fit) return { left: `${anchor}px`, top };

  const overflowsRight = anchor + fit.width > fit.viewportWidth - EDGE_MARGIN;
  if (!overflowsRight) return { left: `${anchor}px`, top };

  return { left: `${Math.max(EDGE_MARGIN, anchor - fit.width)}px`, top };
}
