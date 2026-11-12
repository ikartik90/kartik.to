import { getShaderColorFromString } from "@paper-design/shaders";

export const PRISM_FOLD_MAX_COLORS = 8;
/** The shader's fold loop runs to this; the count is clamped to it. */
export const PRISM_FOLD_MAX_FOLDS = 4;

/** Floor for the widths the shader divides by. */
const MIN_WIDTH = 0.001;

export interface PrismFoldParams {
  /** One ramp: the ground reads its start, each sheet a step further along. */
  colors: string[];
  /** The seams' bright core, and the sheen's lift. */
  colorSeam: string;
  folds: number;
  /** Degrees between one fold and the next, all fanning from one pivot. */
  fan: number;
  /** Bend of the outermost fold; the folds inside it bend less. */
  curve: number;
  /** How far along the ramp each sheet steps. */
  lift: number;
  /** Blur of the sheets' edges. */
  softness: number;
  /** How much of the ramp the ground spans across the frame. */
  spread: number;
  /** Slow noise bending the ground's ramp. */
  warp: number;
  /** Iridescent rim on the near side of each fold. */
  sheen: number;
  sheenWidth: number;
  seam: number;
  /** CSS px. */
  seamWidth: number;
  /** Each fold's seam is this much fainter than the one before it. */
  seamFalloff: number;
  /** How far the seam's fringes reach along the ramp. */
  dispersion: number;
  /** Fine noise that keeps the soft ramp from banding. */
  grain: number;
}

export const DEFAULT_PRISM_FOLD: PrismFoldParams = {
  colors: ["#E6DBD9", "#B3C9C5", "#74B3D5", "#D0ABF0", "#A47AF0", "#6F95EA"],
  colorSeam: "#FFFFFFFF",
  folds: 2,
  fan: 6,
  curve: 0.5,
  lift: 0.3,
  softness: 0.1,
  spread: 0.6,
  warp: 0.4,
  sheen: 0.5,
  sheenWidth: 0.5,
  seam: 0.8,
  seamWidth: 3,
  seamFalloff: 0.9,
  dispersion: 0.6,
  grain: 0.5,
};

type Vec4 = [number, number, number, number];

export interface PrismFoldUniforms {
  u_colors: Vec4[];
  u_colorsCount: number;
  u_colorSeam: Vec4;
  u_folds: number;
  u_fan: number;
  u_curve: number;
  u_lift: number;
  u_softness: number;
  u_spread: number;
  u_warp: number;
  u_sheen: number;
  u_sheenWidth: number;
  u_seam: number;
  u_seamWidth: number;
  u_seamFalloff: number;
  u_dispersion: number;
  u_grain: number;
}

const unit = (value: number) => Math.min(Math.max(value, 0), 1);
const toVec4 = (color: string) => getShaderColorFromString(color) as Vec4;

export function toPrismFoldUniforms(params: PrismFoldParams): PrismFoldUniforms {
  const given = params.colors.slice(0, PRISM_FOLD_MAX_COLORS);
  const colors = (given.length > 0 ? given : [params.colorSeam]).map(toVec4);
  const padded = [...colors];
  while (padded.length < PRISM_FOLD_MAX_COLORS) padded.push(colors[colors.length - 1]);

  return {
    u_colors: padded,
    u_colorsCount: colors.length,
    u_colorSeam: toVec4(params.colorSeam),
    u_folds: Math.min(Math.max(Math.round(params.folds), 1), PRISM_FOLD_MAX_FOLDS),
    u_fan: (params.fan * Math.PI) / 180,
    u_curve: params.curve,
    u_lift: params.lift,
    u_softness: Math.max(params.softness, MIN_WIDTH),
    u_spread: Math.max(params.spread, 0),
    u_warp: unit(params.warp),
    u_sheen: unit(params.sheen),
    u_sheenWidth: Math.max(params.sheenWidth, MIN_WIDTH),
    u_seam: unit(params.seam),
    u_seamWidth: Math.max(params.seamWidth, MIN_WIDTH),
    u_seamFalloff: unit(params.seamFalloff),
    u_dispersion: params.dispersion,
    u_grain: unit(params.grain),
  };
}
