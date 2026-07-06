export const CURSOR_SIZE = 20;
export const CURSOR_HOTSPOT = { x: 1, y: 3 } as const;
export const CURSOR_TOOLTIP_OFFSET = { x: 15, y: 17 } as const;

/** Places a fixed tooltip at the bottom-right of the custom selection cursor. */
export function getCursorTooltipPosition(clientX: number, clientY: number) {
  return {
    left: `${clientX + CURSOR_TOOLTIP_OFFSET.x}px`,
    top: `${clientY + CURSOR_TOOLTIP_OFFSET.y}px`,
  };
}
