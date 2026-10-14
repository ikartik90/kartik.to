/** Scroll positions within a pixel are one, since a smooth scroll can land on a fraction. */
const TOLERANCE_PX = 1;

/**
 * Where each slide comes to rest, one offset per slide: its start `inset` from the scroller's
 * start, as far as the scroll reaches. Mirrors the CSS snap alignment.
 */
export function carouselRestOffsets(
  slideStarts: readonly number[],
  inset: number,
  maxScroll: number,
): number[] {
  return slideStarts.map((start) =>
    Math.min(Math.max(start - inset, 0), maxScroll),
  );
}

export type CarouselSnapAlign = "start" | "center" | "end";

/**
 * Where a slide aligned `align` in a snapport `snapport` wide would start were it aligned to its
 * start, so `carouselRestOffsets` rests it as the CSS snaps it.
 */
export function carouselAlignedStart(
  start: number,
  width: number,
  align: CarouselSnapAlign,
  snapport: number,
): number {
  const room = snapport - width;
  return start - (align === "center" ? room / 2 : align === "end" ? room : 0);
}

/** The inline axis's alignment in a computed `scroll-snap-align`, whose second keyword, if any, is it. */
export function inlineSnapAlign(value: string): CarouselSnapAlign {
  const inline = value.trim().split(/\s+/).pop();
  return inline === "center" || inline === "end" ? inline : "start";
}

// How far a released drag coasts, in ms of its release speed; and the speed, in px/ms, that makes it a flick.
const COAST_MS = 400;
const FLICK_SPEED = 0.3;

/**
 * Where a drag let go at `current`, the scroll moving `velocity` px/ms, comes to rest: the stop nearest where it
 * would coast to, and for a flick at least the next stop its way.
 */
export function carouselLanding(
  offsets: readonly number[],
  current: number,
  velocity: number,
): number {
  const coast = current + velocity * COAST_MS;
  const nearest = offsets.reduce<number | null>(
    (best, offset) =>
      best === null || Math.abs(offset - coast) < Math.abs(best - coast) ? offset : best,
    null,
  );
  if (nearest === null) return current;
  if (Math.abs(velocity) < FLICK_SPEED) return nearest;
  const direction = velocity > 0 ? 1 : -1;
  const next = carouselStep(offsets, current, direction);
  if (next === null) return nearest;
  return direction === 1 ? Math.max(nearest, next) : Math.min(nearest, next);
}

/** The rest offset one step from `current` in `step`'s direction, or null past either end. */
export function carouselStep(
  offsets: readonly number[],
  current: number,
  step: 1 | -1,
): number | null {
  const ahead =
    step === 1
      ? offsets.filter((offset) => offset > current + TOLERANCE_PX)
      : offsets.filter((offset) => offset < current - TOLERANCE_PX).reverse();
  return ahead[0] ?? null;
}
