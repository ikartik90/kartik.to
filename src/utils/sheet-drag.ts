// ---------------------------------------------------------------------------
// Dragging a bottom sheet away — the two questions the gesture asks.
//
// Where the sheet sits while a finger is on it, and whether letting go means
// "put it back" or "take it away". Both are arithmetic, so both live here
// rather than inside the pointer bookkeeping in `useSheetDrag`.
//
// A sheet answers to two different gestures that mean the same thing: a slow
// pull far enough down that the intent is unmistakable, and a flick that is
// over before it has travelled anywhere. Judging only on distance loses the
// flick, which is the one people actually make on a phone.
// ---------------------------------------------------------------------------

/** How far down, as a share of the sheet's own height, a slow drag must reach. */
export const DISMISS_FRACTION = 0.25;

/** A flick, in pixels per millisecond — about a screen's height in a third of a second. */
export const FLICK_SPEED = 1.2;

/**
 * Under this, a gesture is a press that wobbled rather than a flick. Without
 * it the speed test would dismiss on the twitch of putting a finger down.
 */
const FLICK_TRAVEL = 8;

/** Where the sheet sits for a finger that has travelled `dy` from where it went down. */
export function dragOffset(dy: number): number {
  // Downwards only. The sheet's height is a decision the layout has made, not
  // a starting point to drag past — pulling up would promise a taller sheet
  // that then snaps back the moment the finger lifts.
  return Math.max(0, dy);
}

export interface SheetRelease {
  /** How far down the sheet has been dragged. */
  offset: number;
  /** The sheet's own height, which the distance threshold is a share of. */
  height: number;
  /** Downward speed at the moment of release, in pixels per millisecond. */
  speed: number;
}

/** Whether letting go here takes the sheet away rather than putting it back. */
export function shouldDismiss({
  offset,
  height,
  speed,
}: SheetRelease): boolean {
  if (offset >= height * DISMISS_FRACTION) return true;
  return speed >= FLICK_SPEED && offset >= FLICK_TRAVEL;
}
