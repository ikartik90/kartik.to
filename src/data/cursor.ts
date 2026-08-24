// The custom cursor is drawn by the OS via `cursor: image-set(...)` in
// globals.css (asset + hotspot live there). These offsets place a tooltip
// relative to that cursor's visual position.
export const CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } as const;

/** Clearance the label keeps from whichever container edge it is running into. */
const EDGE_GAP = 4;

/**
 * Extra drop for a label that has been shifted.
 *
 * It slides left rather than swinging to the far side of the cursor, so at the
 * end of that travel it is sitting directly beneath the cursor glyph instead of
 * out beside it. Two pixels is what separates the two again.
 */
const SHIFTED_DROP = 2;

interface TooltipFit {
  /** The label's measured width. */
  width: number;
  viewportWidth: number;
  /**
   * How much of the viewport's trailing edge is already spoken for — a docked
   * properties panel, which is `position: fixed` and therefore lies OVER the
   * page rather than beside it. Fitting on screen and being seen are two
   * different questions once one of those is up, and this is what separates
   * them. Defaults to none.
   */
  reservedRight?: number;
}

/**
 * Places a fixed tooltip at the bottom-right of the custom selection cursor.
 *
 * Given the label's width it will also keep it VISIBLE. The offset above is a
 * point on the cursor's bottom edge that the label hangs from by its top-LEFT
 * corner, trailing off to the right.
 *
 * A control in the right-hand gutter opens its label straight into the near
 * edge. It gives up the least it can to fix that: it holds its y, keeps hanging
 * to the right, and SLIDES LEFT by exactly the overflow, coming to rest with
 * `EDGE_GAP` clear of the edge. A pixel of overflow costs a pixel of travel, so
 * the label creeps as the pointer does rather than jumping the moment it stops
 * fitting — which is what a placement that swung about the anchor to the
 * cursor's far side used to do. Having slid, it is under the cursor rather than
 * beside it, and `SHIFTED_DROP` is what puts it back in the clear.
 *
 * That near edge is the viewport's only while nothing is docked over it.
 * `reservedRight` moves it inwards, and it has to: a fixed panel takes no space
 * in the layout, so a label placed against the VIEWPORT sits happily on screen
 * and paints underneath the rail. Same slide, measured against the edge that is
 * actually there.
 *
 * The label can still be too wide for the container — a long one on a phone.
 * Then the slide would carry it off the far edge, and it stops at `EDGE_GAP`
 * from that one instead: it gives up hanging from the cursor before it gives up
 * being readable.
 *
 * Called without `fit` (no measurement to hand) it is the plain offset it
 * always was.
 */
export function getCursorTooltipPosition(
  clientX: number,
  clientY: number,
  fit?: TooltipFit,
) {
  const top = clientY + CURSOR_TOOLTIP_OFFSET.y;
  const anchor = clientX + CURSOR_TOOLTIP_OFFSET.x;

  if (!fit) return { left: `${anchor}px`, top: `${top}px` };

  // The furthest right the label may start and still leave the gap. Both the
  // test and the landing place, so the slide can only ever end exactly on the
  // gap it was checking for.
  const usableRight = fit.viewportWidth - (fit.reservedRight ?? 0);
  const rightmost = usableRight - EDGE_GAP - fit.width;

  if (anchor <= rightmost) return { left: `${anchor}px`, top: `${top}px` };

  return {
    left: `${Math.max(EDGE_GAP, rightmost)}px`,
    top: `${top + SHIFTED_DROP}px`,
  };
}
