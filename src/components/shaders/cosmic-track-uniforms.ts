import { getShaderColorFromString } from "@paper-design/shaders";

// ---------------------------------------------------------------------------
// CosmicTrack — friendly props in, GLSL uniforms out.
//
// A pure module, deliberately: jsdom has no WebGL and every suite that renders
// a shader mocks `@paper-design/shaders-react` wholesale, so the conversion is
// the only part of a shader this repo can actually assert on. Paper draw the
// same line (`toProcessedGemSmoke`, `toProcessedLiquidMetal`) — the component
// stays a thin binding over a function that can be tested at a desk.
// ---------------------------------------------------------------------------

/** Matches `uniform vec4 u_colors[10]` in the fragment shader. Keep in step. */
export const COSMIC_TRACK_MAX_COLORS = 10;

/**
 * Floor for the gradient span, which divides the along-track coordinate. Zero
 * there fills the frame with inf/NaN and reads as a dead canvas rather than as
 * a bad setting, and clamping in the UI would leave the component unsafe for
 * every other caller.
 */
const MIN_RAMP_LENGTH = 0.001;

export interface CosmicTrackParams {
  /** The ramp read ACROSS the fan, edge to edge. Up to `COSMIC_TRACK_MAX_COLORS`. */
  colors: string[];
  /** The flat ground the fan sits on. Alpha 0 makes the layer stackable. */
  colorBack: string;
  /**
   * How far the whole set of bands has travelled along the track — the
   * reference's ANGLE.
   *
   * It does NOT touch the geometry: at both ends of the reference's slider the
   * streamlines sit in identical positions, and only the bands' position along
   * them changes. Each band carries the same gradient and keeps it while it
   * moves. The fan’s own shape comes from `apex` and `roundness`.
   */
  angle: number;
  /**
   * How far the set swings either side of `angle` while animating.
   *
   * Motion here OSCILLATES — the set runs out along the track and returns by
   * the same path, the way the reference's slider is dragged forward and back.
   * A one-way drift would carry the bands off and never bring them home.
   */
  travel: number;
  /**
   * The offset between one band and the next, along the track.
   *
   * This is what makes the leading edges form a staircase rather than arriving
   * as one straight front — the single most recognisable thing about the
   * reference, and impossible without a DISCRETE band index to multiply.
   */
  stagger: number;
  /**
   * WHICH BAND the staircase is measured from — the arrangement, not the size
   * of a step (that stays `stagger`).
   *
   * At 1 the offsets run straight down the stack: the first band leads, each
   * one after it sits a step further back, and the last trails by the whole
   * span. At 0 the stack is MIRRORED about its middle band — first and last
   * share an offset, second and second-last share theirs, and so on — so the
   * stagger grows outward from the CENTRE instead of from an edge.
   *
   * The two ends cover the same total spread, so turning this does not resize
   * the staircase; it only moves which band leads it, and the values between
   * walk the leader from the edge to the middle.
   */
  symmetry: number;
  /**
   * The GAP between adjacent ribbons.
   *
   * Each ribbon fills only part of its slot, centred, with ground either side,
   * so raising this pulls them apart without moving them off their own tracks.
   * At 0 they touch and the set reads as one sheet.
   *
   * The counterpart to `bandwidth`: this is applied AFTER the slots are cut, so
   * it separates them; `bandwidth` is applied before, so it narrows them while
   * they stay contiguous.
   */
  spread: number;
  /**
   * The gradient’s WIDTH — how much of the fan the stack of ribbons occupies,
   * measured outward from the centre line.
   *
   * It compresses the whole stack, so every ribbon narrows together and they
   * stay STUCK TOGETHER, edge to edge, with no ground opening between them.
   * Independent of `spread` (the GAP between ribbons) and of `bandCount` (how
   * many ribbons share the width).
   */
  bandwidth: number;
  /**
   * How rounded the convergence is where the ribbons meet.
   *
   * 0 converges to a true POINT — a sharp apex. Above it the turn is a smooth
   * curve, which is the default: the apex is an artefact of measuring the fan
   * with abs(x), not something the reference shows.
   */
  roundness: number;
  /**
   * Where the fan converges, measured leftward from the frame’s centre.
   *
   * The fan is SYMMETRIC about its apex, so 0 puts the convergence mid-frame
   * and shows two mirrored lobes — a bowtie rather than a track. Past the edge
   * (the default) leaves one continuous fan, and makes the along-track distance
   * monotonic everywhere visible, which is what keeps the centre seamless.
   */
  apex: number;
  /**
   * How far along the track a band's gradient spans, from its first colour to
   * its last. There is exactly ONE gradient per band — beyond its two ends the
   * track carries the background, not another copy of the palette.
   */
  rampLength: number;
  /** How many ribbons the ramp is divided into. */
  bandCount: number;
  /** Bows the streamlines. 0 is a straight fan; the sign picks the direction. */
  curve: number;
  /**
   * The angle the tracks make with the surface — how far the plane leans away
   * from the viewer instead of lying flat on its back.
   *
   * A perspective divide, so the ribbons foreshorten and converge toward a
   * horizon as they recede. 0 is dead flat-on; the sign picks which end tips
   * away. Applied before all the track geometry, so everything downstream is
   * measured in the tilted plane's own space.
   */
  tilt: number;
  /**
   * How far the sheet the tracks lie on CURLS away from the viewer, on top of
   * the flat lean `tilt` gives it.
   *
   * 0 is that flat sheet — the shader as it was before this existed. Toward 1
   * the surface bows, so the tracks bend more and more sharply as they run out
   * and their spacing crowds where the surface turns away, which is what reads
   * as them moving through depth rather than as curves drawn on glass.
   *
   * The distinction from `curve` is the whole point of having both: `curve`
   * bends the tracks IN THE PICTURE, so their spacing is untouched and they
   * stay as flat as a printed line. This bends the SURFACE, through the same
   * perspective divide as `tilt`, so the bend arrives with foreshortening.
   */
  depth: number;
  /** Cross-band blur. 0 is a hard edge, 1 is a smooth wash. */
  softness: number;
  /**
   * How far each band’s gradient fades out at its ENDS, along the track.
   *
   * Only the ends. The fan’s outer silhouette keeps a fixed hairline, so
   * raising this lengthens the fade on every band without dissolving the first
   * and last ones — those sit against the silhouette, and softening it reads as
   * them disappearing rather than as a longer tail.
   */
  tail: number;
  /**
   * Strength of the ORDERED (Bayer) dither. 0 disables it.
   *
   * Ordered dithering quantises the colour to a coarse set of levels and uses a
   * repeating Bayer threshold matrix to decide which way each pixel rounds,
   * which is what produces the characteristic crosshatch. It is stable frame to
   * frame, unlike noise, which crawls.
   *
   * The control sets how coarse: low values keep enough levels to read as a
   * smooth gradient, high values drop to a handful and the pattern becomes the
   * point.
   *
   * Applied to the FOREGROUND only — the ribbons. The ground is a flat fill
   * with nothing to dither, so quantising it would only stipple a clean colour.
   */
  dither: number;
  /**
   * Size of one Bayer cell, in DEVICE pixels.
   *
   * At 1 the whole 8x8 matrix spans 8 device pixels — on a 2x display that is
   * 4 CSS pixels, present but far too fine to read as a pattern. Raising it
   * coarsens the crosshatch. Floored at 1 in the shader, since a cell smaller
   * than a pixel has nothing to land on.
   */
  ditherSize: number;
}

/** A legible fan, and the row the playground's control table starts from. */
export const DEFAULT_COSMIC_TRACK: CosmicTrackParams = {
  colors: ["#2E6BFF", "#C89BFF", "#FFB3D9", "#FFD9A0", "#FFF3C4"],
  colorBack: "#12042BFF",
  angle: 0,
  travel: 1.5,
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
  dither: 0.35,
  ditherSize: 3,
};

export interface CosmicTrackUniforms {
  u_colors: [number, number, number, number][];
  u_colorsCount: number;
  u_colorBack: [number, number, number, number];
  u_angle: number;
  u_travel: number;
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
  u_dither: number;
  u_ditherSize: number;
}

export function toCosmicTrackUniforms(
  params: CosmicTrackParams,
): CosmicTrackUniforms {
  const given = params.colors.slice(0, COSMIC_TRACK_MAX_COLORS);
  // An empty list would divide by zero in the ramp and render black. A caller
  // mistake should degrade to a flat colour, not to a void.
  const colors = given.length > 0 ? given : [params.colorBack];

  const converted = colors.map(
    (color) => getShaderColorFromString(color) as [number, number, number, number],
  );

  // The uniform slot is fixed-size, so the tail is padded — but `u_colorsCount`
  // reports the REAL count, or the ramp walks off into unset colours and every
  // gradient fades out at its end.
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
    u_angle: params.angle,
    u_travel: params.travel,
    u_stagger: params.stagger,
    // Clamped rather than passed through: the shader MIXES between the two
    // arrangements, and `mix` extrapolates — past either end the bands are
    // dragged beyond both, which is not a third look but a broken one.
    u_symmetry: Math.min(Math.max(params.symmetry, 0), 1),
    u_spread: params.spread,
    u_bandwidth: params.bandwidth,
    u_roundness: params.roundness,
    u_apex: params.apex,
    u_rampLength: Math.max(params.rampLength, MIN_RAMP_LENGTH),
    u_bandCount: Math.max(params.bandCount, 1),
    u_curve: params.curve,
    u_tilt: params.tilt,
    // Clamped, and the floor is the one that matters: the curl is added to the
    // perspective divisor, so a negative one drives it toward zero and through
    // it — past that the surface has crossed the viewer and the plane is
    // mirrored back on itself, which is a fold, not a deeper curve.
    u_depth: Math.min(Math.max(params.depth, 0), 1),
    u_softness: params.softness,
    u_tail: params.tail,
    u_dither: params.dither,
    u_ditherSize: params.ditherSize,
  };
}
