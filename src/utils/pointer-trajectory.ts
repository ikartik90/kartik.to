// ---------------------------------------------------------------------------
// Where the pointer is GOING, not where it is.
//
// Some work is worth starting before the cursor arrives — a shader that takes
// a moment to compile should be compiling while the hand is still moving, not
// when it lands. Waiting for the hover is too late, and starting on any
// movement anywhere is what makes a page choppy for someone who never goes
// near the thing.
//
// So: two samples give a velocity, the velocity gives the next `horizonMs` of
// travel as a line segment, and the question is whether that segment reaches
// the box. Deliberately NOT a cone or a heat map — a straight extrapolation is
// what a hand crossing a page actually looks like over ~100ms, and it answers
// with a yes or a no rather than a score somebody has to pick a cut-off for.
// ---------------------------------------------------------------------------

export interface PointerSample {
  x: number;
  y: number;
  /** Timestamp in ms; only differences matter, so any clock will do. */
  t: number;
}

/** Viewport-space edges, as `getBoundingClientRect` gives them. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Movement below this is a hand at rest, not an approach — a pointer someone
 * has let go of drifts a pixel at a time, and aiming at something 200px away
 * at 0.005px/ms is not aiming at it. Speed is compared in px per millisecond.
 */
const RESTING_SPEED = 0.02;

function isInside(point: PointerSample, box: Box): boolean {
  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.bottom
  );
}

/**
 * Liang–Barsky: does the segment from (x, y) along (dx, dy) meet `box` before
 * it runs out? Each edge pair clips the travelled fraction to a surviving
 * window; an empty window means the segment passes the box by.
 */
function segmentMeetsBox(
  x: number,
  y: number,
  dx: number,
  dy: number,
  box: Box,
): boolean {
  let enter = 0;
  let exit = 1;

  const clip = (direction: number, distance: number): boolean => {
    if (direction === 0) return distance >= 0; // parallel: inside the slab or not
    const crossing = distance / direction;
    if (direction < 0) {
      if (crossing > exit) return false;
      if (crossing > enter) enter = crossing;
    } else {
      if (crossing < enter) return false;
      if (crossing < exit) exit = crossing;
    }
    return true;
  };

  return (
    clip(-dx, x - box.left) &&
    clip(dx, box.right - x) &&
    clip(-dy, y - box.top) &&
    clip(dy, box.bottom - y) &&
    enter <= exit
  );
}

/**
 * Will a pointer moving from `from` to `to` be inside `box` within the next
 * `horizonMs`, if it keeps going as it is?
 *
 * True the moment it is already inside — an approach that has arrived is still
 * an approach, and the caller wants the same answer either way.
 */
export function headingInto(
  from: PointerSample,
  to: PointerSample,
  box: Box,
  horizonMs: number,
): boolean {
  if (box.right < box.left || box.bottom < box.top) return false;
  if (isInside(to, box)) return true;

  // A box with no area cannot be entered, and a pair of samples from the same
  // instant carries no velocity to extrapolate.
  if (box.right === box.left && box.bottom === box.top) return false;
  const dt = to.t - from.t;
  if (dt <= 0) return false;

  const vx = (to.x - from.x) / dt;
  const vy = (to.y - from.y) / dt;
  if (Math.hypot(vx, vy) < RESTING_SPEED) return false;

  return segmentMeetsBox(to.x, to.y, vx * horizonMs, vy * horizonMs, box);
}
