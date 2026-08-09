// ---------------------------------------------------------------------------
// The mark a self-playing demo puts on the pointer events it fires itself, and
// the question every "is the visitor's hand here?" listener has to ask before
// believing one.
//
// A walkthrough that performs a DRAG has no choice but to dispatch the real
// thing: a marquee lives in pointer geometry rather than in a handler you can
// call, so the tour streams `pointerdown`/`pointermove`/`pointerup` at its own
// stand-in cursor. Those events then reach every global listener in the app —
// the cursor-following tooltips, the input-modality tracker, the focus-ring
// switch — each of which reads a pointer move as the visitor moving. A tooltip
// pinned to a button the visitor is still hovering gets dragged across the
// screen by a cursor that isn't theirs.
//
// A property rather than `isTrusted`, which would be the honest discriminator
// in a browser and useless everywhere else: every synthesised event is
// untrusted, including the ones a test fires to stand in for the visitor.
// ---------------------------------------------------------------------------

const SYNTHETIC = "__demoCursorTour";

/** Stamps an event as the demo's own. Returns it, so a dispatch stays one line. */
export function markSyntheticPointer<T extends Event>(event: T): T {
  Object.defineProperty(event, SYNTHETIC, { value: true });
  return event;
}

/** Was this event fired by a demo's stand-in cursor rather than by a person? */
export function isSyntheticPointer(event: Event): boolean {
  return SYNTHETIC in event;
}
