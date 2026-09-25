// Values snap to a grid anchored at `min` and round to the step's own precision,
// so a 0.1 step never leaks 0.30000000000000004.

export interface SliderScale {
  min: number;
  max: number;
  /** Anchored at `min`; ≤ 0 means continuous. */
  step: number;
}

/** Decimal places in a number's own notation — 0.25 → 2, 10 → 0, 1e-3 → 3. */
function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(Math.abs(value));
  const exponent = text.indexOf("e-");
  if (exponent !== -1) return Number(text.slice(exponent + 2));
  const point = text.indexOf(".");
  return point === -1 ? 0 : text.length - point - 1;
}

/** Strip the float noise `min + n * step` accumulates, e.g. 0.1 * 3. */
function toPrecision(value: number, decimals: number): number {
  return Number(value.toFixed(Math.min(decimals, 20)));
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Snaps to the grid, then clamps; an off-grid `max` tops out at the last grid value, like a native range input. */
export function snapToStep(value: number, scale: SliderScale): number {
  const { min, max, step } = scale;
  if (!Number.isFinite(value)) return min;
  const bounded = clamp(value, min, max);
  if (!(step > 0)) return bounded;

  const decimals = Math.max(decimalsOf(step), decimalsOf(min));
  // Settle the quotient first: 0.35 / 0.1 is 3.4999999999999996, which would skip a stop.
  const steps = Math.round(Number(((bounded - min) / step).toFixed(9)));
  let snapped = min + steps * step;
  // Rounding to nearest can overshoot a max that is not on the grid.
  if (snapped > max) snapped = min + Math.floor((max - min) / step) * step;
  return clamp(toPrecision(snapped, decimals), min, max);
}

export function valueAtRatio(ratio: number, scale: SliderScale): number {
  const { min, max } = scale;
  return snapToStep(min + clamp(ratio, 0, 1) * (max - min), scale);
}

export function ratioOfValue(
  value: number,
  { min, max }: Pick<SliderScale, "min" | "max">,
): number {
  if (!(max > min)) return 0;
  return (clamp(value, min, max) - min) / (max - min);
}

/** Precision comes from the step, so the readout keeps its width while dragging. */
export function formatSliderValue(value: number, step: number): string {
  const text = (value === 0 ? 0 : value).toFixed(decimalsOf(step));
  // toFixed keeps the sign on values that round to zero (-0.4 → "-0").
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

export const MAX_SLIDER_TICKS = 11;

function stepIntervals({ min, max, step }: SliderScale): number {
  if (!(max > min) || !(step > 0)) return 0;
  // Settled before flooring, as in `snapToStep`: (0.5 - 0) / 0.1 is 4.999999999999999.
  return Math.floor(Number(((max - min) / step).toFixed(9)));
}

function evenlySpaced(marks: number): number[] {
  if (marks <= 0) return [];
  if (marks === 1) return [0];
  return Array.from({ length: marks }, (_, i) => i / (marks - 1));
}

/**
 * Marks sit on reachable values a whole number of steps apart, at most `MAX_SLIDER_TICKS`;
 * an uneven end closes on the last stop. `count` forces that many evenly spread marks.
 */
export function tickRatios(scale: SliderScale, count?: number): number[] {
  if (count !== undefined) return evenlySpaced(Math.min(count, MAX_SLIDER_TICKS));
  if (!(scale.max > scale.min)) return [0];
  if (!(scale.step > 0)) return evenlySpaced(MAX_SLIDER_TICKS);

  const intervals = stepIntervals(scale);
  const stride = Math.max(1, Math.ceil(intervals / (MAX_SLIDER_TICKS - 1)));
  const spanned = Math.floor(intervals / stride) * stride;
  const steps = Array.from({ length: spanned / stride + 1 }, (_, i) => i * stride);
  if (spanned !== intervals) steps.push(intervals);
  // Through `snapToStep`, so each mark settles float drift exactly as the value does.
  return steps.map((n) =>
    ratioOfValue(snapToStep(scale.min + n * scale.step, scale), scale),
  );
}
