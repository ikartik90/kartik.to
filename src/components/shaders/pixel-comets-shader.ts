import { PIXEL_COMETS_MAX_COLORS } from "./pixel-comets-uniforms";

export const pixelCometsMeta = {
  maxColorCount: PIXEL_COMETS_MAX_COLORS,
} as const;

// No feedback buffer: every trail is derived in closed form from its lane, slot and cycle.
// Output must stay premultiplied so a transparent colorBack composites over another shader.
export const pixelCometsFragmentShader = `#version 300 es
// highp: under mediump the hashes correlate into visible stripes.
precision highp float;

uniform vec4 u_colors[${PIXEL_COMETS_MAX_COLORS}];
uniform float u_colorsCount;
uniform vec4 u_colorBack;
uniform vec4 u_colorGrid;
uniform vec4 u_colorGridMajor;

uniform float u_pixelSize;
uniform float u_count;
// u_axes: which axes run (1 or 0). u_axisHeading: +1 up/right, -1 down/left, 0 either.
uniform vec2 u_axes;
uniform vec2 u_axisHeading;
uniform float u_originMin;
uniform float u_originMax;
uniform float u_travelSpans;
uniform float u_parallax;
uniform float u_swerve;
uniform float u_tail;
uniform float u_tailBlend;
uniform float u_falloff;
uniform float u_headGlow;
uniform float u_headRadius;
uniform float u_headStretch;
uniform float u_tailGlow;
uniform float u_tailRadius;
uniform float u_gridWidth;
uniform float u_majorGrid;
uniform float u_easing;
uniform float u_easingBias;

uniform float u_time;
// mediump to match the library's vertex shader: a precision mismatch fails to link.
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;

in vec2 v_objectUV;
out vec4 fragColor;

#define PI 3.1415927
#define HALF_PI 1.5707963

#define COMET_SLOTS 2

// Must match PIXEL_COMETS_MAX_GLOW_REACH in pixel-comets-uniforms.
#define COMET_MAX_GLOW_LANES 3

// Cells per second at speed 1; u_time is already scaled by speed.
#define CELLS_PER_SECOND 14.

#define SWERVE_SAMPLES 4

#define PARALLAX_REACH 3.

// Must stay under 1: at 1 a mover stalls, past it that stretch runs backwards.
#define BIAS_DEPTH 0.8

// What each trail cell keeps of the one in front, at u_falloff 0 and 1.
#define COMET_DECAY_NONE 1.
#define COMET_DECAY_HARD 0.45

// Per-frame constants, set in main and read in addMover.
float g_tailCells;
float g_chance;
float g_decay;

// One axis's (runCells, cycles): Travel is a share of the frame, which may not be square.
vec2 timingFor(float span) {
  // Floored at one cell: a zero run divides progress and would take the whole field with it.
  float run = max(u_travelSpans * span * .5, 1.);
  // One extra cell so the last pixel fades out rather than popping.
  float life = run + g_tailCells + 1.;
  return vec2(run, u_time / max(life / CELLS_PER_SECOND, 1e-4));
}

// Trig-free hash (Dave Hoskins): sin() diverges between drivers at large arguments.
vec4 hash44(vec4 p) {
  p = fract(p * vec4(.1031, .1030, .0973, .1099));
  p += dot(p, p.wzxy + 33.33);
  return fract((p.xxyz + p.yzzw) * p.zywx);
}

// Re-times a run without moving its ends; must stay monotone.
float leanRun(float along) {
  return along + u_easingBias * BIAS_DEPTH * sin(PI * along) / PI;
}

// Trail brightness a distance behind the head: geometric falloff, cut off at Tail's length.
float trailFade(float behind) {
  float d = clamp(behind - .5, 0., 1e5);
  // Tail 0 is the head alone; the gate below would also light the cell behind it.
  if (g_tailCells < 1e-3) return step(d, 0.);
  return pow(g_decay, d) * step(d, g_tailCells);
}

// Indexed, not interpolated: one pixel is one colour.
vec4 colorAt(float r) {
  float count = max(u_colorsCount, 1.);
  return u_colors[int(clamp(floor(r * count), 0., count - 1.))];
}

// Which side a mover is born on; it always runs back toward the centre. Heading 0 tosses.
float birthSide(float heading, float toss) {
  return abs(heading) > .5 ? -heading : (toss < .5 ? -1. : 1.);
}

// The lane's other comet at a clock: (head position, direction, alive), on its unswerved path.
vec3 otherComet(float axis, float lane, float slot, float cyclesAt, float laneSpan, float baseRun, float heading) {
  vec4 key = vec4(axis, lane, slot, 0.);
  float ph = hash44(key * 1.7 + 11.3).x;
  float clock = cyclesAt + ph;
  float cyc = floor(clock);
  float within = clock - cyc;

  vec4 h = hash44(key + vec4(cyc * 7.13));
  if (h.x >= g_chance) return vec3(0.);

  float depth = 1. + u_parallax * PARALLAX_REACH * hash44(key * 3.1 + vec4(cyc * 19.7 + 5.3)).y;
  float run = baseRun * depth;
  float eased = leanRun(leanRun(within));
  float progress = mix(eased, sin(eased * HALF_PI), u_easing);

  float side = birthSide(heading, h.y);
  float start = side * mix(u_originMin, u_originMax, h.z) * laneSpan * .5;
  return vec3(start - side * min(progress * (run + g_tailCells + 1.), run), -side, 1.);
}

// One lane-slot's contribution here. axis 0 runs along Y (a column); alongStep is the
// fragment's position along the lane snapped to its cell centre, alongFree unsnapped; all in cells.
void addMover(
  float axis, float lane, float slot,
  float alongStep, float alongFree, float perp, float laneOffset, float laneSpan,
  vec2 timing, float heading,
  inout vec4 core, inout vec4 glow
) {
  float cycles = timing.y;

  vec4 key = vec4(axis, lane, slot, 0.);

  // A per-slot phase offset, or the whole field would fire in unison.
  float ph = hash44(key * 1.7 + 11.3).x;
  float clock = cycles + ph;
  float cycle = floor(clock);
  float within = clock - cycle;

  vec4 h = hash44(key + vec4(cycle * 7.13));
  if (h.x >= g_chance) return;

  // Depth is drawn per cycle and scales the run, never the cycle, or the draw becomes circular.
  float depth = 1. + u_parallax * PARALLAX_REACH * hash44(key * 3.1 + vec4(cycle * 19.7 + 5.3)).y;
  float runCells = timing.x * depth;
  float lifeCells = runCells + g_tailCells + 1.;

  float eased = leanRun(leanRun(within));

  // Easing: 0 linear, 1 sine, -1 the sine reflected through linear (still monotone).
  float shaped = sin(eased * HALF_PI);
  float progress = mix(eased, shaped, u_easing);

  // Overshoots the run on purpose: the overshoot is the trail draining after the head is gone.
  float head = progress * lifeCells;

  // Born in the origin band on a random side, always running back toward the centre.
  float side = birthSide(heading, h.y);
  float dir = -side;
  float start = side * mix(u_originMin, u_originMax, h.z) * laneSpan * .5;

  // Early out: nothing this comet has can reach this fragment. A swerve never moves it along the lane.
  float toStep = dir * (alongStep - start);
  float reachPast = max(u_headStretch + u_headRadius, u_tailRadius) + 1.;
  if (toStep < head - g_tailCells - reachPast ||
      toStep > min(head, runCells) + reachPast) return;

  // Swerve: a comet catching the other slot's tail steps one lane sideways, found by sampling its run.
  float sideStep = 0.;
  float switchAt = 1e9;
  if (u_swerve > 0.) {
    vec4 sw = hash44(key * 5.7 + vec4(cycle * 3.9 + 41.3));
    if (sw.x < u_swerve) {
      // Assumes COMET_SLOTS is 2.
      float otherSlot = 1. - slot;
      float toSide = sw.y < .5 ? -1. : 1.;
      for (int i = 1; i <= SWERVE_SAMPLES; i++) {
        float w = float(i) / float(SWERVE_SAMPLES + 1);
        float easedAt = leanRun(leanRun(w));
        float progAt = mix(easedAt, sin(easedAt * HALF_PI), u_easing);
        float headAtW = min(progAt * lifeCells, runCells);
        float posA = start + dir * headAtW;
        vec3 other = otherComet(axis, lane, otherSlot, cycles - (within - w), laneSpan, timing.x, heading);
        // Depth into the other's tail, in cells; half the tail is the trigger.
        float pen = other.y * (other.x - posA);
        if (other.z > .5 && pen >= 0. && pen <= .5 * g_tailCells) {
          sideStep = toSide;
          switchAt = headAtW;
          break;
        }
      }
    }
  }

  vec4 tint = colorAt(h.w);
  float ink = tint.a;

  float toFree = dir * (alongFree - start);
  // u_tailBlend moves only where the fade's value is read; the gates stay at the cell centre.
  float at = mix(toStep, toFree, u_tailBlend);

  // Lane read at the fragment's distance, not the head's, so a switch steps the trail.
  float shiftStep = toStep >= switchAt ? sideStep : 0.;
  float onLaneStep = abs(laneOffset + shiftStep) < .5 ? 1. : 0.;

  float onRun = step(-.5, toStep) * step(toStep, runCells + .5);
  float behindStep = head - toStep;
  float onTrail = step(-.5, behindStep) * onRun;

  float behind = head - at;
  float fade = trailFade(behind) * onTrail;

  core.rgb += tint.rgb * (fade * ink * onLaneStep);
  core.a += fade * ink * onLaneStep;

  // Both blooms are measured against where the ink is, so they stay registered with it.
  float headAt = min(head, runCells);
  float headPos = start + dir * headAt;
  float headCell = mix(floor(headPos) + .5, headPos, u_tailBlend);
  float alive = 1. - smoothstep(runCells, runCells + 1., head);
  // A capsule smeared back along the lane only: stretching across it would clip the glow at
  // the walked lanes (COMET_MAX_GLOW_LANES). The radius fades with it, so it tapers.
  float shiftHead = headAt >= switchAt ? sideStep : 0.;
  float perpHead = perp - shiftHead;
  float ahead = dir * (alongFree - headCell);
  float alongToHead = ahead - clamp(ahead, -u_headStretch, 0.);
  float back = clamp(-ahead, 0., u_headStretch);
  float fadeBack = 1. - back / max(u_headStretch, 1e-4);
  float toHead = length(vec2(perpHead, alongToHead)) / max(u_headRadius * fadeBack, 1e-4);
  float headLit = u_headGlow * alive * fadeBack * pow(max(1. - toHead, 0.), 2.);

  // Excludes the head's cell while the head is lit, so Tail Radius never sizes the head's halo.
  float lit0 = max(-.5, head - g_tailCells - .5);
  float lit1 = min(runCells + .5, head + .5) - alive;

  float hasTrail = smoothstep(0., .5, lit1 - lit0);

  float e0 = start + dir * lit0;
  float e1 = start + dir * max(lit1, lit0);
  float segLo = min(e0, e1);
  float segHi = max(e0, e1);

  float nearest = clamp(alongFree, segLo, segHi);

  // Read at the cell on the same u_tailBlend as the core, so a pixel's halo carries its value.
  float toNear = dir * (nearest - start);
  float shiftNear = toNear >= switchAt ? sideStep : 0.;
  float perpNear = perp - shiftNear;

  float amp = mix(floor(nearest) + .5, nearest, u_tailBlend);
  float behindNear = head - dir * (amp - start);
  float fadeNear = trailFade(behindNear);

  // The halo narrows with the ink's fade (at tailBlend 1), which draws a comet rather than a bar.
  float taper = mix(1., fadeNear, u_tailBlend);
  float toTrail = length(vec2(perpNear, alongFree - nearest)) /
    max(u_tailRadius * taper, 1e-4);

  float trailLit = u_tailGlow * hasTrail * fadeNear *
    pow(max(1. - toTrail, 0.), 2.);

  float lit = (headLit + trailLit) * ink;
  glow.rgb += tint.rgb * lit;
  glow.a += lit;
}

void main() {
  // Doubled to reach +/-1; the frame's long edge spans 2 units.
  vec2 uv = 2. * v_objectUV;

  float longEdge = max(max(u_resolution.x, u_resolution.y), 1.);
  float pixelPx = max(u_pixelSize, 1.);
  float gridPx = max(u_gridWidth, 0.);

  // Pitch is pixel plus line: the line sits between pixels, so Pixel Size stays the pixel's size.
  float pitchPx = (pixelPx + gridPx) * max(u_pixelRatio, 1.);
  // Whole cells across the long edge, so no sliver is left at the border.
  float across = max(floor(longEdge / pitchPx + .5), 1.);
  float cell = 2. / across;

  // How much of a cell the pixel itself occupies; the remainder is the line.
  float duty = pixelPx / (pixelPx + gridPx);

  vec2 g = uv / cell;
  vec2 base = floor(g);

  vec2 frame = (2. * u_resolution / longEdge) / cell;
  float lanes = max(dot(u_axes, frame), 1.);

  g_tailCells = max(u_tail, 0.);

  vec2 downTiming = timingFor(frame.y);
  vec2 acrossTiming = timingFor(frame.x);

  g_decay = mix(COMET_DECAY_NONE, COMET_DECAY_HARD, clamp(u_falloff, 0., 1.));

  // Count is movers per frame, corrected for spawn bands reaching outside it; saturates at every lane firing.
  g_chance = clamp(
    u_count * max(u_originMax, 1.) / (float(COMET_SLOTS) * lanes),
    0., 1.
  );

  // Lanes to walk. Reading the glow strengths too is what makes a disabled glow free.
  float reach = max(
    u_headGlow > 0. ? u_headRadius : 0.,
    u_tailGlow > 0. ? u_tailRadius : 0.
  );
  // One lane wider when swerving: a comet from next door may be running through this one.
  int swerveLanes = u_swerve > 0. ? 1 : 0;
  int span = int(clamp(ceil(reach), 0., float(COMET_MAX_GLOW_LANES))) + swerveLanes;

  vec4 core = vec4(0.);
  vec4 glow = vec4(0.);

  for (int d = -span; d <= span; d++) {
    float column = base.x + float(d);
    float row = base.y + float(d);

    for (int s = 0; s < COMET_SLOTS; s++) {
      float slot = float(s);
      // Skipped, not masked: the branch is uniform, and masking would still pay for the walk.
      if (u_axes.x > 0.) addMover(0., column, slot,
        base.y + .5, g.y, g.x - (column + .5), float(d), frame.y, downTiming,
        u_axisHeading.x, core, glow);
      if (u_axes.y > 0.) addMover(1., row, slot,
        base.x + .5, g.x, g.y - (row + .5), float(d), frame.x, acrossTiming,
        u_axisHeading.y, core, glow);
    }
  }

  vec2 fromCentre = abs(fract(g) - .5);
  vec2 aa = max(fwidth(g), vec2(1e-6)) * .5;
  vec2 inside = vec2(1.);
  if (gridPx > 0.) {
    inside =
      1. - smoothstep(vec2(duty * .5) - aa, vec2(duty * .5) + aa, fromCentre);
  }
  float inPixel = inside.x * inside.y;

  // Every u_majorGrid'th line in a second colour, same width, counted from the frame's centre.
  float majorEvery = floor(max(u_majorGrid, 0.) + .5);
  float majorCover = 0.;
  if (majorEvery >= 1. && gridPx > 0.) {
    // GLSL mod() is floor-based, so the pattern does not mirror about the origin.
    vec2 onBoundary = floor(g + .5);
    vec2 isMajor = vec2(
      mod(onBoundary.x, majorEvery) < .5 ? 1. : 0.,
      mod(onBoundary.y, majorEvery) < .5 ? 1. : 0.
    );
    vec2 band = isMajor * (1. - inside);
    majorCover = 1. - (1. - band.x) * (1. - band.y);
  }
  float minorCover = (1. - inPixel) - majorCover;

  // Premultiplied, back to front: ground, glow, movers, then the lattice.
  vec3 color = u_colorBack.rgb * u_colorBack.a;
  float opacity = u_colorBack.a;

  // Composited, not added: additive light breaks premultiplied rgb <= a where blooms overlap.
  float glowAlpha = clamp(glow.a, 0., 1.);
  color = (glow.rgb / max(glow.a, 1e-4)) * glowAlpha + color * (1. - glowAlpha);
  opacity = glowAlpha + opacity * (1. - glowAlpha);

  // Movers fill their whole cell; the lattice is drawn over them rather than cut out.
  float coreAlpha = clamp(core.a, 0., 1.);
  color = (core.rgb / max(core.a, 1e-4)) * coreAlpha + color * (1. - coreAlpha);
  opacity = coreAlpha + opacity * (1. - coreAlpha);

  float gridAlpha = minorCover * u_colorGrid.a;
  color = u_colorGrid.rgb * gridAlpha + color * (1. - gridAlpha);
  opacity = gridAlpha + opacity * (1. - gridAlpha);

  float majorAlpha = majorCover * u_colorGridMajor.a;
  color = u_colorGridMajor.rgb * majorAlpha + color * (1. - majorAlpha);
  opacity = majorAlpha + opacity * (1. - majorAlpha);

  fragColor = vec4(color, opacity);
}`;
