// ---------------------------------------------------------------------------
// Where a scroll box has to be for one of its rows to sit in the middle of it.
//
// Split out from the listbox that uses it because it is the only part of
// "open on the selection" that can be reasoned about without a layout engine:
// jsdom reports every box as zero, so an effect that measures and scrolls is
// unverifiable there (the list's keyboard-cursor effect says as much), while
// the arithmetic it wraps is a plain function of four numbers.
// ---------------------------------------------------------------------------

export interface ScrollToCenterArgs {
  /** The row's offset from the top of the SCROLLED CONTENT, not the viewport. */
  rowTop: number;
  rowHeight: number;
  /** The visible height of the scroll box. */
  boxHeight: number;
  /** The full height of its content. */
  contentHeight: number;
}

/**
 * The `scrollTop` that centres the row — clamped to the scrollable range, so a
 * row near either end settles flush against it rather than asking for an offset
 * the box cannot take. Returns 0 for content that already fits, which is the
 * same answer as "don't scroll".
 */
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
