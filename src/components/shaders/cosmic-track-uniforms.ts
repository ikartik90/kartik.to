import { getShaderColorFromString } from "@paper-design/shaders";

export const COSMIC_TRACK_MAX_COLORS = 10;

/** Floor for the span, which divides the along-track coordinate; zero floods the frame with NaN. */
const MIN_RAMP_LENGTH = 0.001;

export interface CosmicTrackParams {
  /** Read across the fan. */
  colors: string[];
  /** The ground; alpha 0 makes the layer stackable. */
  colorBack: string;
  /** The rails' colour; its alpha is the highlight's strength. */
  colorEdge: string;
  /** The bands' position along the track, dialled in degrees (±90 is full reach); signed about the apex. */
  phaseDegrees: number;
  /** How far the set swings either side of `phaseDegrees` while animating. */
  travel: number;
  /** Turnaround shape: 0 linear, 1 sine, -1 hurrying into the turn. */
  easing: number;
  /** Where the speed sits within a sweep: positive leaves fast and arrives slow. Inverts with direction. */
  easingBias: number;
  /** Rest at each end, in sweep lengths; taken out of the half-cycle, so the period is unchanged. */
  interval: number;
  /** Offset between one band and the next along the track. */
  stagger: number;
  /** Which band leads the stagger: 1 the first, 0 the centre outward, -1 the last. */
  symmetry: number;
  /** Gap between ribbons in ribbon widths; widens the stack rather than thinning the ribbons. */
  spread: number;
  /** The stack's width across the fan at `spread` 0, shared by `bandCount` ribbons. */
  bandwidth: number;
  /** Radius of the apex turn, and the fan's half-width there; 0 is a sharp point. */
  roundness: number;
  /** Where the fan converges, leftward from centre; 0 shows a mirrored bowtie. */
  apex: number;
  /** Length of a band's single gradient along the track. */
  rampLength: number;
  bandCount: number;
  /** Bows the streamlines. 0 is a straight fan; the sign picks the direction. */
  curve: number;
  /** Perspective lean of the plane away from the viewer; the sign picks which end tips. */
  tilt: number;
  /** Curls the surface away through the perspective divide; `curve` only bends the picture. */
  depth: number;
  /** Cross-band blur. 0 is a hard edge, 1 is a smooth wash. */
  softness: number;
  /** Fade at each band's ends along the track, and how far its rails trail; never the silhouette. */
  tail: number;
  /** Ordered (Bayer) dither on the ribbons; 0 disables it. */
  rampDither: number;
  /** One Bayer cell, in device pixels. */
  ditherSize: number;
  /** How far past its band a rail runs, in ramp lengths; 0 ends it with the fill. */
  edgeTail: number;
  /** Rail dither, 0..2; past 1 it thins the rail's core so the pattern shows. */
  edgeDither: number;
  /** Rail thickness in CSS pixels; 0 draws none. */
  edgeWidth: number;
}

// A quarter turn is the old 7-unit reach, so saved phases render unchanged.
const TRACK_UNITS_PER_QUARTER_TURN = 7;
export const TRACK_UNITS_PER_DEGREE = TRACK_UNITS_PER_QUARTER_TURN / 90;

export const DEFAULT_COSMIC_TRACK: CosmicTrackParams = {
  colors: ["#2E6BFF", "#C89BFF", "#FFB3D9", "#FFD9A0", "#FFF3C4"],
  colorBack: "#12042BFF",
  phaseDegrees: 0,
  travel: 1.5,
  easing: 1,
  easingBias: 0,
  interval: 0,
  stagger: 0.45,
  symmetry: 1,
  spread: 0.25,
  bandwidth: 0.7,
  roundness: 0.35,
  apex: 2.2,
  rampLength: 1.6,
  bandCount: 7,
  curve: 0.35,
  tilt: 0.6,
  depth: 0,
  softness: 0.55,
  tail: 0.25,
  rampDither: 0.35,
  ditherSize: 3,
  colorEdge: "#FFFFFFFF",
  edgeTail: 0.5,
  edgeDither: 0,
  edgeWidth: 0,
};

export interface CosmicTrackUniforms {
  u_colors: [number, number, number, number][];
  u_colorsCount: number;
  u_colorBack: [number, number, number, number];
  u_phase: number;
  u_travel: number;
  u_easing: number;
  u_easingBias: number;
  u_interval: number;
  u_stagger: number;
  u_symmetry: number;
  u_spread: number;
  u_bandwidth: number;
  u_roundness: number;
  u_apex: number;
  u_rampLength: number;
  u_bandCount: number;
  u_curve: number;
  u_tilt: number;
  u_depth: number;
  u_softness: number;
  u_tail: number;
  u_rampDither: number;
  u_ditherSize: number;
  u_colorEdge: [number, number, number, number];
  u_edgeTail: number;
  u_edgeDither: number;
  u_edgeWidth: number;
}

export function toCosmicTrackUniforms(
  params: CosmicTrackParams,
): CosmicTrackUniforms {
  const given = params.colors.slice(0, COSMIC_TRACK_MAX_COLORS);
  // An empty list would divide by zero in the ramp; fall back to a flat colour.
  const colors = given.length > 0 ? given : [params.colorBack];

  const converted = colors.map(
    (color) => getShaderColorFromString(color) as [number, number, number, number],
  );

  // Padded to the fixed uniform size; `u_colorsCount` must stay the real count.
  const padded = [...converted];
  while (padded.length < COSMIC_TRACK_MAX_COLORS) {
    padded.push(converted[converted.length - 1]);
  }

  return {
    u_colors: padded,
    u_colorsCount: converted.length,
    u_colorBack: getShaderColorFromString(params.colorBack) as [
      number,
      number,
      number,
      number,
    ],
    u_phase: params.phaseDegrees * TRACK_UNITS_PER_DEGREE,
    u_travel: params.travel,
    // Clamped: `mix` extrapolates past ±1 into a broken swing.
    u_easing: Math.min(Math.max(params.easing, -1), 1),
    u_easingBias: Math.min(Math.max(params.easingBias, -1), 1),
    // The shader divides by (1 + interval), so it must not go below 0.
    u_interval: Math.min(Math.max(params.interval, 0), 2),
    u_stagger: params.stagger,
    // Clamped: `mix` extrapolates past ±1.
    u_symmetry: Math.min(Math.max(params.symmetry, -1), 1),
    u_spread: params.spread,
    u_bandwidth: params.bandwidth,
    u_roundness: params.roundness,
    u_apex: params.apex,
    u_rampLength: Math.max(params.rampLength, MIN_RAMP_LENGTH),
    u_bandCount: Math.max(params.bandCount, 1),
    u_curve: params.curve,
    u_tilt: params.tilt,
    // A negative depth drives the perspective divisor through zero and mirrors the plane.
    u_depth: Math.min(Math.max(params.depth, 0), 1),
    u_softness: params.softness,
    u_tail: params.tail,
    u_rampDither: params.rampDither,
    u_ditherSize: params.ditherSize,
    u_colorEdge: getShaderColorFromString(params.colorEdge) as [
      number,
      number,
      number,
      number,
    ],
    u_edgeTail: Math.max(params.edgeTail, 0),
    // The shader's two stages: threshold (0..1), then opening the core (1..2).
    u_edgeDither: Math.min(Math.max(params.edgeDither, 0), 2),
    u_edgeWidth: Math.max(params.edgeWidth, 0),
  };
}
