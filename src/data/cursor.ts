// Relative to the OS cursor's hotspot set in globals.css (`cursor: image-set(...)`).
export const CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } as const;

const EDGE_GAP = 4;

export const ANCHORED_TOOLTIP_GAP = 2;

/** Clears the cursor glyph a slid label ends up under. */
const SHIFTED_DROP = 2;

interface TooltipFit {
  width: number;
  viewportWidth: number;
  /** Width of a fixed panel docked over the viewport's right edge. */
  reservedRight?: number;
}

/**
 * Hangs a tooltip off the cursor. With `fit`, slides it left to clear the right
 * edge, or a docked panel unless the pointer is on that panel.
 */
export function getCursorTooltipPosition(
  clientX: number,
  clientY: number,
  fit?: TooltipFit,
) {
  const top = clientY + CURSOR_TOOLTIP_OFFSET.y;
  const anchor = clientX + CURSOR_TOOLTIP_OFFSET.x;

  if (!fit) return { left: `${anchor}px`, top: `${top}px` };

  const reserved = fit.reservedRight ?? 0;
  const onReserved = clientX >= fit.viewportWidth - reserved;

  const usableRight = fit.viewportWidth - (onReserved ? 0 : reserved);
  const rightmost = usableRight - EDGE_GAP - fit.width;

  if (anchor <= rightmost) return { left: `${anchor}px`, top: `${top}px` };

  return {
    left: `${Math.max(EDGE_GAP, rightmost)}px`,
    top: `${top + SHIFTED_DROP}px`,
  };
}

export interface TooltipAnchor {
  left: number;
  width: number;
  bottom: number;
}

/** Centres a tooltip under `anchor`, kept clear of both edges and any docked panel. */
export function getAnchoredTooltipPosition(
  anchor: TooltipAnchor,
  fit?: TooltipFit,
) {
  const top = anchor.bottom + ANCHORED_TOOLTIP_GAP;

  if (!fit) return { left: `${anchor.left}px`, top: `${top}px` };

  const centred = anchor.left + anchor.width / 2 - fit.width / 2;
  const usableRight = fit.viewportWidth - (fit.reservedRight ?? 0);
  const rightmost = usableRight - EDGE_GAP - fit.width;

  // Max last: a label too wide for the space keeps its start on screen.
  const left = Math.max(EDGE_GAP, Math.min(centred, rightmost));

  return { left: `${left}px`, top: `${top}px` };
}
