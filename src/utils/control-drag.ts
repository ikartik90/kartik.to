// ---------------------------------------------------------------------------
// Text selection, suspended for the length of a control drag.
//
// The static half of this lives in globals.css — a slider's whole row refuses
// selection, so a finger has nothing to anchor on. This is the other half: once
// a drag is RUNNING it may travel anywhere on the page, and the rule that
// covers where it started cannot cover where it goes. The attribute this sets
// is what globals.css hangs that on.
//
// Counted rather than flagged, because a phone has more than one finger: two
// sliders dragged at once are two presses and one page, and the first to lift
// must not hand selection back under the one still going.
// ---------------------------------------------------------------------------

/** Set on `<html>` while at least one control drag is in flight. */
export const CONTROL_DRAG_ATTR = "data-control-dragging";

/** The pointers currently dragging a control. A Set, so a repeated
 *  `pointerdown` for one finger still needs exactly one release. */
const dragging = new Set<number>();

/** Take the page's selection for `pointerId`. Idempotent. */
export function beginControlDrag(pointerId: number): void {
  dragging.add(pointerId);
  document.documentElement.setAttribute(CONTROL_DRAG_ATTR, "");
}

/** Hand it back for `pointerId` — the last one out clears the mark. Safe to
 *  call for a pointer that never took it, which is what lets every release
 *  route (pointerup, pointercancel, lost capture, unmount) call it blindly. */
export function endControlDrag(pointerId: number): void {
  dragging.delete(pointerId);
  if (dragging.size === 0)
    document.documentElement.removeAttribute(CONTROL_DRAG_ATTR);
}
