export interface Point {
  x: number;
  y: number;
}

/** A zoomed picture: its scale, and its pan from the frame's centre. */
export interface Zoom extends Point {
  scale: number;
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Share of the frame's width a slow swipe must travel. */
const SWIPE_FRACTION = 0.25;

/** In px/ms. */
const FLICK_SPEED = 0.5;

/** Below this travel (px), a fast release is a wobbling press, not a flick. */
const FLICK_TRAVEL = 8;

/** Share of the way between fitted and slide a pinch must travel to cross over. */
const CROSS_OVER = 0.2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Where a released swipe goes: the next item (1), the previous (-1), or back (0). */
export function swipeRelease({
  offset,
  width,
  speed,
}: {
  offset: number;
  width: number;
  speed: number;
}): -1 | 0 | 1 {
  const far = Math.abs(offset) >= width * SWIPE_FRACTION;
  const flick =
    Math.abs(speed) >= FLICK_SPEED &&
    Math.abs(offset) >= FLICK_TRAVEL &&
    Math.sign(speed) === Math.sign(offset);
  if (!far && !flick) return 0;
  return offset < 0 ? 1 : -1;
}

/** The furthest a picture zooms: to its own pixels, and at least twice its fitted width. */
export function maxZoom(
  naturalWidth: number | undefined,
  fittedWidth: number,
): number {
  if (!naturalWidth || fittedWidth <= 0) return 2;
  return Math.max(2, naturalWidth / fittedWidth);
}

/** Rescales about `focus`, from the frame's centre, so the point under the fingers stays put. */
export function zoomAbout(zoom: Zoom, scale: number, focus: Point): Zoom {
  const ratio = scale / zoom.scale;
  return {
    scale,
    x: focus.x - (focus.x - zoom.x) * ratio,
    y: focus.y - (focus.y - zoom.y) * ratio,
  };
}

/** Keeps a zoomed picture covering its frame. */
export function clampPan(
  zoom: Zoom,
  size: { width: number; height: number },
): Zoom {
  const reachX = (Math.max(zoom.scale - 1, 0) * size.width) / 2;
  const reachY = (Math.max(zoom.scale - 1, 0) * size.height) / 2;
  return {
    scale: zoom.scale,
    x: clamp(zoom.x, -reachX, reachX) || 0,
    y: clamp(zoom.y, -reachY, reachY) || 0,
  };
}

/** A trackpad pinch arrives as ctrl-wheel deltas, each a relative change of scale. */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY / 100);
}

/** How far a pinch below the fitted size has taken the frame towards its slide, 0 to 1. */
export function closeProgress(scale: number, sourceScale: number): number {
  if (sourceScale >= 1) return scale < 1 ? 1 : 0;
  return clamp((1 - scale) / (1 - sourceScale), 0, 1);
}

/** Where a released pinch settles; `opening` when it began on the slide. */
export function pinchRelease({
  scale,
  sourceScale,
  opening,
}: {
  scale: number;
  sourceScale: number;
  opening: boolean;
}): "close" | "fit" | "zoom" {
  if (scale > 1.01) return "zoom";
  const progress = closeProgress(scale, sourceScale);
  const closes = opening
    ? progress > 1 - CROSS_OVER
    : progress >= CROSS_OVER;
  return closes ? "close" : "fit";
}

export function lerpRect(from: Box, to: Box, t: number): Box {
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    left: mix(from.left, to.left),
    top: mix(from.top, to.top),
    width: mix(from.width, to.width),
    height: mix(from.height, to.height),
  };
}
