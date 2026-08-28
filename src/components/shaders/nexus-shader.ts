import { NEXUS_MAX_COLORS } from "./nexus-uniforms";

// ---------------------------------------------------------------------------
// Nexus — coloured pixels running the lanes of a lattice, each dragging a
// fading trail behind it. After the Nexus One's live wallpaper and the Nexus 4's
// pixel fields.
//
// Written against the same two contracts `cosmic-track-shader` is written
// against — `v_objectUV` centred on 0 with the framing already applied, and
// PREMULTIPLIED output so an alpha-zero ground composites over another shader
// instead of punching a hole in it. See there for why the library's own GLSL
// snippets are not importable.
//
// ---------------------------------------------------------------------------
// THE ONE IDEA: there is no simulation.
//
// A trail is a thing that ACCUMULATES, and this shader has nothing to
// accumulate into — `ShaderMount` runs one fragment pass with a clock and no
// feedback buffer, so nothing survives a frame. The usual answer (ping-pong
// FBOs) is not available, and the usual symptom of faking it (a smear that
// drifts and never quite clears) would be worse than not having it.
//
// So the trail is not remembered, it is DERIVED. A mover's whole life is a
// closed form of its lane, its slot and the cycle it is in, so any fragment can
// ask "when did the head pass through here, and how long ago was that" and get
// an exact answer without anyone having drawn the intervening frames. Winding
// the clock backwards is therefore free and exact, and the picture at a given
// time is the same picture however you arrived at it.
//
// ---------------------------------------------------------------------------
// THE OTHER IDEA: lanes, so the cost is flat.
//
// A mover picks one of the four edges and goes, which means it travels an
// AXIS — so a mover running vertically never leaves its column, and one running
// horizontally never leaves its row. Hash the movers per COLUMN and per ROW and
// a fragment only ever has to ask about the handful of lanes that could
// possibly reach it, rather than about every mover on the card.
//
// The alternative — a fixed pool of movers, each tested against every
// fragment — is what this replaced. Sixty movers over a 1280x1280 buffer is a
// hundred million tests a frame to draw perhaps four hundred lit pixels. The
// lane form is a couple of dozen tests per fragment however dense the field
// gets, and the density control becomes exact rather than a guess.
//
// What it costs is the cap below: a lane holds at most NEXUS_SLOTS movers at
// once. At any density the field is worth looking at, no one can see it.
// ---------------------------------------------------------------------------

export const nexusMeta = {
  maxColorCount: NEXUS_MAX_COLORS,
} as const;

export const nexusFragmentShader = `#version 300 es
// HIGHP, where the rest of this repo's shaders are content with mediump.
//
// Everything here is placed by a hash, and a hash is precisely the operation
// that mediump ruins: it works by throwing away the high bits of a product, and
// a 10-bit mantissa has almost none to throw. Under mediump the lanes correlate
// into visible stripes and diagonals — the field stops looking random, which is
// the only thing it has to look like.
precision highp float;

uniform vec4 u_colors[${NEXUS_MAX_COLORS}];
uniform float u_colorsCount;
uniform vec4 u_colorBack;
uniform vec4 u_colorGrid;
uniform vec4 u_colorGridMajor;

uniform float u_pixelSize;
uniform float u_count;
uniform float u_seed;
uniform float u_travel;
uniform float u_tail;
uniform float u_tailBlend;
uniform float u_falloff;
uniform float u_headGlow;
uniform float u_headRadius;
uniform float u_tailGlow;
uniform float u_tailRadius;
uniform float u_gridWidth;
uniform float u_majorGrid;
uniform float u_easing;
uniform float u_easingBias;

uniform float u_time;
// The buffer's size in DEVICE pixels, and the device pixels per CSS pixel.
// Read together they are what turns the two SCREEN measurements the panel
// offers — the cell and the grid line — into geometry the shader can use.
//
// MEDIUMP, spelled out, against this file's highp default. These two are the
// only uniforms here the LIBRARY's vertex shader also declares, and it runs at
// mediump — a uniform shared between the two stages must agree about its
// precision or the program fails to LINK, with every canvas going blank and
// nothing but a console line to say why.
//
// Nothing is lost by agreeing. Both carry small integers-and-a-half (a buffer
// edge, a device pixel ratio) that mediump holds exactly, and every value
// derived from them below is computed at this file's own precision.
uniform mediump vec2 u_resolution;
uniform mediump float u_pixelRatio;

in vec2 v_objectUV;
out vec4 fragColor;

#define PI 3.1415927
#define HALF_PI 1.5707963

// How many movers a single lane may carry at once.
//
// One reads as a rule the eye can find: at any real density you start noticing
// that a column never holds two. Three is a third of the arithmetic again for a
// coincidence that is already rare at two. So two.
#define NEXUS_SLOTS 2

// The furthest a glow may reach, in cells — and so the widest neighbourhood a
// fragment walks. Must match NEXUS_MAX_GLOW_REACH in the uniforms module, which
// is where the control's range is clamped against it: a radius past this is not
// a bigger halo, it is one clipped square at the lane boundary.
#define NEXUS_MAX_GLOW_LANES 3

// Cells per second at Speed 1. The mount has already scaled u_time by Speed, so
// this is the only place the shader has an opinion about pace — enough that a
// mover crosses a card in a couple of seconds, which is the reference's tempo.
#define CELLS_PER_SECOND 14.

// How much wider than the frame movers are spawned, so that turning the framing
// does not empty the corners.
//
// The lattice is unbounded and the movers are not: they are drawn into a box,
// and at rotation 45 the frame's own corners fall outside a box that fits it
// square (by a factor of root two), leaving two bare wedges. Offsetting the
// framing walks off the edge of the box the same way.
//
// Two covers any rotation with room for a modest offset. It is paid for
// directly — a mover spawned into a box twice the frame is on screen half the
// time, so the odds below are doubled to keep Count meaning what it says.
#define NEXUS_SPAWN_SPREAD 2.

// How hard the bias may bend a run's timing. Carried from cosmic track, and
// under 1 for the same reason: the warped rate is 1 + bias*cos, so 1 would
// stall a mover dead and anything past it would run that stretch backwards.
#define BIAS_DEPTH 0.8

// What one cell of the trail keeps of the cell in front of it, at the two ends
// of u_falloff. See trailFade — the control walks between these.
//
// The soft end is not 1, because at exactly 1 the curve is 0/0. Just under it
// the same expression IS the straight line, to within a thousandth, which is
// what lets one formula cover the whole slider instead of a mix between two.
//
// The hard end is where a step stops being a step and becomes an ending: at
// .45 the third cell is already down to a fifth, so a trail reads as three or
// four distinct pixels however long Tail is set. Lower would only be a shorter
// trail wearing a longer one's number.
#define NEXUS_DECAY_SOFT 0.995
#define NEXUS_DECAY_HARD 0.45

// ---------------------------------------------------------------------------
// Set once in main, read in addMover. Globals rather than seven more
// parameters on a function that already takes ten — these are constants of the
// FRAME, and threading them through per lane would say they varied.
// ---------------------------------------------------------------------------
float g_cycles;
float g_runCells;
float g_tailCells;
float g_lifeCells;
float g_chance;
float g_decay;
float g_tailEnd;

// Hash without a trig call — sin() diverges between drivers at large arguments,
// and "the field is arranged differently on that laptop" is not a bug anyone
// enjoys finding. (Dave Hoskins' integer-free mixer, the one every recent
// shader uses for exactly this reason.)
vec4 hash44(vec4 p) {
  p = fract(p * vec4(.1031, .1030, .0973, .1099));
  p += dot(p, p.wzxy + 33.33);
  return fract((p.xxyz + p.yzzw) * p.zywx);
}

// One pass of the bias warp: re-times a run without moving either of its ends.
//
// Its rate is 1 + bias*BIAS_DEPTH*cos(PI * along) — highest leaving the start,
// falling steadily, lowest arriving. Integrating to exactly 1 across the run is
// what pins the ends: the control decides how the time between them is spent,
// never how much of it there is. Applied TWICE in addMover, because one pass
// cannot lean harder without stalling.
float leanRun(float along) {
  return along + u_easingBias * BIAS_DEPTH * sin(PI * along) / PI;
}

// How bright the trail is a given distance BEHIND the head, in cells.
//
// One function because the ink and its halo both ask, and a halo shaped by a
// different curve from the thing throwing it is the fault this shader has
// already been caught with twice.
//
// GEOMETRIC, not linear, and that is the whole of what u_falloff buys. A
// straight ramp loses 1/Tail per cell, so the step between one pixel and the
// next is 7% at Tail 14 and thinner still beyond — with no gutter between them
// there is no edge to find either, and a trail reads as one bar with a
// gradient on it. Keeping a fixed FRACTION of the cell in front instead makes
// that step the same everywhere along the trail and independent of how long
// the trail is.
//
// The subtraction is what still lands it on zero at exactly Tail cells, so the
// control shortens the trail's READ without lying about its length. And as the
// decay approaches 1 the whole expression becomes the straight ramp — the
// limit of (p^d - p^T)/(1 - p^T) as p goes to 1 is (T - d)/T — which is why
// one formula covers the slider end to end rather than a blend between two.
float trailFade(float behind) {
  float d = clamp(behind - .5, 0., 1e5);
  // A tail of zero is the head alone on the grid: a real setting, and the one
  // value the ratio above cannot express (its denominator goes to nothing).
  if (g_tailCells < 1e-3) return step(d, 0.);
  return clamp((pow(g_decay, d) - g_tailEnd) / max(1. - g_tailEnd, 1e-6), 0., 1.);
}

// The palette, indexed rather than interpolated. A mover is one pixel and a
// pixel is one colour, so there is nothing between two stops to find — which is
// also why the swatch count IS the number of colours in the picture.
vec4 colorAt(float r) {
  float count = max(u_colorsCount, 1.);
  return u_colors[int(clamp(floor(r * count), 0., count - 1.))];
}

// ---------------------------------------------------------------------------
// One lane-slot's contribution at this fragment.
//
//   axis       0 for a lane running along Y (a column), 1 for one along X.
//   lane       that column's or row's index. Unbounded — the lattice is.
//   slot       which of NEXUS_SLOTS movers in it.
//   alongStep  the fragment's position along the lane, snapped to its cell's
//   alongFree  centre, and where the fragment actually is. Both in cells;
//              u_tailBlend chooses between them.
//   perp       the fragment's offset from the lane's centre line, in cells.
//   onLane     1 only for the fragment's OWN lane. This is what keeps the
//              mover's core exactly one cell wide while its glow spills into
//              the neighbours being walked either side of it.
//   laneSpan   how long the spawn window is, in cells.
// ---------------------------------------------------------------------------
void addMover(
  float axis, float lane, float slot,
  float alongStep, float alongFree, float perp, float onLane, float laneSpan,
  inout vec4 core, inout vec4 glow
) {
  vec4 key = vec4(axis, lane, slot, u_seed);

  // Each lane-slot keeps its own offset into the cycle, or the whole field
  // would fire in unison and read as a heartbeat rather than as weather.
  float ph = hash44(key * 1.7 + 11.3).x;
  float clock = g_cycles + ph;
  float cycle = floor(clock);
  float within = clock - cycle;

  // Re-drawn EVERY cycle, which is the difference between a slot and a mover: a
  // slot is a place a mover may be. So a lane that is empty now may fire next
  // time round, and the field churns at a fixed count rather than settling into
  // one arrangement and repeating it.
  vec4 h = hash44(key + vec4(cycle * 7.13));
  if (h.x >= g_chance) return;

  // How far through its own life this mover is, 0 to 1. The cycle IS that life,
  // so a lane holding a mover holds one for the whole of it — the next departs
  // as this one finishes draining.
  float eased = leanRun(leanRun(within));

  // EASING, signed about a constant rate, exactly as cosmic track has it —
  // re-pointed at a run that only goes one way, so "eases into the end" is the
  // end of the run rather than a turnaround. One mix does both signs: the
  // negative half is the positive half reflected through the straight line, and
  // that reflection stays monotone (slope 2 - (PI/2)cos, never under 0.43), so
  // the mover always advances.
  float shaped = sin(eased * HALF_PI);
  float progress = mix(eased, shaped, u_easing);

  // How far the head has come. It runs PAST u_travel deliberately: the ink is
  // gated to the run below, so the overshoot is exactly the stretch where the
  // head is gone and the trail is still draining. That is what makes a mover
  // outlive its own run without anything having to remember that it did.
  float head = progress * g_lifeCells;

  // One of the four edges. The axis was chosen by which lane this is; this is
  // which way along it.
  float dir = h.y < .5 ? -1. : 1.;
  float start = (h.z - .5) * laneSpan * NEXUS_SPAWN_SPREAD;

  vec4 tint = colorAt(h.w);
  float ink = tint.a;

  // How far the head had to travel to reach this fragment. Measured at the
  // cell's centre, where a whole cell shares one value and the trail steps down
  // in pixels; and where the fragment is, where it is a continuous gradient.
  float toStep = dir * (alongStep - start);
  float toFree = dir * (alongFree - start);
  // u_tailBlend chooses where the fade's VALUE is read — and only its value.
  // The gates below are read at the cell's centre whatever it is set to.
  float at = mix(toStep, toFree, u_tailBlend);

  // WHICH CELLS ARE LIT, decided at the cell's centre at every blend. This is
  // what keeps a lit pixel a whole pixel.
  //
  // Reading the gates on the blended coordinate instead — which is how this
  // worked at first — put the trail's two ends wherever the head and the mover's
  // own fractional spawn point happened to land. Neither is a cell boundary, so
  // at blend 1 the band stopped half-way across a square and slid along inside
  // it as the head advanced: the pixels came out of register with the lattice,
  // along the direction of travel and nowhere else. Making the fade smooth is
  // not the same act as taking the trail off the grid, and one coordinate was
  // doing both.
  //
  // Ink exists only between where the mover spawned and where its head stopped.
  // Without the first term a long tail would light cells BEHIND the spawn point
  // at the moment of spawning; without the second the trail would keep being
  // laid after the run was over.
  float onRun = step(-.5, toStep) * step(toStep, g_runCells + .5);
  float behindStep = head - toStep;
  float onTrail = step(-.5, behindStep) * onRun;

  // HOW BRIGHT it is, on the blended coordinate: full across the head's own
  // cell, then falling away over u_tail cells behind it — see trailFade for the
  // curve. At tailBlend 0 a cell is one flat tone; at 1 the tone varies across
  // it and meets its neighbours' without a step.
  float behind = head - at;
  float fade = trailFade(behind) * onTrail;

  core.rgb += tint.rgb * (fade * ink * onLane);
  core.a += fade * ink * onLane;

  // ---- the two blooms ----------------------------------------------------
  //
  // Both are measured against WHERE THE INK IS, and that is the whole of what
  // keeps them registered with the pixels casting them.
  //
  // The first version shaped them from a SECOND, continuous reading of the
  // trail instead, and it was wrong twice over. It drifted half a cell out of
  // step with the quantised core, so the tail and its halo disagreed about
  // where the trail ended — and it inherited the core's hard step() at the
  // head, which sliced the halo off square exactly where it was brightest.
  // A gate belongs on ink, which a cell either has or has not. Light has to
  // fall off.

  // The head's own bloom, radial about the head CELL rather than about the
  // continuous point inside it. The head is a PIXEL; a halo centred on
  // something that slides across that pixel reads as the glow coming loose
  // from the thing casting it. Blended by u_tailBlend, because a smooth trail's
  // head band slides continuously too and its bloom should go with it.
  float headAt = min(head, g_runCells);
  float headPos = start + dir * headAt;
  float headCell = mix(floor(headPos) + .5, headPos, u_tailBlend);
  // Taken out over the last cell of the run, so the head dims rather than
  // vanishing on a frame boundary.
  float alive = 1. - smoothstep(g_runCells, g_runCells + 1., head);
  float toHead =
    length(vec2(perp, alongFree - headCell)) / max(u_headRadius, 1e-4);
  float headLit = u_headGlow * alive * pow(max(1. - toHead, 0.), 2.);

  // The lit stretch the TRAIL's bloom is thrown by: from the back of the last
  // surviving cell to the back of the HEAD's — the head's own cell left out of
  // it while the head is lit.
  //
  // Leaving it out is what makes the two radii independent, and running the
  // segment all the way to the head — which is what it did — is what stopped
  // them being. The head is the brightest thing the trail contains, so a
  // capsule that reaches it puts a full-strength cap right on top of it, and
  // Tail Radius silently sizes the halo around the head as well as the one
  // around the trail. A halo thrown by the head is Head Radius's to size.
  //
  // The trail takes the cell back as the head goes out (see alive), so the
  // frontmost pixel is never left with nothing lighting it.
  float lit0 = max(-.5, head - g_tailCells - .5);
  float lit1 = min(g_runCells + .5, head + .5) - alive;

  // Fades in over the first half cell, so a mover that has only just spawned —
  // and has laid no trail yet — does not switch a bloom on before there is
  // anything to throw one.
  float hasTrail = smoothstep(0., .5, lit1 - lit0);

  // Those two ends in LANE coordinates, where the direction of travel may have
  // put them the other way round.
  float e0 = start + dir * lit0;
  float e1 = start + dir * max(lit1, lit0);
  float segLo = min(e0, e1);
  float segHi = max(e0, e1);

  // The nearest point on that segment. The bloom is measured from HERE, which
  // is what makes it a CAPSULE: perpendicular distance always, plus whatever
  // the fragment overshoots an end by — and nothing overshoots inside the
  // segment. So it rounds off where the ink stops rather than cutting square
  // there.
  float nearest = clamp(alongFree, segLo, segHi);

  // How bright the ink is at that nearest point, so a halo is as strong as
  // whatever is throwing it: full alongside the head, gone by the tail's last
  // cell — which is what leaves the far end fading out instead of stopping.
  //
  // Read at the CELL, on the same u_tailBlend the core is read on, and that is
  // the part that took two goes to get right. A glow is cast BY pixels: at
  // tailBlend 0 each one is lit to a single value and its halo has to carry
  // that same value, or the halo is a smooth gradient laid over a stepped
  // trail — which is what the eye sees, so the trail stops reading as pixels
  // at all and starts reading as a gradient walking behind the head.
  float amp = mix(floor(nearest) + .5, nearest, u_tailBlend);
  float behindNear = head - dir * (amp - start);
  float fadeNear = trailFade(behindNear);

  // THE COMET. A halo is as WIDE as the thing throwing it, not merely as
  // bright: the bloom keeps whatever fraction of Tail Radius the ink beneath it
  // keeps of full brightness. So it is widest immediately behind the head —
  // where the fade is still 1, which is also what lets the head's own coma meet
  // it without a seam — and draws to a point where the trail runs out.
  //
  // An even-width capsule that only DIMS, which is what this was, cannot make
  // that shape. Its silhouette holds nearly full width the whole way and then
  // falls off a cliff at the end, because the brightness has to reach the eye's
  // floor before the width starts to matter at all. However long the tail, it
  // reads as a glowing bar with a rounded end.
  //
  // Bound to u_tailBlend, and that binding is the whole of the setting. At 0 a
  // trail is separate pixels, each casting the even halo a pixel casts, and
  // tapering it would blur exactly what blend 0 exists to keep distinct. At 1
  // the trail is one continuous stroke, and a continuous stroke narrowing
  // behind a bright head is a comet.
  //
  // Falloff steepens it too, and that is coherent rather than leakage — the
  // taper IS the brightness curve, so a hard falloff gives a short sharp comet
  // and a soft one a long even one. Tail Radius still names the width at the
  // head, since the fade is 1 there at every falloff.
  float taper = mix(1., fadeNear, u_tailBlend);
  float toTrail = length(vec2(perp, alongFree - nearest)) /
    max(u_tailRadius * taper, 1e-4);

  // Only the BRIGHTNESS and the WIDTH are quantised, both of them through amp.
  // The falloff ACROSS the capsule stays continuous, because that is the
  // bloom's shape rather than its source.
  float trailLit = u_tailGlow * hasTrail * fadeNear *
    pow(max(1. - toTrail, 0.), 2.);

  float lit = (headLit + trailLit) * ink;
  glow.rgb += tint.rgb * lit;
  glow.a += lit;
}

void main() {
  // Doubled to reach the +/-1 every built-in works in. The frame's LONG edge
  // spans 2 of these units; the short one spans less, in proportion.
  vec2 uv = 2. * v_objectUV;

  // The cell, in those units. This is the one place the CSS-pixel sizes the
  // panel names become geometry — u_pixelRatio carries them to device pixels
  // (so a 10 is 15 of them at a ratio of 1.5, and still ten pixels to the eye)
  // and the frame's long edge carries those to the shader's own scale.
  float longEdge = max(max(u_resolution.x, u_resolution.y), 1.);
  float pixelPx = max(u_pixelSize, 1.);
  float gridPx = max(u_gridWidth, 0.);

  // The PITCH is the pixel PLUS the grid line, and the addition is the whole
  // trick. A line drawn OVER a cell boundary takes its width out of the two
  // cells it divides — which is what this did at first — so turning the grid up
  // made the pixels smaller and Pixel Size stopped naming the pixel. Laying the
  // line BETWEEN them instead leaves Pixel Size meaning exactly what it says at
  // every width, and pushes the pixels apart as the line thickens, which is
  // what makes a stepped trail read as pixels at all rather than as one bar
  // with a gradient on it.
  float pitchPx = (pixelPx + gridPx) * max(u_pixelRatio, 1.);
  // Rounded to a whole number of cells across that edge, so the lattice divides
  // the frame instead of leaving a sliver of one against the border. It moves
  // the pitch by well under a percent at any size the panel offers.
  float across = max(floor(longEdge / pitchPx + .5), 1.);
  float cell = 2. / across;

  // How much of a cell the pixel itself occupies; the remainder is the line.
  float duty = pixelPx / (pixelPx + gridPx);

  vec2 g = uv / cell;
  vec2 base = floor(g);

  // The frame measured in cells. Every column is a lane and so is every row, so
  // their sum is how many lanes a frame holds — which is all the odds need.
  //
  // The LATTICE is unbounded, deliberately: the framing controls move a camera
  // over a field rather than resizing the field, so zooming out finds more grid
  // rather than an edge. Only the movers are drawn into a box (see
  // NEXUS_SPAWN_SPREAD), because a count has to be a count of something.
  vec2 frame = (2. * u_resolution / longEdge) / cell;
  float lanes = max(frame.x + frame.y, 1.);

  g_runCells = max(u_travel, 1.);
  g_tailCells = max(u_tail, 0.);
  // The run, the drain, and ONE more cell.
  //
  // That last cell is the half at each end of the fade window, and without it
  // the cycle ends with the final pixel still lit — faintly, but it is switched
  // off rather than fading out, so every mover pops as it dies. The cost of
  // carrying it is that a cycle is one cell longer than the two controls name,
  // which nothing can see.
  g_lifeCells = g_runCells + g_tailCells + 1.;

  // The trail's curve — see trailFade. Both of these are constant over the
  // frame, and the pow() for the end point is the reason they are hoisted: it
  // would otherwise be paid once per lane per fragment for a number that never
  // varies.
  g_decay = mix(NEXUS_DECAY_SOFT, NEXUS_DECAY_HARD, clamp(u_falloff, 0., 1.));
  g_tailEnd = pow(g_decay, max(g_tailCells, 1e-4));

  // One cycle is one mover's whole life. u_time is already scaled by Speed at
  // the mount, so this is seconds at Speed 1.
  float cycleSeconds = g_lifeCells / CELLS_PER_SECOND;
  g_cycles = u_time / max(cycleSeconds, 1e-4);

  // Count is a number of MOVERS, so it is shared out over the slots a frame
  // holds — then corrected for the spawn box being wider than the frame, which
  // leaves a mover on screen for only part of its life.
  //
  // It saturates rather than failing: past what the lattice can hold every lane
  // fires every cycle and the field is as dense as it gets.
  g_chance = clamp(
    u_count * NEXUS_SPAWN_SPREAD / (float(NEXUS_SLOTS) * lanes),
    0., 1.
  );

  // How far out to look. A mover's core is one cell wide, so with no glow the
  // fragment's own lane is the only one that can reach it and the loop runs
  // once; every cell of bloom is two more lanes per axis to walk. Reading the
  // STRENGTHS as well as the radii is what makes a glow turned off actually
  // free rather than merely invisible.
  float reach = max(
    u_headGlow > 0. ? u_headRadius : 0.,
    u_tailGlow > 0. ? u_tailRadius : 0.
  );
  int span = int(clamp(ceil(reach), 0., float(NEXUS_MAX_GLOW_LANES)));

  vec4 core = vec4(0.);
  vec4 glow = vec4(0.);

  for (int d = -span; d <= span; d++) {
    float onLane = d == 0 ? 1. : 0.;
    float column = base.x + float(d);
    float row = base.y + float(d);

    for (int s = 0; s < NEXUS_SLOTS; s++) {
      float slot = float(s);
      // Movers running along Y, in the columns either side of this fragment.
      addMover(0., column, slot,
        base.y + .5, g.y, g.x - (column + .5), onLane, frame.y, core, glow);
      // Movers running along X, in the rows either side of it.
      addMover(1., row, slot,
        base.x + .5, g.x, g.y - (row + .5), onLane, frame.x, core, glow);
    }
  }

  // The pixel's own square inside its cell; everything outside it is the grid
  // line. Nothing is stroked anywhere here — a line IS the space Grid Width
  // opens between one pixel and the next, which is exactly why it cannot take
  // anything away from them.
  //
  // fwidth carries half a screen pixel into cell units, which is what
  // antialiases the four edges at any zoom and on any display.
  vec2 fromCentre = abs(fract(g) - .5);
  vec2 aa = max(fwidth(g), vec2(1e-6)) * .5;
  vec2 inside = vec2(1.);
  if (gridPx > 0.) {
    inside =
      1. - smoothstep(vec2(duty * .5) - aa, vec2(duty * .5) + aa, fromCentre);
  }
  float inPixel = inside.x * inside.y;

  // MAJOR GRID — graph paper. Every u_majorGrid'th line is drawn in a second
  // colour, so the field reads at two scales at once: the pixels, and the
  // blocks they are counted in.
  //
  // Same WIDTH as every other line, which is the one place this departs from
  // paper. Widening a major line would have to take that width out of the two
  // pixels beside it, and then a pixel next to a major line would be smaller
  // than one anywhere else — the exact fault the gutter above exists to avoid.
  // Its strength lives in the swatch's alpha instead, which is where a colour's
  // weight belongs.
  //
  // Counted from the lattice's own origin, which sits at the middle of the
  // frame, so the major lines stay put as the card is resized rather than
  // crawling in from an edge.
  float majorEvery = floor(max(u_majorGrid, 0.) + .5);
  float majorCover = 0.;
  if (majorEvery >= 1. && gridPx > 0.) {
    // Which boundary this fragment's line straddles. GLSL's mod() is
    // floor-based, so it lands in [0, n) on both sides of the origin — a raw
    // remainder would mirror the pattern about zero.
    vec2 onBoundary = floor(g + .5);
    vec2 isMajor = vec2(
      mod(onBoundary.x, majorEvery) < .5 ? 1. : 0.,
      mod(onBoundary.y, majorEvery) < .5 ? 1. : 0.
    );
    // The union of the two bands, so a crossing where only one of them is
    // major still reads as major rather than as a hole in the line.
    vec2 band = isMajor * (1. - inside);
    majorCover = 1. - (1. - band.x) * (1. - band.y);
  }
  // The two are disjoint by construction — the major band is a subset of the
  // line — so the minor is simply what is left, and neither has to be drawn
  // over the other.
  float minorCover = (1. - inPixel) - majorCover;

  // Premultiplied, back to front: ground, glow, movers, and the lattice LAST.
  vec3 color = u_colorBack.rgb * u_colorBack.a;
  float opacity = u_colorBack.a;

  // Glow next — light in front of the lattice, behind the pixel throwing it.
  //
  // Composited rather than ADDED, which is the tempting version. Additive light
  // breaks the premultiplied invariant (rgb <= a) the moment two blooms
  // overlap, and this layer is meant to be stackable over another shader. On
  // the dark ground it is drawn on the two are the same picture until it
  // saturates, and past saturation compositing is the one that stays honest.
  float glowAlpha = clamp(glow.a, 0., 1.);
  color = (glow.rgb / max(glow.a, 1e-4)) * glowAlpha + color * (1. - glowAlpha);
  opacity = glowAlpha + opacity * (1. - glowAlpha);

  // The movers, filling their WHOLE cell — the lattice is not cut out of them.
  //
  // Masking them to the clear square instead, which is how this worked at
  // first, makes the line a GAP: bare ground between the pixels, so a trail
  // comes apart into tiles floating on the background rather than reading as
  // one thing crossed by a grid. Letting the ink run under the line and drawing
  // the line over it hands the separating to the line's own OPACITY, which is
  // the thing that ought to be doing it — turn the swatch up and the pixels
  // divide, turn it down and they merge.
  //
  // The geometry is untouched by this. The pitch is still Pixel Size plus Grid
  // Width, so the clear span between two lines is still exactly Pixel Size and
  // the lattice still takes nothing away from it.
  //
  // Where two movers share a cell their colours are averaged by weight, which
  // is what dividing the accumulated tint back out does.
  float coreAlpha = clamp(core.a, 0., 1.);
  color = (core.rgb / max(core.a, 1e-4)) * coreAlpha + color * (1. - coreAlpha);
  opacity = coreAlpha + opacity * (1. - coreAlpha);

  // The lattice LAST, over the ground, the glow and the movers alike — one
  // continuous grid in front of the picture rather than a shape cut out of it.
  float gridAlpha = minorCover * u_colorGrid.a;
  color = u_colorGrid.rgb * gridAlpha + color * (1. - gridAlpha);
  opacity = gridAlpha + opacity * (1. - gridAlpha);

  float majorAlpha = majorCover * u_colorGridMajor.a;
  color = u_colorGridMajor.rgb * majorAlpha + color * (1. - majorAlpha);
  opacity = majorAlpha + opacity * (1. - majorAlpha);

  fragColor = vec4(color, opacity);
}`;
