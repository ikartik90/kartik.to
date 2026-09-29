export interface TypeEnd {
  /** px */
  size: number;
  /** px */
  lineHeight: number;
}

export interface FluidTypeSize {
  mobile: TypeEnd;
  desktop: TypeEnd;
}

/** The widths, in px, where each end applies in full; values hold beyond them. */
export interface TypeViewports {
  mobile: number;
  desktop: number;
}

const ROOT_PX = 16;

const round = (value: number) => Number(value.toFixed(4)).toString();
const rem = (px: number) => `${round(px / ROOT_PX)}rem`;

export interface FluidOptions {
  /** The viewport unit; `cqi` measures a container instead. */
  unit?: string;
  /** Rounds values between the ends to multiples of `px`, written as `css`. */
  grid?: { px: number; css: string };
}

/** A straight line from `from` px at the mobile width to `to` px at the desktop width, held beyond both. */
export function fluid(
  from: number,
  to: number,
  viewports: TypeViewports,
  { unit = "vw", grid }: FluidOptions = {},
) {
  const span = viewports.desktop - viewports.mobile;
  if (span === 0 || Math.abs(to - from) < 0.005) return rem(to);
  // Aimed half a step past each end, so at the end widths rounding can't fall short of an end
  // that sits off the grid, or on a midpoint by float noise.
  const reach = grid ? (Math.sign(to - from) * grid.px) / 2 : 0;
  const slope = (to - from + 2 * reach) / span;
  const intercept = from - reach - slope * viewports.mobile;
  const perViewport = `${round(Math.abs(slope) * 100)}${unit}`;
  const preferred =
    slope < 0
      ? `${rem(intercept)} - ${perViewport}`
      : intercept < 0
        ? `${perViewport} - ${rem(-intercept)}`
        : `${rem(intercept)} + ${perViewport}`;
  const between = grid ? `round(${preferred}, ${grid.css})` : preferred;
  return `clamp(${rem(Math.min(from, to))}, ${between}, ${rem(Math.max(from, to))})`;
}

export function fluidFontSize(
  size: FluidTypeSize,
  viewports: TypeViewports,
  unit?: string,
) {
  return fluid(size.mobile.size, size.desktop.size, viewports, { unit });
}

export function fluidLineHeight(
  size: FluidTypeSize,
  viewports: TypeViewports,
  grid?: FluidOptions["grid"],
  unit?: string,
) {
  return fluid(size.mobile.lineHeight, size.desktop.lineHeight, viewports, {
    unit,
    grid,
  });
}
