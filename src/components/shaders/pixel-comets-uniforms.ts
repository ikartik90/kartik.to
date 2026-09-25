import { getShaderColorFromString } from "@paper-design/shaders";

export const PIXEL_COMETS_MAX_COLORS = 8;

/**
 * Max glow reach in cells, and the shader's lane-walk radius (COMET_MAX_GLOW_LANES).
 * The control's range must not exceed it, or the halo clips square.
 */
export const PIXEL_COMETS_MAX_GLOW_REACH = 3;

/** Named for the direction of travel; a leftward comet lives in a row. */
export const PIXEL_COMETS_DIRECTIONS = ["up", "down", "left", "right"] as const;

export type PixelCometsDirection = (typeof PIXEL_COMETS_DIRECTIONS)[number];

/** Axis 0 is columns (travel along Y), 1 rows. Screen signs: +Y is up, +X is right. */
const DIRECTION_AXES: Record<
  PixelCometsDirection,
  { axis: 0 | 1; heading: 1 | -1 }
> = {
  up: { axis: 0, heading: 1 },
  down: { axis: 0, heading: -1 },
  left: { axis: 1, heading: -1 },
  right: { axis: 1, heading: 1 },
};

/** Heading 0 means both ways. Drops unknown names and non-arrays (a string would throw); empty means all four. */
function directionAxes(directions: readonly PixelCometsDirection[]) {
  // Annotated: narrowing a readonly T[] with Array.isArray widens it to any[].
  const given: readonly PixelCometsDirection[] = Array.isArray(directions)
    ? directions
    : [];
  const known = given.filter((direction) =>
    Object.hasOwn(DIRECTION_AXES, direction),
  );
  const chosen = known.length > 0 ? known : PIXEL_COMETS_DIRECTIONS;

  const axes: [number, number] = [0, 0];
  // A Set, so a direction named twice isn't read as both ways.
  const headings: [Set<number>, Set<number>] = [new Set(), new Set()];

  for (const direction of chosen) {
    const { axis, heading } = DIRECTION_AXES[direction];
    axes[axis] = 1;
    headings[axis].add(heading);
  }

  const headingFor = (axis: 0 | 1) =>
    headings[axis].size === 1 ? [...headings[axis]][0] : 0;

  return { axes, heading: [headingFor(0), headingFor(1)] as [number, number] };
}

const MIN_PIXEL_SIZE = 1;

export interface PixelCometsParams {
  /** Each mover hashes to one stop and keeps it; a list, not a ramp. */
  colors: string[];
  /** The ground; alpha 0 makes the layer stackable. */
  colorBack: string;
  /** Minor lines' ink; its alpha is the lattice's strength. */
  colorGrid: string;
  /** Major lines' ink, inert while `majorGrid` is 0. */
  colorGridMajor: string;
  /** One pixel in CSS pixels, excluding `gridWidth`; the size at scale 1. */
  pixelSize: number;
  /** Expected movers alive across the frame; saturates once every lane fires. */
  count: number;
  /** Any combination of the four; `count` is shared over the lanes left running. */
  direction: PixelCometsDirection[];
  /** Birth distance from the centre, in half-frames along the lane (1 is the edge); unsorted. */
  originMin: number;
  originMax: number;
  /** How far a mover runs, in half-frames; its trail outlives it by `tail`. */
  travelSpans: number;
  /** Spread of comet depths (speeds); 0 is one flat plane. Only ever brings comets nearer. */
  parallax: number;
  /** Odds a comet steps one lane sideways rather than run through the other slot's tail. */
  swerve: number;
  /** Trail length behind the head, in cells; 0 is the head alone. */
  tail: number;
  /** 0 steps the fade per cell, 1 is continuous. Moves the fade's value only, never which cells are lit. */
  tailBlend: number;
  /** Fraction each trail cell keeps of the one in front; 0 is no drop. Doesn't change `tail`. */
  falloff: number;
  /** How bright the bloom around the HEAD is. 0 is a flat pixel. */
  headGlow: number;
  /** In cells, capped at `PIXEL_COMETS_MAX_GLOW_REACH`. */
  headRadius: number;
  /** Motion-blur smear of the head's bloom back along the lane, in cells; 0 is round. */
  headStretch: number;
  /** Bloom along the trail, scaled by the trail's own fade. */
  tailGlow: number;
  /** How far the trail's bloom spreads either side of the line, in cells. */
  tailRadius: number;
  /** Line thickness in CSS pixels, added to the pitch rather than taken from the pixel; 0 is no lattice. */
  gridWidth: number;
  /** Every nth line is drawn in `colorGridMajor`; 0 is off. */
  majorGrid: number;
  /** Run speed shape: 0 constant, 1 decelerating into the end, -1 arriving fast. */
  easing: number;
  /** Where the speed sits within the run; the run's ends never move. */
  easingBias: number;
}

export interface PixelCometsUniforms {
  u_colors: [number, number, number, number][];
  u_colorsCount: number;
  u_colorBack: [number, number, number, number];
  u_colorGrid: [number, number, number, number];
  u_colorGridMajor: [number, number, number, number];
  u_pixelSize: number;
  u_count: number;
  u_axes: [number, number];
  u_axisHeading: [number, number];
  u_originMin: number;
  u_originMax: number;
  u_travelSpans: number;
  u_parallax: number;
  u_swerve: number;
  u_tail: number;
  u_tailBlend: number;
  u_falloff: number;
  u_headGlow: number;
  u_headRadius: number;
  u_headStretch: number;
  u_tailGlow: number;
  u_tailRadius: number;
  u_gridWidth: number;
  u_majorGrid: number;
  u_easing: number;
  u_easingBias: number;
}

export const DEFAULT_PIXEL_COMETS: PixelCometsParams = {
  colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#00E5FF"],
  colorBack: "#080B12FF",
  colorGrid: "#A8C0FF29",
  colorGridMajor: "#A8C0FF5C",
  pixelSize: 8,
  count: 30,
  direction: [...PIXEL_COMETS_DIRECTIONS],
  originMin: 0,
  originMax: 2,
  travelSpans: 1.5,
  parallax: 0,
  swerve: 1,
  tail: 14,
  tailBlend: 0,
  falloff: 0.6,
  headGlow: 0.8,
  headRadius: 1.2,
  headStretch: 2,
  tailGlow: 0.4,
  tailRadius: 0.8,
  gridWidth: 2,
  majorGrid: 8,
  easing: 1,
  easingBias: 0,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function toPixelCometsUniforms(params: PixelCometsParams): PixelCometsUniforms {
  const given = params.colors.slice(0, PIXEL_COMETS_MAX_COLORS);
  // An empty list falls back to one colour rather than indexing unset slots.
  const colors = given.length > 0 ? given : [params.colorGrid];

  const converted = colors.map(
    (color) =>
      getShaderColorFromString(color) as [number, number, number, number],
  );

  // Padded to the fixed uniform size; `u_colorsCount` must stay the real count.
  const padded = [...converted];
  while (padded.length < PIXEL_COMETS_MAX_COLORS) {
    padded.push(converted[converted.length - 1]);
  }

  const { axes: u_axes, heading: u_axisHeading } = directionAxes(params.direction);
  const axes = { u_axes, u_axisHeading };

  return {
    u_colors: padded,
    u_colorsCount: converted.length,
    u_colorBack: getShaderColorFromString(params.colorBack) as [
      number,
      number,
      number,
      number,
    ],
    u_colorGrid: getShaderColorFromString(params.colorGrid) as [
      number,
      number,
      number,
      number,
    ],
    u_colorGridMajor: getShaderColorFromString(params.colorGridMajor) as [
      number,
      number,
      number,
      number,
    ],
    u_pixelSize: Math.max(params.pixelSize, MIN_PIXEL_SIZE),
    u_count: Math.max(params.count, 0),
    ...axes,
    u_originMin: Math.max(params.originMin, 0),
    u_originMax: Math.max(params.originMax, 0),
    // The one-cell floor lives in the shader, where the frame size is known.
    u_travelSpans: Math.max(params.travelSpans, 0),
    u_parallax: Math.max(params.parallax, 0),
    u_swerve: clamp(params.swerve, 0, 1),
    u_tail: Math.max(params.tail, 0),
    // Mix factors: `mix` extrapolates past 0..1.
    u_tailBlend: clamp(params.tailBlend, 0, 1),
    u_falloff: clamp(params.falloff, 0, 1),
    u_headGlow: Math.max(params.headGlow, 0),
    u_headRadius: clamp(params.headRadius, 0, PIXEL_COMETS_MAX_GLOW_REACH),
    // No cap against the glow reach: only the across-lane radius can outrun the lane walk.
    u_headStretch: Math.max(params.headStretch, 0),
    u_tailGlow: Math.max(params.tailGlow, 0),
    u_tailRadius: clamp(params.tailRadius, 0, PIXEL_COMETS_MAX_GLOW_REACH),
    u_gridWidth: Math.max(params.gridWidth, 0),
    u_majorGrid: Math.max(Math.round(params.majorGrid), 0),
    u_easing: clamp(params.easing, -1, 1),
    u_easingBias: clamp(params.easingBias, -1, 1),
  };
}
