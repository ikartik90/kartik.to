// A logo's crop: a square showing its picture zoomed from just covering it, and dragged about while it still does.
// Offsets are in the crop's sides, from the picture centred.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export type Size = { width: number; height: number };
export type Offset = { x: number; y: number };

/** The picture's size, in the crop's sides, at `zoom`. */
export function spanOf({ width, height }: Size, zoom: number): Size {
  const short = Math.min(width, height);
  return { width: (width / short) * zoom, height: (height / short) * zoom };
}

const within = (value: number, reach: number) => Math.min(Math.max(value, -reach), reach) || 0;

/** `offset`, kept where the picture still covers the crop. */
export function clampOffset(size: Size, zoom: number, { x, y }: Offset): Offset {
  const span = spanOf(size, zoom);
  return { x: within(x, (span.width - 1) / 2), y: within(y, (span.height - 1) / 2) };
}

/** The square of the picture that shows in the crop, in the picture's own pixels. */
export function sourceOf(size: Size, zoom: number, { x, y }: Offset) {
  const side = Math.min(size.width, size.height) / zoom;
  return { x: size.width / 2 - (x + 0.5) * side, y: size.height / 2 - (y + 0.5) * side, side };
}
