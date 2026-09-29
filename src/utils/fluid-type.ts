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

/** A straight line from `from` px at the mobile width to `to` px at the desktop width, held beyond both. */
export function fluid(
  from: number,
  to: number,
  viewports: TypeViewports,
  unit = "vw",
) {
  const span = viewports.desktop - viewports.mobile;
  if (span === 0 || Math.abs(to - from) < 0.005) return rem(to);
  const slope = (to - from) / span;
  const intercept = from - slope * viewports.mobile;
  const perViewport = `${round(Math.abs(slope) * 100)}${unit}`;
  const preferred =
    slope < 0
      ? `${rem(intercept)} - ${perViewport}`
      : intercept < 0
        ? `${perViewport} - ${rem(-intercept)}`
        : `${rem(intercept)} + ${perViewport}`;
  return `clamp(${rem(Math.min(from, to))}, ${preferred}, ${rem(Math.max(from, to))})`;
}

export function fluidFontSize(
  size: FluidTypeSize,
  viewports: TypeViewports,
  unit?: string,
) {
  return fluid(size.mobile.size, size.desktop.size, viewports, unit);
}

/** With a `grid`, in-between values round to its nearest multiple; nearest, since float noise at an end would push "up" a whole step. */
export function fluidLineHeight(
  size: FluidTypeSize,
  viewports: TypeViewports,
  grid?: string,
  unit?: string,
) {
  const value = fluid(
    size.mobile.lineHeight,
    size.desktop.lineHeight,
    viewports,
    unit,
  );
  return grid && value.startsWith("clamp(") ? `round(${value}, ${grid})` : value;
}
