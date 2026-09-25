// Browsers latch a wheel gesture to the first box that consumed it, so a nested scroller
// at its end never chains outward. This decides which box takes the wheel instead.

export interface ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** An `overflow: hidden` shell overflows but never moves, so it takes no wheel. */
  scrollable: boolean;
  /** `overscroll-behavior` `contain`/`none`: the box may scroll itself but chains nothing out. */
  sealed: boolean;
}

/** Fractional layout leaves `scrollTop` a hair short of its maximum. */
const TOLERANCE = 1;

export function hasRoomToScroll(box: ScrollBox, delta: number): boolean {
  if (!box.scrollable || delta === 0) return false;
  const travel = box.scrollHeight - box.clientHeight;
  if (travel <= 0) return false;
  return delta > 0
    ? box.scrollTop < travel - TOLERANCE
    : box.scrollTop > TOLERANCE;
}

/** Index into `chain` (`[0]` under the cursor, then ancestors outward), or `-1` to leave the event alone. */
export function resolveHandoff(chain: ScrollBox[], delta: number): number {
  if (delta === 0 || chain.length === 0) return -1;
  // Still travelling: the browser scrolls it better, momentum included.
  if (hasRoomToScroll(chain[0], delta)) return -1;
  if (chain[0].sealed) return -1;

  for (let i = 1; i < chain.length; i++) {
    if (hasRoomToScroll(chain[i], delta)) return i;
    // After the room check: a sealed box walls off its outside, not itself.
    if (chain[i].sealed) return -1;
  }
  return -1;
}
