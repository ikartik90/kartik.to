import { COSMIC_TRACK_MAX_COLORS } from "./cosmic-track-uniforms";

// ---------------------------------------------------------------------------
// CosmicTrack — a fan of creased ribbons radiating from a point, over a flat ground.
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
// converging on a point, and everything else — the crease, the ramp, the
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

uniform float u_angle;
uniform float u_travel;
uniform float u_stagger;
uniform float u_spread;
uniform float u_bandwidth;
uniform float u_roundness;
uniform float u_apex;
uniform float u_rampLength;
uniform float u_bandCount;
uniform float u_curve;
uniform float u_tilt;
uniform float u_fold;
uniform float u_softness;
uniform float u_tail;
uniform float u_dither;
uniform float u_ditherSize;

uniform float u_time;

in vec2 v_objectUV;
out vec4 fragColor;

// Radians per second of the swing at speed 1. Slow, because this is a ground:
// the set should breathe along the track, not march.
#define DRIFT_RATE 0.35

// Quantisation levels per channel at the two ends of the dither control.
//
// The top end is deliberately coarse: with only a handful of levels the Bayer
// pattern is unmistakable, which is the look being asked for. The bottom end
// stays fine enough to read as a smooth gradient that merely happens to be
// dithered — so the slider travels from "clean" to "openly patterned" and every
// part of it changes something visible.
#define DITHER_MAX_LEVELS 48.0
#define DITHER_MIN_LEVELS 3.0

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
  float w = max(1. + u_tilt * uv.y, 1e-2);
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

  // The gradient's WIDTH: how much of the fan the stack of ribbons occupies,
  // measured outward from the centre line.
  //
  // This COMPRESSES the whole stack rather than shrinking each ribbon inside a
  // fixed slot. The ribbons stay stuck together — every one narrows as the
  // stack narrows, and they remain edge to edge with no ground opening up
  // between them. A per-slot fill fraction would separate them instead, which
  // is a different effect entirely.
  //
  // Independent of u_bandCount, which sets how many ribbons share the width.
  float stack = (across - .5) / max(u_bandwidth, 1e-4) + .5;

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

  // The GAP between adjacent ribbons.
  //
  // Each ribbon fills only part of its slot, centred, and the remainder is
  // ground — so raising u_spread pulls the ribbons apart without moving them
  // off their own tracks. At 0 they touch and the set reads as one sheet.
  //
  // Note this is applied AFTER the floor() that creates slots, which is what
  // separates the ribbons; u_bandwidth is applied BEFORE it, which is what
  // keeps them contiguous while narrowing. Same shape of arithmetic, opposite
  // effect, and the ordering is the whole difference.
  float fill = clamp(1. - u_spread, 0., 1.);
  float halfBand = fill * .5;
  float offCentre = abs(f - .5);

  // Softness rides the ribbon's own width, so a thin ribbon gets a
  // proportionally soft edge rather than being swallowed by a fixed one.
  float sideSoft = max(mix(.002, .5, u_softness) * halfBand, 1e-4);
  float inBand =
    1. - smoothstep(halfBand - sideSoft, halfBand + sideSoft, offCentre);

  // The folded-paper crease: darken toward each ribbon's long edges so it reads
  // as a curved surface rather than a flat strip.
  float acrossBand = clamp(offCentre / max(halfBand, 1e-4), 0., 1.);
  float shade = mix(1., 1. - u_fold, acrossBand);

  // How far along the track the set has travelled. Time and u_angle are the
  // SAME axis — animating is just Angle moving on its own, which is what makes
  // a moving shader and a dragged slider agree — so they add.
  //
  // It OSCILLATES rather than drifting: the set runs out along the track and
  // returns by the same path, mirroring the reference's slider being dragged
  // forward and back. A one-way ramp would carry the bands off once and never
  // bring them home. A sine rather than a triangle, so the turnarounds ease
  // instead of snapping direction.
  float phase = u_angle + sin(u_time * DRIFT_RATE) * u_travel;

  // Position within THIS band's own gradient: 0 where it starts, 1 where it
  // ends. u_stagger is the gap between one band and the next, which is what
  // turns their leading edges into a staircase instead of one straight front.
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

  // ALONG THE TRACK, not along the frame.
  //
  // The ribbons are rays from the fan's origin, so distance along one is the
  // RADIAL distance — which makes every colour boundary an arc perpendicular to
  // its ribbon, and the gradient therefore parallel to the ribbon's direction
  // wherever it points. Measuring by uv.x instead lays the boundaries down as
  // vertical lines in the frame, which reads as a horizontal gradient painted
  // across a fan that is running some other way.
  //
  // UNSIGNED, and that is the whole fix for the centre seam. An earlier version
  // signed this by sign(uv.x), which jumps by 2|y| as x crosses zero — a hard
  // discontinuity straight down the middle, with the two sides out of step
  // either side of it. Distance from the apex has no such flip, and with the
  // apex outside the frame (see u_apex) it is monotonic across everything
  // visible, so the track reads as one continuous run rather than two.
  float alongTrack = length(vec2(q, y));

  // Measured from the FRAME's centre, not the apex: alongTrack counts outward
  // from the apex, so without subtracting u_apex the whole set would ride away
  // from the viewport as the apex is pushed out, and Angle would have to be
  // dialled back in by hand to compensate.
  float s =
    (alongTrack - u_apex - phase - centred * u_stagger) / u_rampLength + .5;

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
  // Note this triangle is bounded by the span, unlike a fract-based one that
  // would tile the palette endlessly down the track.
  float mirrored = 1. - abs(2. * clamp(s, 0., 1.) - 1.);

  vec4 ramp = rampAt(mirrored);
  ramp.rgb *= mix(1. - u_fold, 1., shade);

  // A ribbon is present only where it is BOTH inside the fan's silhouette
  // (|t| < 1) and within its own gradient's span. Everywhere else is ground.
  //
  // The silhouette's softness is a fixed hairline — enough to anti-alias the
  // outer boundary and no more. It is deliberately NOT driven by u_tail: the
  // first and last bands live against this edge, so any user-facing softness
  // here reads as those two bands fading away, which is a different effect from
  // the one the control is for.
  float inside = (1. - smoothstep(.99, 1., abs(t))) * onTrack * inStack * inBand;

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
  if (u_dither > 0.) {
    float bayer = bayer8(gl_FragCoord.xy / max(u_ditherSize, 1.));
    float threshold = bayer - .5;

    // Colour: snap each channel to a few levels.
    float levels = max(mix(DITHER_MAX_LEVELS, DITHER_MIN_LEVELS, u_dither), 2.);
    ramp.rgb = clamp(floor(ramp.rgb * levels + threshold + .5) / levels, 0., 1.);

    // COVERAGE, against the same matrix — and this is what actually makes the
    // image read as being MADE OF dither pixels rather than merely carrying a
    // pattern.
    //
    // Quantising colour alone is not enough: the ribbon is then multiplied by a
    // SMOOTH mask (the tail fade, the soft stack and band edges), and that
    // smooth alpha puts continuous tone straight back over most of the ribbon,
    // leaving the pattern visible only where coverage happens to land on 1.
    // Thresholding the coverage turns every one of those fades into stipple, so
    // there is no continuous tone left anywhere in the foreground.
    //
    // The threshold is nudged off both ends rather than used raw. The matrix's
    // lowest cell is exactly 0, and step(0., 0.) is 1 — so a raw threshold turns
    // ZERO coverage into full coverage on those cells and sprinkles lit pixels
    // across the ground, which reads as the background having been dithered too.
    // Offsetting to (i + 0.5) / 64 keeps "no coverage" meaning no coverage.
    float coverThreshold = mix(1. / 128., 1. - 1. / 128., bayer);

    // Mixed in by u_dither so the control still travels: at low values the soft
    // mask survives and the edges stay smooth; at the top it is fully binary.
    inside = mix(inside, step(coverThreshold, inside), u_dither);
  }

  // Premultiplied compositing of fan over ground — see the note above.
  vec3 color = ramp.rgb * ramp.a * inside;
  float opacity = ramp.a * inside;
  color += (1. - opacity) * u_colorBack.rgb * u_colorBack.a;
  opacity += (1. - opacity) * u_colorBack.a;

  fragColor = vec4(color, opacity);
}`;
