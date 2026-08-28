import { PIXEL_COMETS_MAX_COLORS } from "./pixel-comets-uniforms";

// ---------------------------------------------------------------------------
// Pixel Comets — coloured pixels running the lanes of a lattice, each
// dragging a fading trail behind it. After the Nexus One's live wallpaper and
// the Nexus 4's pixel fields, which are where the name it carried while it was
// being built came from.
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
// What it costs is the cap below: a lane holds at most COMET_SLOTS movers at
// once. At any density the field is worth looking at, no one can see it.
// ---------------------------------------------------------------------------

export const pixelCometsMeta = {
  maxColorCount: PIXEL_COMETS_MAX_COLORS,
} as const;

export const pixelCometsFragmentShader = `#version 300 es
// HIGHP, where the rest of this repo's shaders are content with mediump.
//
// Everything here is placed by a hash, and a hash is precisely the operation
// that mediump ruins: it works by throwing away the high bits of a product, and
// a 10-bit mantissa has almost none to throw. Under mediump the lanes correlate
// into visible stripes and diagonals — the field stops looking random, which is
// the only thing it has to look like.
precision highp float;

uniform vec4 u_colors[${PIXEL_COMETS_MAX_COLORS}];
uniform float u_colorsCount;
uniform vec4 u_colorBack;
uniform vec4 u_colorGrid;
uniform vec4 u_colorGridMajor;

uniform float u_pixelSize;
uniform float u_count;
uniform float u_originMin;
uniform float u_originMax;
uniform float u_travelSpans;
uniform float u_parallax;
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
#define COMET_SLOTS 2

// The furthest a glow may reach, in cells — and so the widest neighbourhood a
// fragment walks. Must match PIXEL_COMETS_MAX_GLOW_REACH in the uniforms module, which
// is where the control's range is clamped against it: a radius past this is not
// a bigger halo, it is one clipped square at the lane boundary.
#define COMET_MAX_GLOW_LANES 3

// Cells per second at Speed 1. The mount has already scaled u_time by Speed, so
// this is the only place the shader has an opinion about pace — enough that a
// mover crosses a card in a couple of seconds, which is the reference's tempo.
#define CELLS_PER_SECOND 14.

// How much nearer than the far plane the nearest comet may come, at Parallax 1.
//
// Three, so the depths span one to four: the same cycle, four times the ground,
// and so four times the speed between the front of the field and the back. A
// ratio rather than a difference is what the eye reads as depth, and four to
// one is about where a field stops looking like one plane with a fast comet on
// it and starts looking like two.
#define PARALLAX_REACH 3.

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
#define COMET_DECAY_SOFT 0.995
#define COMET_DECAY_HARD 0.45

// ---------------------------------------------------------------------------
// Set once in main, read in addMover. Globals rather than more parameters on a
// function that already takes ten — these are constants of the FRAME, and
// threading them through per lane would say they varied.
//
// The run's own timing is NOT among them any more, and that is what the frame
// unit cost: a run measured against the frame is a different number of cells
// along a column than along a row, so it varies by AXIS and is passed in. See
// timingFor.
// ---------------------------------------------------------------------------
float g_tailCells;
float g_chance;
float g_decay;
float g_tailEnd;

// One axis's run, life and clock: (runCells, lifeCells, cycles).
//
// Per AXIS because Travel is a share of the FRAME and a frame is not always
// square: two half-frames down a tall card is more cells than two across it.
// Worked out twice in main rather than inside addMover, which a fragment calls
// up to twenty-eight times.
vec2 timingFor(float span) {
  // Floored at one CELL, which is where that floor lives now that the control
  // is not dialled in them. At zero the head has nowhere to go, so a mover
  // spawns and dies in place — and the run divides its progress, so the zero
  // would take the whole field with it rather than parking one mover.
  float run = max(u_travelSpans * span * .5, 1.);
  // The run, the drain, and ONE more cell.
  //
  // That last cell is the half at each end of the fade window, and without it
  // the cycle ends with the final pixel still lit — faintly, but it is switched
  // off rather than fading out, so every mover pops as it dies. The cost of
  // carrying it is that a cycle is one cell longer than the two controls name,
  // which nothing can see.
  // One cycle is one mover's whole life, at the FAR plane — parallax lengthens
  // a run without touching this, which is what lets a comet's depth be drawn
  // from the cycle it is born in. See addMover.
  //
  // u_time is already scaled by Speed at the mount, so this is seconds at
  // Speed 1.
  float life = run + g_tailCells + 1.;
  return vec2(run, u_time / max(life / CELLS_PER_SECOND, 1e-4));
}

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
//   slot       which of COMET_SLOTS movers in it.
//   alongStep  the fragment's position along the lane, snapped to its cell's
//   alongFree  centre, and where the fragment actually is. Both in cells;
//              u_tailBlend chooses between them.
//   perp       the fragment's offset from the lane's centre line, in cells.
//   onLane     1 only for the fragment's OWN lane. This is what keeps the
//              mover's core exactly one cell wide while its glow spills into
//              the neighbours being walked either side of it.
//   laneSpan   the frame's extent along this lane, in cells. Half of it is the
//              centre-to-edge distance, which is the unit the origin band and
//              the run are both dialled in.
//   timing     this axis's run at the far plane, and its clock — see timingFor.
// ---------------------------------------------------------------------------
void addMover(
  float axis, float lane, float slot,
  float alongStep, float alongFree, float perp, float onLane, float laneSpan,
  vec2 timing,
  inout vec4 core, inout vec4 glow
) {
  float cycles = timing.y;

  // No seed in the key. It used to carry one, so that two presets at the same
  // Count could not run pixel-for-pixel identical — and the control that fed it
  // is now the origin band, which is a measurement rather than a hash. What is
  // left is fixed: one Count is one arrangement, and the field churns through
  // that arrangement rather than through several.
  vec4 key = vec4(axis, lane, slot, 0.);

  // Each lane-slot keeps its own offset into the cycle, or the whole field
  // would fire in unison and read as a heartbeat rather than as weather.
  float ph = hash44(key * 1.7 + 11.3).x;
  float clock = cycles + ph;
  float cycle = floor(clock);
  float within = clock - cycle;

  // Re-drawn EVERY cycle, which is the difference between a slot and a mover: a
  // slot is a place a mover may be. So a lane that is empty now may fire next
  // time round, and the field churns at a fixed count rather than settling into
  // one arrangement and repeating it.
  vec4 h = hash44(key + vec4(cycle * 7.13));
  if (h.x >= g_chance) return;

  // PARALLAX. Each comet is handed a DEPTH, and a nearer one covers more ground
  // in the same cycle — same time, more distance, more speed. That is the whole
  // of it: nothing else about the comet changes, because nothing else can. A
  // head is one cell wide by construction, so the near plane cannot be drawn
  // bigger; the ratio between how fast two of them cross is the only depth cue
  // a lattice this rigid has, and it is the strongest one anyway.
  //
  // Never below 1. Travel names the FAR plane and parallax brings comets in
  // front of it; letting it push the other way would strand the slowest ones
  // inside the frame at the top of a slider whose whole promise is that they
  // leave.
  //
  // Drawn per CYCLE rather than per lane, so a column is not permanently near —
  // and that is only sound because the cycle is untouched by any of this (see
  // timingFor). Vary the RATE instead, which is the obvious way to write it, and
  // the draw becomes circular: the hash lives inside the cycle it would be
  // choosing, so the boundary moves under the number that moved it.
  //
  // A hash of its own rather than a fifth component of h, whose four are spent
  // on the fire test, the side, the distance and the colour. It is paid only by
  // comets that exist, being drawn after the test above.
  float depth = 1. + u_parallax * PARALLAX_REACH * hash44(key * 3.1 + vec4(cycle * 19.7 + 5.3)).y;
  float runCells = timing.x * depth;
  float lifeCells = runCells + g_tailCells + 1.;

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

  // How far the head has come. It runs PAST the run deliberately: the ink is
  // gated to the run below, so the overshoot is exactly the stretch where the
  // head is gone and the trail is still draining. That is what makes a mover
  // outlive its own run without anything having to remember that it did.
  float head = progress * lifeCells;

  // WHERE it is born, and which way it goes — one decision, not two.
  //
  // The side is a coin toss; how far out it lands is drawn from the band the
  // two Origin controls name, in half-frames (laneSpan * .5 is the centre to
  // the edge). Past 1 that puts the mover off the card, which is what the far
  // end of the band is for: it arrives from outside rather than appearing in
  // the middle of the picture.
  //
  // And it always marches BACK at the centre, which is why the direction is the
  // side negated rather than a second toss. Drawn independently — which is how
  // this worked at first — half of them ran outward from wherever they landed
  // and were never seen, so pushing the band outside the frame emptied the card
  // instead of filling it.
  float side = h.y < .5 ? -1. : 1.;
  float dir = -side;
  float start = side * mix(u_originMin, u_originMax, h.z) * laneSpan * .5;

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
  float onRun = step(-.5, toStep) * step(toStep, runCells + .5);
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
  float headAt = min(head, runCells);
  float headPos = start + dir * headAt;
  float headCell = mix(floor(headPos) + .5, headPos, u_tailBlend);
  // Taken out over the last cell of the run, so the head dims rather than
  // vanishing on a frame boundary.
  float alive = 1. - smoothstep(runCells, runCells + 1., head);
  // The head's bloom is the radial glow it always was, with MOTION BLUR on it:
  // the circle smeared along the track it has just come down. Inertia stretches
  // it opposite to the direction of travel, so the whole of the stretch lies
  // behind the comet and it reaches no further ahead than the bare circle ever
  // did.
  //
  // A CAPSULE, built the way the trail's bloom below is built and for the same
  // reason: the distance is taken to the nearest point of the smear rather than
  // to the head, which keeps the glow round at both ends and at full width
  // along the whole of it. That is what motion blur of a disc IS — the union of
  // every position it held over the exposure. Clamping in the head's own frame,
  // where the smear runs from -headStretch to 0, is what puts all of it behind:
  // the shape's widest section is a band running back from the head rather than
  // an axis through it, and the head sits at the leading cap.
  //
  // Only the ALONG-lane axis is stretched, and that is load-bearing rather than
  // tidy: the across-lane reach is what the fragment's neighbourhood walk is
  // sized against (see COMET_MAX_GLOW_LANES), so stretching THAT way would push
  // the bloom past the lanes being walked and clip it square at the boundary.
  // Along the lane it costs nothing at all — a fragment already asks every mover
  // in its own lane whatever their distance along it.
  //
  // How far it smears is DIALLED, in cells, and not derived from how fast the
  // comet is going. Speed is the honest reading of an exposure and it was tried
  // here; what it costs is a length nothing on the panel names, drifting with
  // Parallax and Travel, so the one thing you cannot do is set the streak you
  // want and keep it. This is a look, and a look is dialled.
  //
  // And it FADES along the smear, which a true exposure would NOT: a uniform
  // pass over the same ground is uniformly bright, so the honest capsule is a
  // bar with a cap on each end however long you make it. What is being drawn
  // here is inertia letting go, not a shutter left open.
  //
  // The fade scales the RADIUS as well as the brightness, and that is the whole
  // difference between a comet and a bar. Dimming does not narrow: with the
  // width held, the silhouette stays even until the light drops under the eye's
  // floor and then stops, so it reads as a bar that ends rather than a glow
  // that runs out. It is the fault the trail's own bloom below was caught with,
  // and it is fixed here the same way — see the taper there.
  float ahead = dir * (alongFree - headCell);
  float alongToHead = ahead - clamp(ahead, -u_headStretch, 0.);
  float back = clamp(-ahead, 0., u_headStretch);
  float fadeBack = 1. - back / max(u_headStretch, 1e-4);
  float toHead = length(vec2(perp, alongToHead)) / max(u_headRadius * fadeBack, 1e-4);
  float headLit = u_headGlow * alive * fadeBack * pow(max(1. - toHead, 0.), 2.);

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
  float lit1 = min(runCells + .5, head + .5) - alive;

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
  // rather than an edge. Only the movers are held to it — they are born a
  // measured distance from its centre (see the origin band in addMover) — since
  // a count has to be a count of something.
  vec2 frame = (2. * u_resolution / longEdge) / cell;
  float lanes = max(frame.x + frame.y, 1.);

  g_tailCells = max(u_tail, 0.);

  // One per axis: a column's lane runs the frame's height, a row's its width.
  vec2 downTiming = timingFor(frame.y);
  vec2 acrossTiming = timingFor(frame.x);

  // The trail's curve — see trailFade. Both of these are constant over the
  // frame, and the pow() for the end point is the reason they are hoisted: it
  // would otherwise be paid once per lane per fragment for a number that never
  // varies.
  g_decay = mix(COMET_DECAY_SOFT, COMET_DECAY_HARD, clamp(u_falloff, 0., 1.));
  g_tailEnd = pow(g_decay, max(g_tailCells, 1e-4));

  // Count is a number of MOVERS, so it is shared out over the slots a frame
  // holds — then corrected for the spawn band reaching outside the frame, which
  // leaves a mover on screen for only part of its life.
  //
  // The correction is the band's OUTER reach, floored at the frame itself: a
  // band that stays inside the card has every mover on screen for the whole of
  // its run and wants no correction, and one reaching two half-frames out
  // leaves each mover visible for about half of it. A constant stood here while
  // the spawn box was fixed. It cannot now, or Count would mean a different
  // number of visible comets at every setting of the band.
  //
  // It saturates rather than failing: past what the lattice can hold every lane
  // fires every cycle and the field is as dense as it gets.
  g_chance = clamp(
    u_count * max(u_originMax, 1.) / (float(COMET_SLOTS) * lanes),
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
  int span = int(clamp(ceil(reach), 0., float(COMET_MAX_GLOW_LANES)));

  vec4 core = vec4(0.);
  vec4 glow = vec4(0.);

  for (int d = -span; d <= span; d++) {
    float onLane = d == 0 ? 1. : 0.;
    float column = base.x + float(d);
    float row = base.y + float(d);

    for (int s = 0; s < COMET_SLOTS; s++) {
      float slot = float(s);
      // Movers running along Y, in the columns either side of this fragment.
      addMover(0., column, slot,
        base.y + .5, g.y, g.x - (column + .5), onLane, frame.y, downTiming,
        core, glow);
      // Movers running along X, in the rows either side of it.
      addMover(1., row, slot,
        base.x + .5, g.x, g.y - (row + .5), onLane, frame.x, acrossTiming,
        core, glow);
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
