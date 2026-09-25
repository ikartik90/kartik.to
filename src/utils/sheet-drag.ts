/** Share of the sheet's height a slow drag must reach. */
export const DISMISS_FRACTION = 0.25;

/** In px/ms: about a screen's height in a third of a second. */
export const FLICK_SPEED = 1.2;

/** Below this travel (px), a fast release is a wobbling press, not a flick. */
const FLICK_TRAVEL = 8;

export function dragOffset(dy: number): number {
  // Downwards only: pulling up would promise a taller sheet that snaps back.
  return Math.max(0, dy);
}

export interface SheetRelease {
  offset: number;
  height: number;
  /** Downward, in px/ms. */
  speed: number;
}

export function shouldDismiss({
  offset,
  height,
  speed,
}: SheetRelease): boolean {
  if (offset >= height * DISMISS_FRACTION) return true;
  return speed >= FLICK_SPEED && offset >= FLICK_TRAVEL;
}
