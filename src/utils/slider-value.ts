// ---------------------------------------------------------------------------
// Slider value algebra
//
// The two directions a slider constantly converts between — a value on the
// consumer's scale, and a 0–1 position along the track — plus the rounding that
// keeps both honest. Kept pure and out of the component because it is the only
// part of a slider with anything to get wrong: the grid is anchored at `min`
// (not at zero), `max` is not assumed to sit on that grid, and every result is
// rounded to the step's own precision so a 0.1 step cannot leak
// 0.30000000000000004 into the readout or into `onValueChange`.
// ---------------------------------------------------------------------------

export interface SliderScale {
  min: number;
  max: number;
  /** Grid spacing, anchored at `min`. Values ≤ 0 mean "continuous". */
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

/**
 * Snaps `value` onto the step grid anchored at `min`, then holds it inside
 * `[min, max]`. When `max` is off the grid (min 0, max 10, step 3) the top of
 * the range is the last grid value below it — the same trade native
 * `input[type=range]` makes, so the thumb can never render past the track end.
 */
export function snapToStep(value: number, scale: SliderScale): number {
  const { min, max, step } = scale;
  if (!Number.isFinite(value)) return min;
  const bounded = clamp(value, min, max);
  if (!(step > 0)) return bounded;

  const decimals = Math.max(decimalsOf(step), decimalsOf(min));
  // The DIVISION carries float error too, not just the multiplication back:
  // 0.35 / 0.1 is 3.4999999999999996, which would round DOWN to 0.3 and make
  // the grid skip a stop. Settling the quotient first puts it back on 3.5.
  const steps = Math.round(Number(((bounded - min) / step).toFixed(9)));
  let snapped = min + steps * step;
  // Rounding to nearest can overshoot a max that is not on the grid.
  if (snapped > max) snapped = min + Math.floor((max - min) / step) * step;
  return clamp(toPrecision(snapped, decimals), min, max);
}

/** The value at a 0–1 position along the track, snapped to the step grid. */
export function valueAtRatio(ratio: number, scale: SliderScale): number {
  const { min, max } = scale;
  return snapToStep(min + clamp(ratio, 0, 1) * (max - min), scale);
}

/**
 * Where a value sits along the track, as a 0–1 fraction — the thumb's offset
 * and the filled portion both read from this. A degenerate range collapses to
 * 0 rather than dividing by zero.
 */
export function ratioOfValue(
  value: number,
  { min, max }: Pick<SliderScale, "min" | "max">,
): number {
  if (!(max > min)) return 0;
  return (clamp(value, min, max) - min) / (max - min);
}

/**
 * The readout string. Precision comes from the STEP, not from the value, so the
 * number cannot gain and lose decimals (and so change width) as it is dragged.
 */
export function formatSliderValue(value: number, step: number): string {
  const text = (value === 0 ? 0 : value).toFixed(decimalsOf(step));
  // toFixed keeps the sign on values that round to zero (-0.4 → "-0").
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

/** The most marks a ruler draws before it stops trying to show every value. */
export const MAX_SLIDER_TICKS = 11;

/** How many values the scale holds; Infinity when it is continuous. */
function stopCount({ min, max, step }: SliderScale): number {
  if (!(max > min)) return 1;
  if (!(step > 0)) return Infinity;
  // Settle the quotient before flooring, for the reason snapToStep settles it
  // before rounding: (0.5 - 0) / 0.1 is 4.999999999999999, and flooring that
  // raw would drop the last stop off the ruler.
  return Math.floor(Number(((max - min) / step).toFixed(9))) + 1;
}

/**
 * Where the ruler's marks sit, as 0–1 positions along the track.
 *
 * A scale the ruler can show WHOLE gets one mark per reachable value, each
 * sitting on that value: a 1–5 colour count is drawn with five marks, not with
 * eleven promising stops the thumb can never visit, and a max off the grid
 * (min 0, max 10, step 3) ends its ruler at 9, where the thumb ends. Denser
 * scales — and continuous ones — fall back to `MAX_SLIDER_TICKS` marks spread
 * evenly across the range, which is the ruler a 0–100 slider always had.
 *
 * `count` overrides the lot with that many evenly spread marks.
 */
export function tickRatios(scale: SliderScale, count?: number): number[] {
  const stops = count ?? stopCount(scale);
  if (count === undefined && stops <= MAX_SLIDER_TICKS) {
    return Array.from({ length: stops }, (_, i) =>
      ratioOfValue(snapToStep(scale.min + i * scale.step, scale), scale),
    );
  }
  const marks = Math.min(stops, MAX_SLIDER_TICKS);
  if (marks <= 0) return [];
  if (marks === 1) return [0];
  return Array.from({ length: marks }, (_, i) => i / (marks - 1));
}
