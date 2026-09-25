export interface PointerSample {
  x: number;
  y: number;
  /** In ms; only differences matter. */
  t: number;
}

/** Viewport space, as `getBoundingClientRect` gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** In px/ms; slower is a hand at rest, not an approach. */
const RESTING_SPEED = 0.02;

function isInside(point: PointerSample, box: Box): boolean {
  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.bottom
  );
}

/** Liang–Barsky: does the segment from (x, y) along (dx, dy) meet `box`? */
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

/** Whether the pointer, extrapolated in a straight line, is inside `box` within `horizonMs`. */
export function headingInto(
  from: PointerSample,
  to: PointerSample,
  box: Box,
  horizonMs: number,
): boolean {
  if (box.right < box.left || box.bottom < box.top) return false;
  if (isInside(to, box)) return true;

  if (box.right === box.left && box.bottom === box.top) return false;
  const dt = to.t - from.t;
  if (dt <= 0) return false;

  const vx = (to.x - from.x) / dt;
  const vy = (to.y - from.y) / dt;
  if (Math.hypot(vx, vy) < RESTING_SPEED) return false;

  return segmentMeetsBox(to.x, to.y, vx * horizonMs, vy * horizonMs, box);
}
