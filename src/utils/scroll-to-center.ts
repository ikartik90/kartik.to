export interface ScrollToCenterArgs {
  /** Offset from the top of the scrolled content, not the viewport. */
  rowTop: number;
  rowHeight: number;
  boxHeight: number;
  contentHeight: number;
}

/** Clamped to the scrollable range; 0 when the content already fits. */
export function scrollToCenter({
  rowTop,
  rowHeight,
  boxHeight,
  contentHeight,
}: ScrollToCenterArgs): number {
  const max = Math.max(contentHeight - boxHeight, 0);
  const centred = rowTop + rowHeight / 2 - boxHeight / 2;
  return Math.min(Math.max(centred, 0), max);
}
