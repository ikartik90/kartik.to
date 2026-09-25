// Counted per pointer: with two fingers down, the first release must not restore selection.

/** Set on `<html>` during a drag; globals.css disables selection under it. */
export const CONTROL_DRAG_ATTR = "data-control-dragging";

const dragging = new Set<number>();

export function beginControlDrag(pointerId: number): void {
  dragging.add(pointerId);
  document.documentElement.setAttribute(CONTROL_DRAG_ATTR, "");
}

/** Safe for a pointer that never began, so every release route can call it. */
export function endControlDrag(pointerId: number): void {
  dragging.delete(pointerId);
  if (dragging.size === 0)
    document.documentElement.removeAttribute(CONTROL_DRAG_ATTR);
}
