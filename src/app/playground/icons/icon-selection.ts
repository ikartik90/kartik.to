/** One tile's box, in the coordinate space the band is drawn in. */
export interface TileBox {
  key: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Pixels the pointer travels before a press becomes a sweep. */
export const MARQUEE_THRESHOLD = 5;

export function isDragging(origin: Point, point: Point): boolean {
  return (
    Math.abs(point.x - origin.x) >= MARQUEE_THRESHOLD ||
    Math.abs(point.y - origin.y) >= MARQUEE_THRESHOLD
  );
}

/** The band between two points, normalised — it may be drawn in any direction. */
export function marqueeRect(origin: Point, point: Point): Rect {
  return {
    left: Math.min(origin.x, point.x),
    top: Math.min(origin.y, point.y),
    width: Math.abs(point.x - origin.x),
    height: Math.abs(point.y - origin.y),
  };
}

/** Every tile the band overlaps (not just contains), in the tiles' order. */
export function keysWithin(tiles: TileBox[], rect: Rect): string[] {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;

  return tiles
    .filter(
      (tile) =>
        tile.left < right &&
        tile.right > rect.left &&
        tile.top < bottom &&
        tile.bottom > rect.top,
    )
    .map((tile) => tile.key);
}

/** Toggles the pressed icon; shift keeps the others, otherwise they are dropped. */
export function selectionAfterClick(
  current: string[],
  key: string,
  additive: boolean,
): string[] {
  const taken = current.includes(key);
  const without = current.filter((held) => held !== key);

  if (additive) return taken ? without : [...current, key];
  return taken ? [] : [key];
}

/** What the sweep touched, added to the held set when shifted, without duplicates. */
export function selectionAfterMarquee(
  base: string[],
  hits: string[],
  additive: boolean,
): string[] {
  if (!additive) return hits;
  return [...base, ...hits.filter((key) => !base.includes(key))];
}
