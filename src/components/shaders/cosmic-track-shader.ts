import { COSMIC_TRACK_MAX_COLORS } from "./cosmic-track-uniforms";

// ---------------------------------------------------------------------------
// CosmicTrack — a fan of ribbons radiating from a point, over a flat ground.
//
// Written rather than assembled: the library exports each built-in's GLSL as a
// finished program, but the snippets those programs are built FROM
// (`declarePI`, `proceduralHash21`, …) live in `shader-utils.js`, which the
// package's `exports` map does not expose. You get whole shaders, not their
// parts — so anything new is written from scratch against the two contracts the
// mount actually provides:
//
//   • `v_objectUV` — centred on 0, with scale/rotation/offset/fit already
//     applied by the library's vertex shader. Doubled below to reach ±1, which
//     is the convention every built-in uses.
//   • PREMULTIPLIED output. `fragColor = vec4(rgb * a, a)`, exactly as
//     `dot-grid` and `static-mesh-gradient` do it. This is what lets an
//     alpha-zero `colorBack` composite over another shader instead of punching
//     a black hole in it.
//
// The geometry is one idea: divide the vertical distance from the axis by a
// half-width that GROWS with |x|. Lines of constant ratio are then a fan
// converging on a point, and everything else — the bands, the ramp, the
// silhouette — is read off that single cross-fan coordinate.
// ---------------------------------------------------------------------------

export const cosmicTrackMeta = {
  maxColorCount: COSMIC_TRACK_MAX_COLORS,
} as const;

export const cosmicTrackFragmentShader = `#version 300 es
precision mediump float;

uniform vec4 u_colors[${COSMIC_TRACK_MAX_COLORS}];
uniform float u_colorsCount;
uniform vec4 u_colorBack;
uniform vec4 u_colorEdge;

uniform float u_phase;
uniform float u_travel;
uniform float u_easing;
uniform float u_easingBias;
uniform float u_interval;
uniform float u_stagger;
uniform float u_symmetry;
uniform float u_spread;
uniform float u_bandwidth;
uniform float u_roundness;
uniform float u_apex;
uniform float u_rampLength;
uniform float u_bandCount;
uniform float u_curve;
uniform float u_tilt;
uniform float u_depth;
uniform float u_softness;
uniform float u_tail;
uniform float u_rampDither;
uniform float u_ditherSize;
uniform float u_edgeTail;
uniform float u_edgeDither;
uniform float u_edgeWidth;

uniform float u_time;
// Device pixels per CSS pixel, set by the mount. Read so the edge highlight's
// hairline is a fixed width on the SCREEN rather than in the frame buffer —
// otherwise it halves on a 2x display and halves again in an exported cover,
// which pins the buffer higher still.
uniform float u_pixelRatio;

in vec2 v_objectUV;
out vec4 fragColor;

// Radians per second of the swing at speed 1. Slow, because this is a ground:
// the set should breathe along the track, not march.
#define DRIFT_RATE 0.35

#define HALF_PI 1.5707963
#define PI 3.1415927

// How hard the bias may bend a sweep's timing. Under 1 on purpose — the warped
// rate is 1 + bias*cos, so 1 would stall the set dead at one end of its travel
// and anything past it would run that stretch backwards.
#define BIAS_DEPTH 0.8

// Quantisation levels per channel at the two ends of the dither control.
//
// The top end is deliberately coarse: with only a handful of levels the Bayer
// pattern is unmistakable, which is the look being asked for. The bottom end
// stays fine enough to read as a smooth gradient that merely happens to be
// dithered — so the slider travels from "clean" to "openly patterned" and every
// part of it changes something visible.
#define DITHER_MAX_LEVELS 48.0
#define DITHER_MIN_LEVELS 3.0

// How far OPEN the rails' stipple goes at the top of u_edgeDither — the duty
// the line's core is thresholded against once the control passes 1.
//
// It exists because a threshold has a hard ceiling that a mix factor cannot
// lift. Dithering represents an INTERMEDIATE value with a pattern, and the core
// of a rail is coverage 1 — there is nothing intermediate about it, so
// step(coverThreshold, 1.) is 1 on every cell of the matrix and the core stays
// solid however hard the control is pushed. The stipple can only ever land on
// the antialiased flanks and the tail, which on a wide ribbon is a sliver of
// the shape and on a two-pixel line is all there is.
//
// So past 1 the control stops asking how MUCH threshold and starts lowering
// what the threshold is applied to. At 0.5 the core is asking for half its
// pixels, so half the matrix lights and the pattern opens across the whole
// line rather than clinging to its edges. The line is sparser for it, which is
// not a side effect — a dithered rendering of "fully opaque" is fully opaque,
// and the only way to see more pattern is to ask for less ink.
#define EDGE_DITHER_OPEN 0.5

// The edge highlight is described by three things, and none of them is a
// constant any more:
//
//   • u_edgeWidth — the line's thickness in CSS PIXELS, and the switch as
//     well, since 0 is no line at all. A screen measurement
//     rather than a track one is the whole trick: u_tilt and u_depth crush the
//     far end of the track, so a width in track units would thin away exactly
//     where the structure gets hardest to read. The fwidth() below is what
//     converts between the two, and u_pixelRatio between CSS and device pixels.
//   • u_colorEdge — the line's colour, and its alpha the line's strength. Not a
//     lift out of the ramp underneath, which tied the line to whatever its band
//     was showing: the ramp peaks at its lightest colour in the middle of every
//     band, so the rails blew out to white there and stayed tinted at the ends,
//     from one constant that could not be right in both places.
//   • u_edgeTail — how far past its band a rail runs before it goes out.

// The exponent the surface curls with at u_depth 1.
//
// 0 is a flat plane and 2 is a parabola; past that the far end falls away
// faster than any quadratic, which is what the top of the control is for. Set
// here rather than exposed: how much curvature counts as "fully curled" is a
// property of this shader's coordinate space, not a look decision worth a
// second slider.
#define DEPTH_POWER 3.0

// u_ditherSize is device pixels per cell of the Bayer matrix.
//
// The matrix is read in gl_FragCoord, i.e. DEVICE pixels, so on a 2x display a
// 1:1 mapping puts the whole 8x8 pattern inside 4 CSS pixels — technically
// present, far too fine to read as a pattern. Enlarging the cell is what makes
// the crosshatch legible, and how coarse it should be is a look decision, so it
// is a control rather than a constant.

// ORDERED (Bayer) dither threshold.
//
// A fixed, repeating threshold matrix rather than random noise — which is the
// whole point: ordered dithering produces the characteristic crosshatch, and it
// is stable frame to frame, where noise crawls.
//
// Built recursively rather than as a literal table: each level is the previous
// one at half scale plus a 2x2, which is exactly how a Bayer matrix is defined,
// and it costs no uniform array or dynamic indexing.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * .5 + a.y * a.y * .75);
}

#define bayer4(a) (bayer2(.5 * (a)) * .25 + bayer2(a))
#define bayer8(a) (bayer4(.5 * (a)) * .25 + bayer2(a))

// One pass of the bias warp: re-times a sweep's progress without moving its
// ends. Named rather than inlined because it is applied twice — see main().
//
// Its rate is 1 + bias*BIAS_DEPTH*cos(PI * along) — highest leaving one end,
// falling steadily, lowest arriving at the other. Integrating to exactly 1
// across the sweep is what pins the ends: the control decides how the time
// between them is spent, never how much of it there is.
//
// MONOTONE is the property that matters, and it was worth a wrong turn to
// learn. The rate necessarily ends somewhere other than it starts, so a sweep
// arrives at a different speed from the one the next leaves at — and with the
// two laid end to end that difference is a step, which is what a strong bias
// reads as at Interval 0: a bounce off the far end rather than a turn.
//
// The obvious repair is a rate pinned to 1 at BOTH ends, and it is a trap. A
// rate that starts and finishes at 1 while still averaging 1 cannot fall the
// whole way — it has to climb back at the finish. So the set slows, slows,
// slows, and then speeds up again in the last tenth before stopping dead, which
// is a far worse artefact than the one it cures: the deceleration the control
// exists to produce is thrown away exactly where it was working.
//
// So the step stays, and INTERVAL is what answers it — a rest between the
// strokes, where a difference in speed either side has nothing to be compared
// against. See u_interval in main().
float leanSweep(float along) {
  return along + u_easingBias * BIAS_DEPTH * sin(PI * along) / PI;
}

// The ramp read across the fan. Walks only the colours actually supplied —
// u_colorsCount is the real count, the array tail is padding.
vec4 rampAt(float p) {
  float count = max(u_colorsCount, 1.);
  if (count < 1.5) {
    return u_colors[0];
  }
  float scaled = clamp(p, 0., 1.) * (count - 1.);
  float lower = floor(scaled);
  float f = scaled - lower;
  int i0 = int(lower);
  int i1 = int(min(lower + 1., count - 1.));
  return mix(u_colors[i0], u_colors[i1], f);
}

void main() {
  vec2 uv = 2. * v_objectUV;

  // TILT — lean the plane away from the viewer instead of presenting it flat-on.
  //
  // A homogeneous divide, which is all perspective is: the further a point sits
  // up the plane, the larger the w it is divided by, so it shrinks and the
  // ribbons converge toward a horizon rather than running parallel forever.
  //
  // Applied to BOTH axes deliberately. Dividing y alone would squash the ribbons
  // vertically without narrowing them, which reads as a squeeze rather than a
  // lean — foreshortening is only convincing when the two shrink together.
  //
  // Done FIRST, before any of the track geometry, so everything downstream —
  // the fan, the bands, the along-track distance — is measured in the tilted
  // plane's own space and inherits the perspective for free.
  //
  // w is floored well above zero: at the horizon it passes through 0 and flips
  // sign, which would mirror the plane back on itself.
  // DEPTH — the same divide, but the surface is no longer flat.
  //
  // u_tilt alone makes w a LINEAR ramp in y, which is exactly a plane: straight
  // tracks stay straight and merely foreshorten. Multiplying by a POWER of the
  // along-track run curls that plane about the apex, so the sheet falls away
  // faster the longer it runs — and the tracks crossing it bend harder the
  // further out they go, which is the loose-rubber-band shape.
  //
  // Through the DIVIDE rather than by displacing the tracks, and that is the
  // whole difference between this and u_curve. A displacement bends the tracks
  // in the picture and leaves their spacing alone, so they read as curves drawn
  // on flat glass. Bending the divisor foreshortens too, so the ribbons crowd
  // where the surface turns away and open where it faces the viewer — which is
  // what the eye actually reads as depth.
  //
  // u_depth moves the EXPONENT, not a coefficient, and that is what gives the
  // control somewhere to go. Adding a scaled quadratic to w instead makes the
  // shape approach a fixed ratio of runs as the coefficient grows — so it is
  // nearly finished by the middle of the slider and the top half does almost
  // nothing. An exponent has no such ceiling: every step curls the surface
  // further than the last.
  //
  // Measured in units of the run at the frame's CENTRE column, so that column
  // is the hinge — reach is 1 there at every depth, and the near half swings
  // toward the viewer while the far half recedes around a composition that
  // stays put. Scaling w globally instead would zoom the graphic, which swamps
  // the bend with a change of size.
  //
  // pow() of a positive base is always positive, so unlike the tilt ramp this
  // can never carry the surface through the eye and mirror the plane.
  //
  // sqrt(run² + 1) rather than |run|, which is the same softening the fan's own
  // half-width uses below and is here for the same reason: |run| REACHES ZERO
  // when the apex sits inside the frame, and any positive exponent then drives
  // the divisor to its floor and magnifies a speck of the graphic across the
  // whole card — a blank canvas from two controls that are each fine alone.
  // Softening by one frame half-width keeps the base away from zero, so the
  // bowtie apex merely curls into a dome instead of going dark.
  float run = uv.x + u_apex;
  float reach = sqrt(run * run + 1.) / sqrt(u_apex * u_apex + 1.);
  float w = max((1. + u_tilt * uv.y) * pow(reach, u_depth * DEPTH_POWER), 1e-2);
  uv /= w;

  // Bow the fan so the ribbons curve instead of running dead straight.
  //
  // STRICTLY TIME-FREE, along with everything else that shapes the track. Time
  // belongs on the bands' position along the track, never on the track itself —
  // put it here and the whole fan oscillates while the gradient stays pinned,
  // which is exactly backwards from what animating this should look like.
  float bow = u_curve * uv.x * uv.x;
  float y = uv.y - bow;

  // Half-width of the fan at this x, opening with distance from the origin.
  //
  // sqrt(x² + k²) rather than |x|: the two agree everywhere except near the
  // origin, but |x| has a CORNER there and this does not. That corner is what
  // draws an apex where the ribbons converge — a hard V rather than a curve —
  // and it is a property of the abs(), not of any width parameter. An earlier
  // version tried to soften it with an additive "waist" (waist + width*|x|),
  // which merely widened the corner and left it just as sharp.
  //
  // u_roundness is the radius of that turn: 0 converges to a true point (the
  // sharp apex, still reachable), and anything above it rounds the convergence
  // into a smooth curve. It is a shape control, not the divide-by-zero guard —
  // the epsilon below stays private for that.
  //
  // Read the formula at q = 0 and it is also, exactly, the fan's HALF-WIDTH at
  // the apex — in the same units as its half-width anywhere else, which is what
  // makes the two readings the same control rather than two that need
  // reconciling. Every other x is sqrt(q² + u_roundness²), so the value is the
  // floor the whole fan is measured from: the waist it never narrows past, and
  // the amount the sides have to open by before they taper at all. Past the
  // frame's own half-height the sqrt is dominated by u_roundness everywhere
  // visible and the track reads as parallel-sided, which is why the control's
  // range runs well beyond the picture.
  //
  // u_roundness and u_apex ALONE decide this. The ramp phase must not reach the
  // geometry — in the reference, both ends of the ANGLE slider leave the
  // streamlines put and move only the colour along them.
  //
  // There is deliberately no width MULTIPLIER here: it and u_bandwidth would
  // both be plain scalars on the same quantity, so one of them is redundant.
  // u_bandwidth owns how wide the stack is; this owns only its shape.
  //
  // u_apex is where the fan converges, measured leftward from the frame's
  // centre. It matters far more than it looks: the fan is SYMMETRIC about its
  // apex, so an apex at 0 puts the convergence mid-frame and shows two mirrored
  // lobes — a bowtie, not a track. Pushing it past the edge leaves one
  // continuous fan, and makes the along-track distance below monotonic across
  // everything visible, which is what removes the seam rather than hiding it.
  float q = uv.x + u_apex;

  float halfWidth = max(sqrt(q * q + u_roundness * u_roundness), 1e-4);

  // Across the fan: 0 on the axis, ±1 at the silhouette.
  float t = y / halfWidth;
  float across = clamp(t * .5 + .5, 0., 1.);

  // The GAP between ribbons, in RIBBON WIDTHS — and the stack GROWS to make room
  // for it, rather than the ribbons shrinking to pay for it.
  //
  // That is the whole job of these two lines, and it is a cancellation. A gap
  // has to come from somewhere: cut it out of a slot of fixed width and every
  // ribbon thins as the set opens up, which is a different graphic rather than
  // a more open one. So the slot is WIDENED by exactly the factor that the
  // ribbon's share of it is NARROWED (see u_spread's reciprocal below), and the
  // two cancel — a ribbon stays u_bandwidth / u_bandCount wide across the fan
  // whatever u_spread is doing, and only the ground between them moves.
  //
  // Which leaves the two controls saying one thing each: u_bandwidth is how
  // WIDE a ribbon is, u_spread is how far APART they sit. At 0 they touch and
  // the set reads as one sheet, exactly as it did before this existed; at 1 the
  // gap equals one ribbon; at 2, two.
  //
  // The fan is finite, so the set does run out of room: spread far enough and
  // the outermost ribbons pass the silhouette at |t| = 1 and are clipped by it.
  // That is the fan ending, not the control breaking — narrow u_bandwidth and
  // they come back.
  float period = 1. + max(u_spread, 0.);
  float spreadWidth = u_bandwidth * period;

  // How wide the STACK is across the fan, measured outward from the centre
  // line: the ribbons' own width, times the room their gaps need.
  //
  // Note the division COMPRESSES the whole stack rather than shrinking each
  // ribbon inside a fixed slot, which is what keeps the ribbons stuck together
  // at spread 0 — every one narrows as u_bandwidth narrows, and they stay edge
  // to edge with no ground opening between them.
  //
  // Independent of u_bandCount, which sets how many ribbons share the width.
  float stack = (across - .5) / max(spreadWidth, 1e-4) + .5;

  // The stack's own outer boundary. Only a hairline unless softened — the
  // silhouette proper is handled below.
  float stackSoft = mix(.002, .2, u_softness);
  float inStack =
    smoothstep(0., stackSoft, stack) * smoothstep(0., stackSoft, 1. - stack);

  // The BAND INDEX — a whole number, and the piece everything else hangs off.
  // A ramp that is a smooth function of position cannot stagger: without a
  // discrete index there is nothing per-band to offset, and the bands can only
  // ever advance as one straight front.
  float bands = max(u_bandCount, 1.);
  float scaled = clamp(stack, 0., 1.) * bands;
  float index = floor(scaled);
  float f = scaled - index;

  // The ribbon's share of its own slot, and the second half of the cancellation
  // the stack width sets up above. Each ribbon fills this much of its slot,
  // centred, and the remainder is ground.
  //
  // A RECIPROCAL, not (1 - u_spread): the slot was widened by period, so this
  // has to narrow by exactly period for the ribbon to come out the same width
  // it started. Subtracting instead is what used to thin the ribbons — the slot
  // stayed put and the gap was taken out of the ribbon rather than added around
  // it.
  float fill = 1. / period;
  float halfBand = fill * .5;
  float offCentre = abs(f - .5);

  // Softness rides the ribbon's own width, so a thin ribbon gets a
  // proportionally soft edge rather than being swallowed by a fixed one.
  float sideSoft = max(mix(.002, .5, u_softness) * halfBand, 1e-4);
  float inBand =
    1. - smoothstep(halfBand - sideSoft, halfBand + sideSoft, offCentre);

  // How far along the track the set has travelled. Time and u_phase are the
  // SAME axis — animating is just Angle moving on its own, which is what makes
  // a moving shader and a dragged slider agree — so they add.
  //
  // It OSCILLATES rather than drifting: the set runs out along the track and
  // returns by the same path, mirroring the reference's slider being dragged
  // forward and back. A one-way ramp would carry the bands off once and never
  // bring them home.
  //
  // WHICH curve it swings on is u_easing's, and the sine this used to be flat
  // is only one end of that range — see below. All of this is a function of TIME
  // alone, so it is one value across the whole frame: constant per draw, no
  // divergence, and the compiler is welcome to it.
  float clock = u_time * DRIFT_RATE;
  float swung = sin(clock);

  // The LINEAR swing — a triangle wave, and the same one the sine is a shaped
  // version of. asin(sin(clock)) IS that triangle — it unfolds to clock on the
  // first quarter cycle and reflects on every one after — which is what makes it
  // exactly in step with the sine rather than merely the same period. Built
  // this way rather than from fract(clock / TWO_PI) because clock grows without
  // bound and this shader is mediump: a fract of a large number is noise
  // within minutes, while sin/cos hand back bounded values that stay exact.
  float linear = asin(swung) / HALF_PI;

  // Where in the cycle we are, rebuilt from the triangle plus which way it is
  // going. Needed only by the skew, and only because a triangle alone cannot
  // tell the outward stroke from the return — both read the same going up as
  // coming down. The fract here is of a quarter-turn at most, so it costs
  // nothing in precision.
  float rising = step(0., cos(clock));
  float cycle = mix(.5 - linear * .25, fract(linear * .25), rising);

  // SKEW — where the speed sits within a SWEEP: pushing off one end of the
  // travel fast and gliding into the other, or the reverse.
  //
  // Per sweep, and that is the whole point. A single warp laid over the cycle
  // is the obvious way to lean an oscillation, and it is wrong here: a sine of
  // the cycle takes the opposite sign on the second half, so the set would
  // hurry one way across the track and dawdle back. The lean has to INVERT with
  // the direction of travel to read as one gesture — push off, glide in, every
  // time — rather than as a fast pass followed by a slow one.
  //
  // So the cycle is cut at the two extremes into the sweeps it is actually made
  // of, and the same profile is applied inside each. They keep half the cycle
  // apiece; only the distribution of speed within them moves.
  //
  // A sine again, for the reason it was one before: the rate is 1 + skew*cos,
  // which bends the timing continuously instead of hinging it, so the set never
  // changes speed on the spot mid-sweep. It integrates to exactly 1 over the
  // sweep, which is what pins the extremes where they are — the control cannot
  // move them, only decide how the time between them is spent.
  //
  // Kept under 1 so the rate never reaches zero: at 1 the set would stall dead
  // at one end, and past it that stretch would run backwards — a stutter, not a
  // stronger lean.
  // TWICE, which is what makes the control worth reaching for. One pass carries
  // 31% of a sweep's travel into its first quarter at full bias; two carry 65%,
  // against 15% at rest. Rates compose by multiplying, so a second pass doubles
  // the lean.
  //
  // Composing rather than deepening, and that is forced: the rate is
  // 1 + bias*BIAS_DEPTH*cos, so a depth of 1 would stall the set dead at one end
  // and anything past it would run that stretch backwards. There is no room
  // left in the constant. There is room in the composition, which cannot stall
  // — a product of positive rates is positive — and which keeps both of
  // leanSweep's guarantees, since each pass already has them.
  float sweep = (cycle - .25) * 2.;
  float along = fract(sweep);

  // INTERVAL — a rest at each end of the travel, before the set starts back.
  //
  // Measured in SWEEP LENGTHS, so 1 rests for as long as the crossing takes. A
  // half-cycle is then rest + sweep = (1 + interval) sweeps, and the rest is
  // interval / (1 + interval) of it.
  //
  // It sits at the START of a half-cycle, which is the instant the set arrives:
  // the sweeps are cut at the extremes, so along = 0 IS the turnaround. Clamped
  // below at 0 rather than allowed to run negative, since the shader divides by
  // what is left over.
  //
  // The period does not change — the rest is taken OUT of the half-cycle rather
  // than added to it, so the swing keeps the cadence Speed sets and the crossing
  // simply gets brisker as the rest grows. Adding to it instead would have this
  // control quietly slowing the whole animation, which is Speed's to do.
  //
  // What it buys is the recoil going away, and it is the ONLY thing that can.
  // A leaning sweep arrives at a different speed from the one the next leaves
  // at — see leanSweep, where that is shown to be unavoidable in any rate that
  // falls the whole way across the sweep. With the two strokes adjacent the eye
  // compares them and calls it a bounce. A rest between them is not a smaller
  // asymmetry; it is nothing left to compare.
  float rest = u_interval / (1. + u_interval);
  float held = clamp((along - rest) / max(1. - rest, 1e-4), 0., 1.);

  float eased = leanSweep(leanSweep(held));

  // Which end this sweep is leaving. They alternate, and this is what carries
  // the profile across the turnaround unflipped: the sweep back is the sweep
  // out, mirrored, so it leans the same way relative to where it is going.
  float leaving = mod(floor(sweep), 2.) < .5 ? 1. : -1.;

  // The triangle, walked sweep by sweep. At skew 0 this lands back on linear.
  float retimed = leaving * (1. - 2. * eased);

  // EASING — how the turnarounds are shaped, signed about a LINEAR swing.
  //
  // 0 is that linear swing: constant speed, reversing on the spot. Toward 1 the
  // set decelerates into each end and accelerates out of it, reaching the sine
  // this shader animated on before the control existed — which is why 1 is the
  // default rather than the neutral 0. Toward -1 it does the opposite, hurrying
  // into the turnaround and lingering mid-travel.
  //
  // One mix does both signs, because the negative half IS the positive half
  // reflected through the linear swing: mix(x, s, -1) is 2x - s, the curve as
  // far below the straight line as the sine is above it. Nothing to branch on,
  // and no second curve to keep in step with the first.
  //
  // That reflection stays monotone, which is the thing to check before trusting
  // it: its slope is 2 - (PI/2)cos, never less than about 0.43, so the swing
  // always advances. The obvious alternative — inverting the sine with asin —
  // does not: its slope runs to infinity at the turnaround, so ANY negative
  // value would snap rather than the range easing into it.
  float shaped = sin(retimed * HALF_PI);
  float swing = mix(retimed, shaped, u_easing);

  float phase = u_phase + swing * u_travel;

  // Position within THIS band's own gradient: 0 where it starts, 1 where it
  // ends. u_stagger is the gap between one band and the next, which is what
  // turns their leading edges into a staircase instead of one straight front;
  // u_symmetry below decides which band that staircase is measured from.
  //
  // The gradient is fixed relative to its OWN band — it travels with the band
  // rather than staying put in the frame, which is why the colours never smear
  // as the set moves.
  // Centred on the MIDDLE band, and on the gradient's own midpoint, so that at
  // phase 0 with no stagger the whole set sits in the middle of the frame. Left
  // uncentred, band 0 starts at the origin and every other band marches off the
  // right edge, which reads as "the shader is broken" rather than "the set is
  // parked somewhere else".
  float centred = index - (bands - 1.) * .5;

  // SYMMETRY — which band the staircase is measured FROM.
  //
  // The signed index above runs straight down the stack, so the first band
  // leads, the last trails, and the staircase grows from an EDGE. Mirroring it
  // about the middle band instead makes the offset a function of DISTANCE from
  // the centre: the first and last bands then sit at the same offset (no
  // stagger between them at all), the second and second-last at the same
  // offset, and the staircase grows from the CENTRE outward.
  //
  // The 2x and the recentring are what make the two ends comparable rather than
  // merely different. abs() alone halves the spread — |centred| only reaches
  // (bands-1)/2, where the signed index covers twice that — so a mirrored set
  // would quietly bunch up to half the staircase at the same u_stagger.
  // Doubling restores the span and subtracting (bands-1)/2 recentres it, so both
  // arrangements occupy exactly the same total extent and this control changes
  // the ORDER of the bands, never the size of a step.
  //
  // Consequently the leader simply migrates: at 1 the offset floor belongs to
  // band 0, at 0 to the middle band, and every value between walks it inward.
  //
  // NEGATIVE carries the same walk on past the middle. Read what the control
  // actually does and the extension writes itself: it moves the LEADER, the
  // band whose offset is lowest and which therefore runs ahead of the rest. At
  // 1 that is the first band, at 0 the middle one — so at -1 it should be the
  // last, and the stack runs the other way down. sign() picks which end the
  // linear arrangement points at and abs() how far toward it the blend has got,
  // which keeps 0 the same V from both sides.
  //
  // Note the ARRANGEMENT is what this reaches, not a magnitude: at -1 exactly,
  // the offsets are the mirror of those at +1, which is also what negating
  // u_stagger would give. It is the values in BETWEEN that are the point — a
  // half-mirrored stack is not a scaled anything, and there is no other control
  // that reaches it.
  float fromCentre = 2. * abs(centred) - (bands - 1.) * .5;
  float symmetry = clamp(u_symmetry, -1., 1.);
  float offset = mix(fromCentre, centred * sign(symmetry), abs(symmetry));

  // ALONG THE TRACK, not along the frame.
  //
  // The ribbons are rays from the fan's origin, so distance along one is the
  // RADIAL distance — which makes every colour boundary an arc perpendicular to
  // its ribbon, and the gradient therefore parallel to the ribbon's direction
  // wherever it points. Measuring by uv.x instead lays the boundaries down as
  // vertical lines in the frame, which reads as a horizontal gradient painted
  // across a fan that is running some other way.
  //
  // SIGNED, and continuous — which is what lets a band cross the apex instead of
  // being born and dying there.
  //
  // The obvious unsigned reading, length(vec2(q, y)), is a RADIUS: it cannot go
  // below zero, so the lit set is not a segment travelling along the track but
  // an ANNULUS about the apex, expanding and contracting. Wind the phase back
  // past the apex and the ring collapses into it and vanishes, then re-expands
  // on both lobes at once. There is no far side of the apex for the phase to
  // reach, because there is no negative radius.
  //
  // The equally obvious fix, sign(q) * length(vec2(q, y)), is the one this
  // shader used to reject, and rightly: it JUMPS by 2|y| as q crosses zero,
  // because the apex is a point but the line q = 0 is a whole cross-section of
  // the track, and every off-axis point on it sits at a radius of |y|. A hard
  // seam straight down the middle, with the two sides out of step.
  //
  // This form has neither problem. Expand the radius on the fan and it comes
  // apart into exactly two pieces:
  //
  //   rho^2 = q^2 + y^2 = q^2 (1 + t^2) + t^2 * roundness^2
  //
  // The first term is a perfect square and carries all of q's sign; the second
  // is the THROAT, and it is the only reason the radius cannot reach zero off
  // the axis. Dropping it leaves q * sqrt(1 + t^2), which is signed by q, is
  // exactly zero along the whole of q = 0 (so there is nothing left to jump
  // across), and far from the apex converges on the radius it replaces — t is
  // bounded by the silhouette, so the factor never leaves [1, sqrt(2)].
  //
  // Read as a wavefront: the colour boundaries pass through the throat as a
  // straight cross-section and open into circular arcs as they run out, which
  // is what the boundary of an expanding front on this surface should look like.
  //
  // t is clamped to the silhouette for this one purpose. Nothing outside |t| > 1
  // is drawn, so it changes no visible value — but at roundness 0 the raw t runs
  // away near the apex, and t * t would overflow mediump into an inf that 0 * inf
  // turns into a NaN across the whole band.
  float tSpan = clamp(t, -1., 1.);
  float alongTrack = q * sqrt(1. + tSpan * tSpan);

  // Measured from the FRAME's centre, not the apex: alongTrack counts from the
  // apex, so without subtracting u_apex the whole set would ride away from the
  // viewport as the apex is pushed out, and Angle would have to be dialled back
  // in by hand to compensate.
  //
  // Which also fixes what Angle MEANS, now that the coordinate is signed: 0
  // parks the set at the frame's centre, -u_apex puts it exactly on the apex,
  // and anything past that carries it through onto the far lobe. So Angle is
  // the phase of the run end to end, and Travel swinging either side of it
  // sweeps a band through the apex and back rather than pulsing out of it.
  float s =
    (alongTrack - u_apex - phase - offset * u_stagger) / u_rampLength + .5;

  // ONE gradient per band, NOT a repeating pattern.
  //
  // A periodic ramp (fract/triangle) tiles the palette endlessly down the track
  // and reads as a texture painted over the fan. The reference has a single
  // finite gradient per band with GROUND either side of it, which is what lets
  // the bands read as objects sliding along a track — and what gives them a
  // leading and trailing edge to stagger in the first place.
  // u_tail is how far each band's gradient fades out at its ENDS, along the
  // track — and nothing else. It is applied here and ONLY here: an earlier
  // version also fed it into the silhouette below, which meant turning it up
  // dissolved the outermost bands as a side effect, when all that was wanted
  // was a longer fade on the ends. Runs to nearly the full span, so a high
  // value can fade a band out over most of its own length.
  float tailSoft = mix(.002, .95, u_tail);
  float onTrack =
    smoothstep(0., tailSoft, s) * smoothstep(0., tailSoft, 1. - s);

  // The gradient is a PALINDROME across its own span: first colour and last are
  // the same, second and second-to-last are the same, and so on. So the span
  // runs out to the far colour at its midpoint and back again — 0 → 1 → 0 —
  // rather than sweeping the palette once end to end.
  //
  // Note this is bounded by the span, unlike a fract-based one that would tile
  // the palette endlessly down the track.
  //
  // HELD at the top rather than turned around on the spot, and that is the fix
  // for the colour the whole ramp is built to arrive at. Folding the palette
  // puts every colour on the span TWICE — once climbing, once coming back —
  // except the last, which a bare triangle touches for an instant and leaves.
  // So the last colour got half the width of every other one while the
  // second-to-last sat on both sides of it, and the arrival read as a seam in
  // the second-to-last rather than as a colour of its own.
  //
  // Holding the peak for one segment is the reflected stop list with the middle
  // colour DOUBLED instead of shared, which gives it the same width as its
  // neighbours. The width falls straight out of that reading: doubling the
  // middle stop makes 2 * count stops, so 2 * count - 1 segments across the
  // span, and the plateau is exactly one of them. Halved here because it is
  // measured from the midpoint outward.
  float stops = max(u_colorsCount, 1.);
  float hold = .5 / max(2. * stops - 1., 1.);
  float fromMid = abs(clamp(s, 0., 1.) - .5);
  float mirrored = 1. - max(fromMid - hold, 0.) / max(.5 - hold, 1e-4);

  vec4 ramp = rampAt(mirrored);

  // A ribbon is present only where it is BOTH inside the fan's silhouette
  // (|t| < 1) and within its own gradient's span. Everywhere else is ground.
  //
  // The silhouette's softness is a fixed hairline — enough to anti-alias the
  // outer boundary and no more. It is deliberately NOT driven by u_tail: the
  // first and last bands live against this edge, so any user-facing softness
  // here reads as those two bands fading away, which is a different effect from
  // the one the control is for.
  float inside = (1. - smoothstep(.99, 1., abs(t))) * onTrack * inStack * inBand;

  // EDGE HIGHLIGHT — the RAILS of each track, traced as light.
  //
  // The point of it is that it reads PAST the fill. u_softness dissolves a
  // ribbon's two sides into the ground and u_tail dissolves its ends, so at
  // rest most of the set is a wash with no visible extent; the hairline follows
  // the GEOMETRY instead of the coverage, so the whole fan reads as the lines
  // the ribbons run along — including the ones that have faded out of the
  // picture entirely.
  //
  // ONLY the two sides, and that is the whole shape of the effect. The
  // along-track ends (s = 0 and s = 1) are edges too, and stroking them as well
  // closes every ribbon into a box — which says "here is a tile" rather than
  // "here is a track". Leaving them open lets each pair of rails run the full
  // length of the fan and off the frame, so the track goes on endlessly and the
  // gradient is simply what happens to be lit along a stretch of it.
  //
  // So the distance is to the slot's own fill, which runs to halfBand either
  // side of its centre — the same quantity the fill is cut from, read here as
  // an edge rather than as a mask.
  //
  // Converted from slot fractions into PIXELS by dividing by how far it moves
  // per pixel, which is exactly what fwidth() measures. That conversion is the
  // whole reason the line survives: u_tilt and u_depth crush the far end of the
  // track, and a width measured in track units would thin away precisely where
  // the structure is hardest to read.
  //
  // The rate is taken from stack, which is SMOOTH, never from the offCentre
  // built on it — that folds at every slot boundary, and fwidth() across a fold
  // reads the two sides as equal and reports a rate of nothing to do with the
  // local geometry, which would punch dropouts into the line at exactly the
  // places two ribbons meet.
  //
  // Computed unconditionally, above the branch that uses it. u_edges is a
  // uniform, so branching on it is uniform control flow and a derivative inside
  // would in fact be defined — but an fwidth costs nothing, and keeping it out
  // of a branch is one less rule to be right about.
  float acrossRate = max(fwidth(stack) * bands, 1e-5);

  // Distance to the nearest RAIL, unsigned — so the stroke STRADDLES the rail
  // instead of sitting inside the ribbon.
  //
  // Straddling is what makes coincident rails behave, and it is the whole
  // reason this is an abs(). An inner stroke treats a rail as the outer
  // boundary of a shape and antialiases against the ground beyond it — but at
  // spread 0 there is no ground beyond it, only the next ribbon. Both sides
  // then faded out against a neighbour that was never there, and two edges that
  // are the SAME edge arrived as two lines with a dark seam between them.
  // Measured from the rail, they coincide exactly and the seam cannot exist.
  //
  // It settles the other end of the same control too: near spread 1 the ribbon
  // is thinner than the stroke, so its two rails simply overlap into one line,
  // where an inner stroke had nowhere to go and thinned away to nothing.
  float railPx = abs(offCentre - halfBand) / acrossRate;

  float stroke = max(u_edgeWidth, 0.) * max(u_pixelRatio, 1.);
  float halfStroke = stroke * .5;

  // The stack's own outer boundary — the one thing a straddling stroke still
  // has to be told, because offCentre is PINNED at .5 outside the stack (the
  // clamp in scaled above). At spread 0 halfBand is .5 as well, so every
  // fragment out there would read as sitting exactly on a rail and the whole
  // ground would light up.
  //
  // Same derivative as acrossRate, in stack units rather than slot units, so it
  // costs no second fwidth. The half-stroke of slack is deliberate: it lets the
  // outermost rail hang its outer half over the edge of the stack, exactly as
  // every rail inside the stack does.
  float intoStack = min(stack, 1. - stack) * bands / acrossRate;

  // The last factor is what lets 0 mean OFF, and it is not a special case: a
  // line thinner than a pixel cannot be drawn thinner, only fainter, so its
  // coverage falls with its width. That carries all the way down to nothing at
  // zero, where the smoothstep alone would still have left half a pixel lit.
  float edge = (1. - smoothstep(halfStroke - .5, halfStroke + .5, railPx)) *
    clamp(intoStack + halfStroke + .5, 0., 1.) *
    clamp(stroke, 0., 1.);

  // The rail's own TAIL — the band's fade, carried onto the lines that flank it.
  //
  // Without this the rails are pure geometry, and pure geometry does not move:
  // the set slides along the track while the lines sit still across the frame at
  // one flat brightness, which reads as a grid ruled over the graphic rather
  // than as part of it. Fading them along the track ties each rail to the band
  // it belongs to, so a run leaving the frame takes its rails with it.
  //
  // The SAME expression as onTrack above, with one number changed — and that is
  // the whole of it. Both fades begin at exactly the same place (tailSoft in
  // from each end); only where they finish differs, the fill at the end of the
  // span and the rail railReach past it.
  //
  // Starting them together is the part that matters. An earlier version held
  // the rail at full strength across all of s and began its fade only once s
  // was past the span — so through the fill's entire fade-out a fully lit rail
  // lay over a dissolving band, and the rail's own fade began after the fill
  // had already gone. Two separate events, with a seam between them, which
  // reads as the tail sitting on top of the edge rather than the two being one
  // thing going out together.
  //
  // The rail still outlives its fill, which is the point of the highlight: it
  // is only part-way down where the fill reaches zero, and carries on from
  // there. It just gets there continuously.
  //
  // Deliberately NOT a cap: the fade runs ALONG the rail, so nothing is ever
  // drawn across the end. The track still reads as continuing; it just stops
  // being lit, which is the difference between a tail and a box.
  //
  // Per band, since s carries that band's own stagger offset — so the rails
  // fade in the same staircase the bands arrive in.
  // Per band, since s carries that band's own stagger offset — so the rails
  // fade in the same staircase the bands arrive in.
  float railReach = max(u_edgeTail, 0.);
  float railTail =
    smoothstep(-railReach, tailSoft, s) * smoothstep(-railReach, tailSoft, 1. - s);

  // The rail's own COVERAGE, kept apart from the fill's rather than folded into
  // it — because an overlay that fades, in a colour of its own, cannot be a
  // mix() toward the colour underneath.
  //
  // That was the mistake here. mix(ramp.rgb, u_colorEdge.rgb, lit) is right for
  // the stroke's antialiased SIDES, where the line genuinely blends into what
  // it sits on. It is wrong along the TAIL, where the line should keep its
  // colour and only get fainter: fading the mix slid the rail back toward the
  // band's own ramp, so an edge set to green tailed off through the band's
  // pinks and creams and arrived somewhere else entirely. The edge colour and
  // the edge tail were then two different colours, which is exactly what a
  // crossfade is for and exactly what this is not.
  //
  // Composited OVER at the end instead. The rail is u_colorEdge at every point
  // along its length and only its opacity moves — and the colour's own alpha is
  // the highlight's strength, which is why there is no second control for it.
  float railAlpha = edge * railTail * u_colorEdge.a;

  // Dither the RIBBON only, before it ever meets the ground.
  //
  // Applied pre-composite on purpose: the ground is a flat fill with nothing to
  // dither, and quantising it would only stipple an otherwise clean colour.
  //
  // Ordered dithering is QUANTISATION, not addition: values are snapped to a
  // coarse set of levels and the Bayer matrix decides which way each one rounds.
  // That trade — fewer levels, arranged in a pattern — is what draws the
  // crosshatch. Simply ADDING the matrix would only nudge the value, which is
  // what the earlier noise version did and why it was invisible.
  //
  // The matrix is read in DEVICE pixels (gl_FragCoord), so the grid is fixed to
  // the screen rather than scaling and rotating with the graphic.
  // Two dithers, INDEPENDENT of one another, sharing one matrix.
  //
  // Independent because a rail is a hairline and a ribbon is not: the threshold
  // that makes a wide band read as being MADE of dither pixels does not stipple
  // a two-pixel line, it cuts it into dashes and then into nothing. Either can
  // be on with the other off, so the guard asks whether EITHER is doing
  // something rather than gating the rails behind the ribbons' control.
  //
  // The same matrix on purpose, though. Two Bayer reads at different cell sizes
  // would beat against each other where a rail crosses its own ribbon; one read
  // means the rails' dots land in the ribbons' grid.
  // Two halves of one control. Up to 1 it is how much of the threshold to take,
  // exactly like u_rampDither; past 1 it opens the pattern into the core (see
  // EDGE_DITHER_OPEN), which is the only place further dither can come from.
  float edgeAmount = max(u_edgeDither, 0.);
  float edgeDither = min(edgeAmount, 1.);
  float edgeDuty = 1. - EDGE_DITHER_OPEN * clamp(edgeAmount - 1., 0., 1.);
  if (u_rampDither > 0. || edgeDither > 0.) {
    float bayer = bayer8(gl_FragCoord.xy / max(u_ditherSize, 1.));

    if (u_rampDither > 0.) {
      // Colour: snap each channel to a few levels. The RAILS are not quantised
      // with it — they are one flat colour already, and there is nothing in a
      // single colour for a level count to find.
      float threshold = bayer - .5;
      float levels = max(mix(DITHER_MAX_LEVELS, DITHER_MIN_LEVELS, u_rampDither), 2.);
      ramp.rgb = clamp(floor(ramp.rgb * levels + threshold + .5) / levels, 0., 1.);
    }

    // COVERAGE, against the same matrix — and this is what actually makes the
    // image read as being MADE OF dither pixels rather than merely carrying a
    // pattern.
    //
    // Quantising colour alone is not enough: the ribbon is then multiplied by a
    // SMOOTH mask (the tail fade, the soft stack and band edges), and that
    // smooth alpha puts continuous tone straight back over most of the ribbon,
    // leaving the pattern visible only where coverage happens to land on 1.
    // Thresholding the coverage turns every one of those fades into stipple, so
    // there is no continuous tone left anywhere in the foreground — the band's
    // own tail along the track included.
    //
    // The threshold is nudged off both ends rather than used raw. The matrix's
    // lowest cell is exactly 0, and step(0., 0.) is 1 — so a raw threshold turns
    // ZERO coverage into full coverage on those cells and sprinkles lit pixels
    // across the ground, which reads as the background having been dithered too.
    // Offsetting to (i + 0.5) / 64 keeps "no coverage" meaning no coverage.
    float coverThreshold = mix(1. / 128., 1. - 1. / 128., bayer);

    // Mixed in by each control so both still travel: at low values the soft
    // mask survives and the edges stay smooth; at the top it is fully binary.
    // Neither term reads the other's control, which is what makes them
    // independent — mix by 0 is the identity, so a value of 0 on either side
    // leaves that half of the graphic exactly as it was.
    inside = mix(inside, step(coverThreshold, inside), u_rampDither);
    railAlpha =
      mix(railAlpha, step(coverThreshold, railAlpha * edgeDuty), edgeDither);
  }

  // Premultiplied compositing of fan over ground — see the note above.
  vec3 color = ramp.rgb * ramp.a * inside;
  float opacity = ramp.a * inside;
  color += (1. - opacity) * u_colorBack.rgb * u_colorBack.a;
  opacity += (1. - opacity) * u_colorBack.a;

  // The rails last, over both. They are drawn ON the graphic rather than in it,
  // and a rail that has run out past its band belongs over the ground just as
  // readily as over a ribbon — so it composites against whatever ended up here.
  color = u_colorEdge.rgb * railAlpha + color * (1. - railAlpha);
  opacity = railAlpha + opacity * (1. - railAlpha);

  fragColor = vec4(color, opacity);
}`;
