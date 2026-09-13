// The custom cursor is drawn by the OS via `cursor: image-set(...)` in
// globals.css (asset + hotspot live there). These offsets place a tooltip
// relative to that cursor's visual position.
export const CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } as const;

/** Clearance the label keeps from whichever container edge it is running into. */
const EDGE_GAP = 4;

/**
 * How far under its anchor a tooltip hangs when it is hung under one rather
 * than trailed from the cursor. Close enough to read as attached to the thing
 * it names — which is the whole point of anchoring it — and clear enough not
 * to look welded on.
 */
export const ANCHORED_TOOLTIP_GAP = 2;

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
 * Unless the cursor is ON the rail — then the rail is not in the way, it is
 * what is being pointed at, and its own controls' labels belong over it. The
 * reserved strip exists to keep a label drawn over the PAGE from sliding under
 * the panel; applied to a control INSIDE the panel it does the reverse, throwing
 * that label out into the page. The pointer's own x answers which case this is,
 * with no need to know what element it came from.
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

  // See above: a pointer inside the reserved strip is on the panel, so the
  // whole viewport is its label's to use.
  const reserved = fit.reservedRight ?? 0;
  const onReserved = clientX >= fit.viewportWidth - reserved;

  // The furthest right the label may start and still leave the gap. Both the
  // test and the landing place, so the slide can only ever end exactly on the
  // gap it was checking for.
  const usableRight = fit.viewportWidth - (onReserved ? 0 : reserved);
  const rightmost = usableRight - EDGE_GAP - fit.width;

  if (anchor <= rightmost) return { left: `${anchor}px`, top: `${top}px` };

  return {
    left: `${Math.max(EDGE_GAP, rightmost)}px`,
    top: `${top + SHIFTED_DROP}px`,
  };
}

/** The box a tooltip is hung under — a `DOMRect`, or the three parts of one. */
export interface TooltipAnchor {
  left: number;
  width: number;
  bottom: number;
}

/**
 * Places a fixed tooltip centred under the element it names.
 *
 * The other placement, for the case where trailing the cursor would be
 * answering a question the page has already answered: the icons grid marks a
 * SELECTED tile in the brand colour, so a label following the pointer around
 * would be pointing at something that is already pointed at. Hung under the
 * tile instead, it reads as that tile's name rather than as the cursor's.
 *
 * Same edge rules as {@link getCursorTooltipPosition} — it slides in to leave
 * `EDGE_GAP`, and measures the near edge against a docked panel rather than
 * the viewport, since a fixed rail takes no space in the layout and a label
 * placed against the viewport would paint underneath it. Two differences, both
 * because there is no cursor in this one:
 *
 *   - it can run into EITHER edge, being centred rather than hung to one side;
 *   - having slid, it does not drop. `SHIFTED_DROP` exists to clear a cursor
 *     glyph the label has come to sit under, and there is no glyph here.
 *
 * The panel exception is gone too. That one asks whether the POINTER is on the
 * rail, and an anchored label has no pointer — its anchor is an element in the
 * page, which is never the rail.
 */
export function getAnchoredTooltipPosition(
  anchor: TooltipAnchor,
  fit?: TooltipFit,
) {
  const top = anchor.bottom + ANCHORED_TOOLTIP_GAP;

  if (!fit) return { left: `${anchor.left}px`, top: `${top}px` };

  const centred = anchor.left + anchor.width / 2 - fit.width / 2;
  const usableRight = fit.viewportWidth - (fit.reservedRight ?? 0);
  const rightmost = usableRight - EDGE_GAP - fit.width;

  // Far edge last, so a label too wide for the space left gives up the near
  // edge rather than running off the start of the line.
  const left = Math.max(EDGE_GAP, Math.min(centred, rightmost));

  return { left: `${left}px`, top: `${top}px` };
}
