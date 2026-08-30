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

/** The most marks a ruler draws before it starts thinning them out. */
export const MAX_SLIDER_TICKS = 11;

/** How many step intervals the scale spans; 0 when nothing separates the ends. */
function stepIntervals({ min, max, step }: SliderScale): number {
  if (!(max > min) || !(step > 0)) return 0;
  // Settle the quotient before flooring, for the reason snapToStep settles it
  // before rounding: (0.5 - 0) / 0.1 is 4.999999999999999, and flooring that
  // raw would drop the last stop off the ruler.
  return Math.floor(Number(((max - min) / step).toFixed(9)));
}

/** `marks` marks end to end — the only ruler a gridless scale can draw. */
function evenlySpaced(marks: number): number[] {
  if (marks <= 0) return [];
  if (marks === 1) return [0];
  return Array.from({ length: marks }, (_, i) => i / (marks - 1));
}

/**
 * Where the ruler's marks sit, as 0–1 positions along the track.
 *
 * Every mark sits on a value the thumb can actually hold, which fixes the gap
 * between the marks rather than their number: it is always a WHOLE number of
 * steps, and the ruler takes the smallest such gap — the densest ruler — that
 * still comes in at `MAX_SLIDER_TICKS` or fewer. Count is the output, not the
 * input. A 1–5 colour count is drawn with five marks (every step); −180…180 by
 * 15° with nine (every third), where eleven spread evenly would have promised
 * −144 and −108, values `snapToStep` can never return.
 *
 * No whole-step gap divides 1–20 by 1, so the stride runs out at 19 — and a
 * closing mark then goes on the LAST STOP to say where the rule ends, leaving
 * one short gap at the end rather than an even ruler that stops mid-track. The
 * closing mark sits on the last stop, never on `max`: a max off the grid (min
 * 0, max 10, step 3) closes at 9, where the thumb ends, not at 10.
 *
 * It cannot break the cap. Reaching `MAX_SLIDER_TICKS - 1` strides needs
 * `intervals >= 10 * stride`, and `stride` is `intervals / 10` rounded up, so
 * that happens only when the two are equal — and then the last stride has
 * already landed on the last stop and nothing is added.
 *
 * Continuous scales have no grid to sit on and fall back to `MAX_SLIDER_TICKS`
 * evenly spread. `count` overrides the lot with that many evenly spread marks.
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
  // Routed through snapToStep so each mark carries the same float settling the
  // value under it does — `min + n * step` alone drifts off the grid.
  return steps.map((n) =>
    ratioOfValue(snapToStep(scale.min + n * scale.step, scale), scale),
  );
}
