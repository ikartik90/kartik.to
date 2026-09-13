// ---------------------------------------------------------------------------
// What a press and a sweep do to the selection.
//
// A plain press takes ONE icon and lets go of the rest. It used to add to a
// running set, which is the wrong default for a sheet of two hundred marks:
// the common thing is looking at one icon, and a set that only ever grows
// means emptying it by hand before every comparison.
//
// The two ways to take more than one are the two everybody already knows:
//
//   shift     the press is additive, and additive both ways — a shifted press
//             on an icon already taken puts it back. Correcting a selection
//             matters as much as building one.
//
//   drag      a band, and everything it TOUCHES comes with it. Sweeping across
//             a row clips the tops of the tiles rather than enclosing them, so
//             a containment test would select nothing at all and the gesture
//             would feel broken; and because it is a band rather than a path,
//             dragging down as well as across takes a block.
//
// All of it is pure: rectangles in, keys out. The grid measures its tiles once
// when a drag begins and asks these questions on every move, so nothing here
// touches the DOM or knows what a tile looks like.
// ---------------------------------------------------------------------------

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

/**
 * How far the pointer travels before a press becomes a sweep.
 *
 * A press is never perfectly still — a mouse moves a pixel or two between
 * down and up, and a trackpad more — so without a threshold every click would
 * draw a one-pixel band and be read as a drag. Five is enough to absorb that
 * and short enough that a deliberate sweep starts immediately.
 */
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

/**
 * Every tile the band overlaps, in the order the tiles were given — which is
 * the grid's order, not the order the pointer happened to travel. A download
 * is named and zipped from the selection, so it has to be a set rather than a
 * record of the gesture.
 */
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

/**
 * A press: this one alone, or this one as well.
 *
 * Two independent questions, which is what makes the gesture learnable. The
 * icon PRESSED toggles — taken becomes let go of, either way — and shift
 * decides what happens to every OTHER icon: held with it, or dropped.
 *
 * So a press on an icon already taken empties the selection rather than
 * confirming it. That is deliberate and it is the only way to empty one: the
 * panel carries no Clear button, because a control that spends most of its
 * life disabled is a row of nothing, and pressing a mark to unmark it is what
 * a hand tries first.
 */
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

/**
 * A sweep: what it touched, or what it touched on top of what was already
 * held. Never the same icon twice — a shifted drag back across its own start
 * would otherwise count those tiles again.
 */
export function selectionAfterMarquee(
  base: string[],
  hits: string[],
  additive: boolean,
): string[] {
  if (!additive) return hits;
  return [...base, ...hits.filter((key) => !base.includes(key))];
}
