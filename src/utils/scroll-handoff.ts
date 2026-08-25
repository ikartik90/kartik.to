// ---------------------------------------------------------------------------
// Scroll handoff — who takes the wheel when the box under the cursor cannot.
//
// A nested scroller that reaches its end should let the container behind it
// carry on. Browsers say they do this (`overscroll-behavior: auto` is "chain"),
// but only BETWEEN gestures: Chrome, Safari and Firefox all LATCH a continuous
// wheel/trackpad gesture to whichever box first consumed it, so the rest of a
// flick that runs out of option list is dropped on the floor rather than passed
// outward. To the reader that is a dead spot — the list is a hole in the page
// you cannot scroll past without lifting your fingers and starting again.
//
// The repair is to hand the wheel on ourselves, which needs one decision:
// WHICH box takes it. That decision is this module, kept away from the DOM so
// it can be tested as what it is — arithmetic over a chain of boxes — while
// `useScrollHandoff` does the reading and the scrolling.
//
// `sealed` is how a surface says the scroll stops here. It is read off
// `overscroll-behavior`, so the page states it in CSS, in the platform's own
// vocabulary, once: a popover or a dialog is `contain` and the wheel never
// escapes it, an embedded section says nothing and the wheel travels out to the
// page. Nothing here knows what a popover is.
// ---------------------------------------------------------------------------

/** One box in the chain, as much of it as the decision needs. */
export interface ScrollBox {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /**
   * Whether the box actually scrolls. Content taller than the box is not the
   * same question: an `overflow: hidden` wrapper — a popover shell, a dialog
   * panel — overflows all the time and moves for nobody, and handing it a
   * wheel would swallow the gesture rather than pass it on. Such a box is in
   * the chain only for what `sealed` says about it.
   */
  scrollable: boolean;
  /**
   * Whether scroll must not chain out of this box — `overscroll-behavior` of
   * `contain` or `none`. A sealed box may still be scrolled itself; what it
   * refuses is passing anything to its own container.
   */
  sealed: boolean;
}

/**
 * A pixel of slack. Fractional layout leaves `scrollTop` a hair short of its
 * maximum, and a box that can only move half a pixel has, to the person
 * pushing it, arrived.
 */
const TOLERANCE = 1;

/** Whether `box` can still travel in `delta`'s direction. */
export function hasRoomToScroll(box: ScrollBox, delta: number): boolean {
  if (!box.scrollable || delta === 0) return false;
  const travel = box.scrollHeight - box.clientHeight;
  if (travel <= 0) return false;
  return delta > 0
    ? box.scrollTop < travel - TOLERANCE
    : box.scrollTop > TOLERANCE;
}

/**
 * Which box should take a wheel the innermost one cannot use.
 *
 * `chain[0]` is the scroller under the cursor and the rest are its scrollable
 * ancestors, outward. Returns an index into the chain, or `-1` for "leave the
 * event alone" — which covers both halves of doing nothing: the list can still
 * scroll itself (the browser is already doing the right thing, and taking over
 * would cost the gesture its momentum), or nothing outside it is allowed to
 * move (a sealed surface, or a page already at its end).
 */
export function resolveHandoff(chain: ScrollBox[], delta: number): number {
  if (delta === 0 || chain.length === 0) return -1;
  // Still travelling: not a handoff at all, and the browser scrolls it better
  // than a `scrollTop` assignment can.
  if (hasRoomToScroll(chain[0], delta)) return -1;
  if (chain[0].sealed) return -1;

  for (let i = 1; i < chain.length; i++) {
    if (hasRoomToScroll(chain[i], delta)) return i;
    // Checked AFTER the room: a sealed box is a wall around what is outside it,
    // not around itself — a popover's own list still scrolls.
    if (chain[i].sealed) return -1;
  }
  return -1;
}
