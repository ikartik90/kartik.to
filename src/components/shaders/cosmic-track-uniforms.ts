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
   * The colour the rails are drawn in when `edges` is on.
   *
   * Its ALPHA is the highlight's strength — the rail is composited OVER the
   * finished graphic at that opacity, so an opaque colour covers whatever is
   * under the line and a half-transparent one veils it. That is why there is no
   * separate intensity control.
   *
   * The line keeps this colour along its whole length, tail included. Only its
   * opacity falls off, which is the difference between a highlight fading out
   * and one turning into the colour beneath it.
   *
   * A colour of its own rather than the ribbon's own lifted toward white, which
   * is what this used to be: the ramp reaches its lightest colour at the middle
   * of every band, so a fixed lift blew the rails out to white there while
   * leaving them tinted at the ends.
   */
  colorEdge: string;
  /**
   * How far the whole set of bands has travelled along the track — the phase of
   * the run — DIALLED IN DEGREES, where a QUARTER turn is the full reach in one
   * direction.
   *
   * The degrees are a SCALE, not a geometry. This is a distance along the
   * track, in the same units as `apex` and `rampLength`, and the run does not
   * repeat — which is why the dial stops at a QUARTER turn either way rather
   * than matching the rotation beside it. A dial running to ±180 would imply a
   * full turn, and invite the reading that its two ends meet; ±90 reads as a
   * deflection either way from square-on, which is what this actually is. (The reference called this its ANGLE, and it was
   * renamed for exactly that reason — naming it one invited looking for it
   * among `tilt`, `curve` and `roundness`.) What the degrees buy is a dial that
   * reads and steps like the rotation beside it, which is what the author asked
   * of it; `TRACK_UNITS_PER_DEGREE` is where the fiction is converted away, and
   * everything below this line is in track units.
   *
   * SIGNED about the apex, which is the part worth knowing: 0 parks the set at
   * the frame's centre, `-apex` puts it exactly on the apex, and going past
   * that carries it through onto the far lobe. So a band can be placed before
   * the apex, on it, or after it, and `travel` swinging either side of this
   * sweeps one through and back — rather than the set pulsing out of the apex
   * and dying back into it, which is all an unsigned distance can express.
   *
   * It does NOT touch the geometry: at both ends of the reference's slider the
   * streamlines sit in identical positions, and only the bands' position along
   * them changes. Each band carries the same gradient and keeps it while it
   * moves. The fan’s own shape comes from `apex` and `roundness`.
   */
  phaseDegrees: number;
  /**
   * How far the set swings either side of `phaseDegrees` while animating.
   *
   * Motion here OSCILLATES — the set runs out along the track and returns by
   * the same path, the way the reference's slider is dragged forward and back.
   * A one-way drift would carry the bands off and never bring them home.
   */
  travel: number;
  /**
   * How the swing's turnarounds are shaped — its timing curve, apart from how
   * far it goes (`travel`) and how fast (the mount's own `speed`).
   *
   * Signed about a LINEAR swing. 0 is that: constant speed, reversing on the
   * spot, which reads as a mechanism rather than as drift. Toward 1 the set
   * decelerates into each end and accelerates out of it — easing out of the
   * sweep — reaching at 1 the sine this shader animated on before the control
   * existed. Toward -1 it eases IN instead, hurrying into the turnaround and
   * lingering mid-travel.
   *
   * 1 is the default rather than the neutral 0 because the eased turnaround is
   * the shader's own long-standing choice — a sine rather than a triangle, so
   * the set turns instead of snapping direction. The control exists to undo
   * that deliberately, not to have it undone by omission.
   */
  easing: number;
  /**
   * Where the speed sits within a sweep across the track — pushing off one end
   * of the travel fast and gliding into the other, or the reverse.
   *
   * 0 spends the sweep evenly, which is what a sine does. Positive leaves the
   * end it is at quickly and arrives at the far one slowly; negative eases away
   * and arrives fast.
   *
   * It INVERTS with the direction of travel, so the way back leans the same way
   * relative to where it is going: one gesture repeated, not a fast pass
   * followed by a slow one. That is what the sweeps are cut at the extremes
   * for — a single lean laid over the whole cycle takes the opposite sign on
   * its second half, which is the version this replaced.
   *
   * Distinct from `easing`, which shapes each sweep symmetrically about its
   * middle. This is the one that makes the start of a sweep differ from its end.
   *
   * The sweeps keep half the cycle each whatever this is set to — the shaping
   * integrates to exactly 1 across a sweep, so the extremes cannot be moved,
   * only the time between them redistributed.
   *
   * At 1 the set carries 65% of a sweep's travel into its first quarter, against
   * 15% at rest. The shader gets there by applying its warp twice rather than by
   * deepening it once, which is forced: a single pass cannot lean harder without
   * stalling mid-sweep.
   *
   * The set therefore ARRIVES at a different speed from the one the next sweep
   * leaves at, and that is not a defect to be designed out — it is what a lean
   * is. A rate that decelerates the whole way across a sweep cannot also finish
   * where it started; forcing it to climb back at the end instead, which is the
   * obvious repair, throws away the deceleration exactly where it was working.
   *
   * `interval` is what answers it: a rest between the strokes leaves nothing for
   * the eye to compare. At `interval` 0 a strong negative bias will read as a
   * bounce off the far end, because that is what accelerating into a turnaround
   * looks like.
   */
  easingBias: number;
  /**
   * How long the set RESTS at each end of its travel before starting back, in
   * sweep lengths — 1 sits still for as long as the crossing itself takes.
   *
   * 0 is the unbroken swing this had before the control existed: the set arrives
   * and reverses in the same instant.
   *
   * Taken OUT of the half-cycle rather than added to it, so the swing keeps the
   * cadence `speed` sets and the crossing gets brisker as the rest grows. A rest
   * that lengthened the period would be this control quietly doing Speed's job.
   *
   * The reason to want one: with the two strokes adjacent, a sweep that ends
   * fast beside a reverse that starts slow reads as a bounce off a wall, however
   * continuous the speed across the turn is. A rest does not make that asymmetry
   * smaller — it removes the comparison.
   *
   * At `easing` 1 the set glides to a stop and glides away again, because full
   * easing already zeroes the speed at a turnaround. Below 1 it stops and starts
   * abruptly at the ends of the rest, which is what less easing means.
   */
  interval: number;
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
   * It walks the LEADER — the band that runs ahead of the rest — across the
   * stack. At 1 the offsets run straight down from the first band, each one
   * after it a step further back, and the last trails by the whole span. At 0
   * the stack is MIRRORED about its middle band — first and last share an
   * offset, second and second-last share theirs — so the stagger grows outward
   * from the CENTRE. At -1 the walk carries on to the last band and the stack
   * runs the other way down.
   *
   * Every arrangement covers the same total spread, so turning this does not
   * resize the staircase; it only moves which band leads it.
   *
   * The two ENDS are mirrors, which negating `stagger` would also give. The
   * values in between are what this reaches and nothing else does: a
   * half-mirrored stack is not a scaled version of any of them.
   */
  symmetry: number;
  /**
   * The GAP between adjacent ribbons, measured in RIBBON WIDTHS. 0 is touching,
   * 1 puts a ribbon's worth of ground between them, 2 puts two.
   *
   * It makes room by WIDENING the stack, not by thinning the ribbons: the slot
   * grows by the same factor the ribbon's share of it shrinks, so a ribbon is
   * `bandwidth` / `bandCount` wide across the fan at every setting of this and
   * only the ground between them moves.
   *
   * The clean split with `bandwidth` is the point — that one owns how WIDE a
   * ribbon is, this owns how far APART they sit, and neither reaches into the
   * other.
   *
   * The fan is finite, so this does run out: spread far enough and the
   * outermost ribbons pass the silhouette and are clipped by it. Narrow
   * `bandwidth` to bring them back.
   */
  spread: number;
  /**
   * How WIDE each ribbon is — the stack's full width across the fan at
   * `spread` 0, shared out between `bandCount` ribbons sitting edge to edge.
   *
   * It compresses the whole stack, so every ribbon narrows together and they
   * stay STUCK TOGETHER with no ground opening between them; opening ground is
   * `spread`'s job, and it does that by widening the stack rather than by
   * reaching back in here. So this stays the ribbon's width at every spread.
   */
  bandwidth: number;
  /**
   * How rounded the convergence is where the ribbons meet — and, the same
   * number read the other way, the fan's HALF-WIDTH at the apex.
   *
   * 0 converges to a true POINT — a sharp apex. Above it the turn is a smooth
   * curve, which is the default: the apex is an artefact of measuring the fan
   * with abs(x), not something the reference shows.
   *
   * The width reading is the one that matters when picking a value. The fan's
   * half-width is sqrt(q² + roundness²) at every x, so this is the waist it
   * never narrows past — and there is no ceiling to it. Take it beyond the
   * frame's own half-height and the sqrt is dominated by this term everywhere
   * visible: the sides stop tapering and the track runs parallel.
   *
   * What the ribbons actually occupy is `bandwidth` × this, so a narrow stack
   * needs a proportionally larger value to fill the same frame.
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
   * How far each band’s gradient fades out at its ENDS, along the track — and,
   * when `edges` is on, how far that band's rails trail past it before they
   * dissolve.
   *
   * Only the ends. The fan’s outer silhouette keeps a fixed hairline, so
   * raising this lengthens the fade on every band without dissolving the first
   * and last ones — those sit against the silhouette, and softening it reads as
   * them disappearing rather than as a longer tail.
   *
   * The rails are given the same control rather than one of their own because
   * they are the same idea applied to the same axis: without it they are pure
   * geometry, and pure geometry does not move — the set slides along the track
   * while the lines sit still at one flat brightness. Their reach runs well
   * past the band's own span, so the highlight still reads past a fill this has
   * already dissolved.
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
  rampDither: number;
  /**
   * Size of one Bayer cell, in DEVICE pixels.
   *
   * At 1 the whole 8x8 matrix spans 8 device pixels — on a 2x display that is
   * 4 CSS pixels, present but far too fine to read as a pattern. Raising it
   * coarsens the crosshatch. Floored at 1 in the shader, since a cell smaller
   * than a pixel has nothing to land on.
   */
  ditherSize: number;
  /**
   * How far past its band a rail keeps running before it goes out, in ramp
   * lengths. 0 puts it out with the fill.
   *
   * Separate from `tail` because the two answer different questions — `tail` is
   * how softly a band ENDS, this is how far its rails OUTLIVE it. They still
   * begin fading together, so this only moves where the rails finish.
   */
  edgeTail: number;
  /**
   * How hard the RAILS are dithered, 0..2 — independent of `dither`.
   *
   * Either can be on with the other off: a stippled set of ribbons under clean
   * hairlines, or smooth ribbons ruled with dithered lines. The two share one
   * Bayer matrix (and so one `ditherSize`), which keeps the rails' dots landing
   * in the ribbons' own grid rather than beating against it.
   *
   * It runs to 2 because a threshold has a ceiling short of 1's worth of
   * effect. Dithering represents an INTERMEDIATE value with a pattern, and a
   * rail's core is coverage 1 — nothing intermediate to represent, so the
   * stipple reaches only the antialiased flanks and the tail however hard the
   * threshold is pushed. Past 1 this stops asking for more threshold and starts
   * lowering the coverage the threshold sees, which opens the pattern across
   * the whole line. The rail thins as it does: a dithered rendering of "fully
   * opaque" is fully opaque, and the only way to see more pattern is to ask for
   * less ink.
   */
  edgeDither: number;
  /**
   * How thick a rail is drawn, in CSS PIXELS — and whether one is drawn at all,
   * since 0 is no line. One number rather than a switch beside a width: a
   * switch that only gates another control is a step that value can take on its
   * own, and two of them can disagree in a way one cannot.
   *
   * A screen measurement, not a track one, and deliberately: `tilt` and `depth`
   * crush the far end of the track, so a width in the shader's own units would
   * thin away precisely where the structure is hardest to read. Scaled by the
   * mount's pixel ratio, so the line does not halve on a 2x display or halve
   * again in an export that pins the buffer higher still.
   */
  edgeWidth: number;
}

/**
 * The track distance one degree of `phaseDegrees` buys.
 *
 * A QUARTER TURN is the full reach in one direction — the seven track units the
 * control ran to before it was dialled in degrees — so this conversion is
 * exactly what turns every previously saved phase into the same picture. It is
 * a scale and nothing more: see `phaseDegrees` for why the run is not periodic
 * and the degrees are not geometry.
 */
const TRACK_UNITS_PER_QUARTER_TURN = 7;
export const TRACK_UNITS_PER_DEGREE = TRACK_UNITS_PER_QUARTER_TURN / 90;

/** A legible fan, and the row the playground's control table starts from. */
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
    // The one place the degrees are converted away — the shader is in track
    // units end to end, and every comment in it says so.
    u_phase: params.phaseDegrees * TRACK_UNITS_PER_DEGREE,
    u_travel: params.travel,
    // Both are mix factors, so both are clamped for the reason `symmetry` is:
    // `mix` extrapolates, and past either end the swing is dragged beyond the
    // curves it is blending between — not a stronger ease, a broken one.
    u_easing: Math.min(Math.max(params.easing, -1), 1),
    u_easingBias: Math.min(Math.max(params.easingBias, -1), 1),
    // Floored at 0 and capped: the shader divides a half-cycle by (1 + this), so
    // anything at or below -1 inverts the half-cycle and runs the set backwards
    // through its own rest.
    u_interval: Math.min(Math.max(params.interval, 0), 2),
    u_stagger: params.stagger,
    // Clamped rather than passed through: the shader MIXES between the
    // arrangements, and `mix` extrapolates — past either end the bands are
    // dragged beyond all of them, which is not a fourth look but a broken one.
    u_symmetry: Math.min(Math.max(params.symmetry, -1), 1),
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
    u_rampDither: params.rampDither,
    u_ditherSize: params.ditherSize,
    u_colorEdge: getShaderColorFromString(params.colorEdge) as [
      number,
      number,
      number,
      number,
    ],
    u_edgeTail: Math.max(params.edgeTail, 0),
    // Clamped to the two stages the shader splits this into — how much
    // threshold (0..1) and how far open (1..2). Past 2 there is no third stage,
    // only a duty driven negative.
    u_edgeDither: Math.min(Math.max(params.edgeDither, 0), 2),
    u_edgeWidth: Math.max(params.edgeWidth, 0),
  };
}
