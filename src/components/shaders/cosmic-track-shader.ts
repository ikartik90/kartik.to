import { COSMIC_TRACK_MAX_COLORS } from "./cosmic-track-uniforms";

export const cosmicTrackMeta = {
  maxColorCount: COSMIC_TRACK_MAX_COLORS,
} as const;

// Output must stay premultiplied so a transparent colorBack composites over another shader.
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
// Device pixels per CSS pixel; keeps the edge hairline's on-screen width fixed.
uniform float u_pixelRatio;

in vec2 v_objectUV;
out vec4 fragColor;

// Radians per second of the swing at speed 1.
#define DRIFT_RATE 0.35

#define HALF_PI 1.5707963
#define PI 3.1415927

// Must stay under 1: at 1 the sweep stalls at one end, past it that stretch runs backwards.
#define BIAS_DEPTH 0.8

#define DITHER_MAX_LEVELS 48.0
#define DITHER_MIN_LEVELS 3.0

// Core duty at the top of u_edgeDither: past 1 the control thins the rail's solid core.
#define EDGE_DITHER_OPEN 0.5

#define DEPTH_POWER 3.0

float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x * .5 + a.y * a.y * .75);
}

#define bayer4(a) (bayer2(.5 * (a)) * .25 + bayer2(a))
#define bayer8(a) (bayer4(.5 * (a)) * .25 + bayer2(a))

// Re-times a sweep's progress without moving its ends; must stay monotone.
float leanSweep(float along) {
  return along + u_easingBias * BIAS_DEPTH * sin(PI * along) / PI;
}

// u_colorsCount is the real count; the array tail is padding.
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

  // Tilt and depth as one perspective divide. sqrt(run² + 1), not |run|: a zero run at an
  // in-frame apex would drive w to its floor and blank the frame.
  float run = uv.x + u_apex;
  float reach = sqrt(run * run + 1.) / sqrt(u_apex * u_apex + 1.);
  float w = max((1. + u_tilt * uv.y) * pow(reach, u_depth * DEPTH_POWER), 1e-2);
  uv /= w;

  // Track geometry stays time-free; time only moves the bands along it.
  float bow = u_curve * uv.x * uv.x;
  float y = uv.y - bow;

  // sqrt(q² + r²), not |q|: |q| has a corner that draws a hard V at the apex.
  float q = uv.x + u_apex;

  float halfWidth = max(sqrt(q * q + u_roundness * u_roundness), 1e-4);

  // Across the fan: 0 on the axis, ±1 at the silhouette.
  float t = y / halfWidth;
  float across = clamp(t * .5 + .5, 0., 1.);

  // Gaps come from widening the stack by period while fill narrows by it, so ribbons keep their width.
  float period = 1. + max(u_spread, 0.);
  float spreadWidth = u_bandwidth * period;

  float stack = (across - .5) / max(spreadWidth, 1e-4) + .5;

  float stackSoft = mix(.002, .2, u_softness);
  float inStack =
    smoothstep(0., stackSoft, stack) * smoothstep(0., stackSoft, 1. - stack);

  float bands = max(u_bandCount, 1.);
  float scaled = clamp(stack, 0., 1.) * bands;
  float index = floor(scaled);
  float f = scaled - index;

  // A reciprocal, not 1 - u_spread, so it cancels the stack's widening exactly.
  float fill = 1. / period;
  float halfBand = fill * .5;
  float offCentre = abs(f - .5);

  float sideSoft = max(mix(.002, .5, u_softness) * halfBand, 1e-4);
  float inBand =
    1. - smoothstep(halfBand - sideSoft, halfBand + sideSoft, offCentre);

  float clock = u_time * DRIFT_RATE;
  float swung = sin(clock);

  // Triangle wave via asin(sin()), not fract(): clock is unbounded and a mediump fract degrades.
  float linear = asin(swung) / HALF_PI;

  float rising = step(0., cos(clock));
  float cycle = mix(.5 - linear * .25, fract(linear * .25), rising);

  // Bias is applied per sweep so the lean inverts with direction; two passes double it without stalling.
  float sweep = (cycle - .25) * 2.;
  float along = fract(sweep);

  // A rest at each turnaround, in sweep lengths, taken out of the half-cycle so the period is unchanged.
  float rest = u_interval / (1. + u_interval);
  float held = clamp((along - rest) / max(1. - rest, 1e-4), 0., 1.);

  float eased = leanSweep(leanSweep(held));

  float leaving = mod(floor(sweep), 2.) < .5 ? 1. : -1.;

  float retimed = leaving * (1. - 2. * eased);

  // Easing: 0 linear, 1 sine, -1 the sine reflected through linear (still monotone, unlike asin).
  float shaped = sin(retimed * HALF_PI);
  float swing = mix(retimed, shaped, u_easing);

  float phase = u_phase + swing * u_travel;

  float centred = index - (bands - 1.) * .5;

  // Symmetry: 1 staggers from the first band, 0 from the centre out, -1 from the last.
  float fromCentre = 2. * abs(centred) - (bands - 1.) * .5;
  float symmetry = clamp(u_symmetry, -1., 1.);
  float offset = mix(fromCentre, centred * sign(symmetry), abs(symmetry));

  // Signed distance along the track, continuous through the apex (a radius, signed or not, is not).
  // t is clamped so t * t cannot overflow mediump into a NaN at roundness 0.
  float tSpan = clamp(t, -1., 1.);
  float alongTrack = q * sqrt(1. + tSpan * tSpan);

  // Measured from the frame's centre, not the apex, so moving u_apex doesn't carry the set away.
  float s =
    (alongTrack - u_apex - phase - offset * u_stagger) / u_rampLength + .5;

  float tailSoft = mix(.002, .95, u_tail);
  float onTrack =
    smoothstep(0., tailSoft, s) * smoothstep(0., tailSoft, 1. - s);

  // A palindrome (0 → 1 → 0) whose peak holds one segment, so the last colour is as wide as the rest.
  float stops = max(u_colorsCount, 1.);
  float hold = .5 / max(2. * stops - 1., 1.);
  float fromMid = abs(clamp(s, 0., 1.) - .5);
  float mirrored = 1. - max(fromMid - hold, 0.) / max(.5 - hold, 1e-4);

  vec4 ramp = rampAt(mirrored);

  // The silhouette's AA is a fixed hairline, never u_tail: that would fade the outer bands.
  float inside = (1. - smoothstep(.99, 1., abs(t))) * onTrack * inStack * inBand;

  // Rails: only a ribbon's two sides, sized in screen pixels. The rate comes from stack, never
  // offCentre: it folds at slot boundaries and fwidth() would drop the line out there.
  float acrossRate = max(fwidth(stack) * bands, 1e-5);

  // Unsigned so the stroke straddles the rail and coincident rails at spread 0 merge seamlessly.
  float railPx = abs(offCentre - halfBand) / acrossRate;

  float stroke = max(u_edgeWidth, 0.) * max(u_pixelRatio, 1.);
  float halfStroke = stroke * .5;

  // offCentre is pinned at .5 outside the stack, so the stack's own bound must clip the rails.
  float intoStack = min(stack, 1. - stack) * bands / acrossRate;

  // The last factor fades sub-pixel lines so a width of 0 draws nothing.
  float edge = (1. - smoothstep(halfStroke - .5, halfStroke + .5, railPx)) *
    clamp(intoStack + halfStroke + .5, 0., 1.) *
    clamp(stroke, 0., 1.);

  // The fill's fade, starting at the same point but ending railReach past the span.
  float railReach = max(u_edgeTail, 0.);
  float railTail =
    smoothstep(-railReach, tailSoft, s) * smoothstep(-railReach, tailSoft, 1. - s);

  // Kept apart and composited over at the end: a mix() toward the ramp would tint the tail.
  float railAlpha = edge * railTail * u_colorEdge.a;

  // Ribbon and rail dithers are independent but share one matrix so their dots align.
  float edgeAmount = max(u_edgeDither, 0.);
  float edgeDither = min(edgeAmount, 1.);
  float edgeDuty = 1. - EDGE_DITHER_OPEN * clamp(edgeAmount - 1., 0., 1.);
  if (u_rampDither > 0. || edgeDither > 0.) {
    float bayer = bayer8(gl_FragCoord.xy / max(u_ditherSize, 1.));

    if (u_rampDither > 0.) {
      float threshold = bayer - .5;
      float levels = max(mix(DITHER_MAX_LEVELS, DITHER_MIN_LEVELS, u_rampDither), 2.);
      ramp.rgb = clamp(floor(ramp.rgb * levels + threshold + .5) / levels, 0., 1.);
    }

    // Threshold nudged off 0 and 1, or the matrix's zero cell would light zero coverage.
    float coverThreshold = mix(1. / 128., 1. - 1. / 128., bayer);

    inside = mix(inside, step(coverThreshold, inside), u_rampDither);
    railAlpha =
      mix(railAlpha, step(coverThreshold, railAlpha * edgeDuty), edgeDither);
  }

  vec3 color = ramp.rgb * ramp.a * inside;
  float opacity = ramp.a * inside;
  color += (1. - opacity) * u_colorBack.rgb * u_colorBack.a;
  opacity += (1. - opacity) * u_colorBack.a;

  color = u_colorEdge.rgb * railAlpha + color * (1. - railAlpha);
  opacity = railAlpha + opacity * (1. - railAlpha);

  fragColor = vec4(color, opacity);
}`;
