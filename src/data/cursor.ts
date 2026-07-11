// The custom cursor is drawn by the OS via `cursor: image-set(...)` in
// globals.css (asset + hotspot live there). These offsets place a tooltip
// relative to that cursor's visual position.
export const CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } as const;

/** Places a fixed tooltip at the bottom-right of the custom selection cursor. */
export function getCursorTooltipPosition(clientX: number, clientY: number) {
  return {
    left: `${clientX + CURSOR_TOOLTIP_OFFSET.x}px`,
    top: `${clientY + CURSOR_TOOLTIP_OFFSET.y}px`,
  };
}
