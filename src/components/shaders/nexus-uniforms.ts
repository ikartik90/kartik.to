import { getShaderColorFromString } from "@paper-design/shaders";

// ---------------------------------------------------------------------------
// Nexus — friendly props in, GLSL uniforms out.
//
// A pure module for the same reason `cosmic-track-uniforms` is one: jsdom has
// no WebGL and every suite that renders a shader mocks the library wholesale,
// so the conversion is the only part of a shader this repo can assert on at a
// desk. The component stays a thin binding over a function that can.
// ---------------------------------------------------------------------------

/** Matches `uniform vec4 u_colors[8]` in the fragment shader. Keep in step. */
export const NEXUS_MAX_COLORS = 8;

/**
 * How far a glow may reach, in CELLS — and the shader's neighbourhood radius,
 * which is the reason there is a ceiling at all.
 *
 * A mover lives in a LANE (see the shader), and a fragment only evaluates the
 * lanes it could be lit by. The core of a mover is one cell wide, so that is
 * one lane per axis; a GLOW spills sideways into neighbouring lanes, and every
 * cell of reach is two more lanes to walk per axis, per fragment.
 *
 * 3 is where the arithmetic stops being free — seven lanes each way, times the
 * movers per lane — and it is already a bloom three cells wide, which on the
 * default ten-pixel pitch is thirty pixels of halo. Past that the look is a
 * blur, not a shader.
 *
 * The control's own range must not exceed it or the halo is silently CLIPPED at
 * the lane boundary, which reads as a square glow. `shader-specs.test.ts` has
 * no way to know that, so the range in `SHADER_SPECS` is written against this
 * constant rather than beside it.
 */
export const NEXUS_MAX_GLOW_REACH = 3;

/**
 * The floor on a pixel, in CSS pixels. Under one the lattice is finer than the
 * screen and every mover lands inside a single device pixel — the gutters
 * moiré, and the movers alias into noise. Not a taste call: there is nothing
 * left to resolve.
 */
const MIN_PIXEL_SIZE = 1;

export interface NexusParams {
  /**
   * The palette a mover is drawn from — each one hashes to a single stop and
   * keeps it for its whole life. Up to `NEXUS_MAX_COLORS`.
   *
   * A LIST, not a ramp: nothing here interpolates between two stops, because a
   * mover is one pixel and a pixel is one colour. So the count of colours is
   * the count of colours in the picture, exactly, and adding a swatch adds a
   * colour to the field rather than bending the ones already in it.
   */
  colors: string[];
  /** The ground the lattice is drawn on. Alpha 0 makes the layer stackable. */
  colorBack: string;
  /**
   * The MINOR lines' ink. Its ALPHA is the lattice's strength, and it is the
   * thing that separates one lit pixel from the next: the line is drawn OVER
   * the movers rather than cut out of them, so turning the alpha up divides
   * the pixels and turning it down merges them. That is why there is no
   * separate intensity control beside `gridWidth`, which owns only the width.
   *
   * Low is the point of it. The reference's grid is a hint that the movers are
   * travelling on something, not a drawing in its own right.
   */
  colorGrid: string;
  /**
   * The MAJOR lines' ink — every `majorGrid`'th one. Inert while `majorGrid` is
   * 0, which is the same bargain `cosmicTrack` strikes between `colorEdge` and
   * `edgeWidth`: the colour is not the switch.
   *
   * Its ALPHA is what separates the two scales, since both are drawn at the
   * same width. Reach for more of it, not for a different hue — graph paper
   * reads as one grid counted in blocks, and two colours read as two grids.
   */
  colorGridMajor: string;
  /**
   * The size of one PIXEL, in CSS pixels — so a 10 is a ten-by-ten pixel, and
   * on a 1.5× display it lands on fifteen device pixels and stays ten pixels
   * to the eye.
   *
   * The pixel, not the cell it sits in: `gridWidth` is added around it rather
   * than taken out of it, so this number keeps meaning the same thing however
   * wide the lattice is drawn.
   *
   * A SCREEN measurement, converted to the shader's own units against
   * `u_resolution` — which is what makes a pixel the same size on a phone and
   * on a lightbox rather than the grid getting finer as the card gets bigger.
   *
   * `scale` still scales it, and that is not a contradiction: the framing
   * controls move the CAMERA over the field, and a camera that zooms makes
   * everything in front of it bigger. The size named here is the size at
   * scale 1.
   */
  pixelSize: number;
  /**
   * How many movers are alive at once, across the whole frame.
   *
   * An absolute number rather than a density, so it means the same thing at
   * every cell size: turning the grid finer gives you smaller pixels, not more
   * of them. The shader divides it by the lanes a frame holds to get the odds
   * any one lane fires — see there — so it is an EXPECTED count, and the live
   * number breathes around it the way a random field does.
   *
   * It saturates rather than errors past what the lattice can hold (see
   * `NEXUS_SLOTS` in the shader): a lane carries at most two movers at a time,
   * so a coarse grid on a small card runs out of room before the slider does.
   */
  count: number;
  /**
   * WHICH movers, at the same count.
   *
   * Not a count of its own, which is the thing worth being clear about: the
   * indices a field spawns on come from hashing the lane against something, and
   * if `count` were the only thing hashed there would be exactly ONE
   * twenty-mover arrangement — the only way to see a different one would be to
   * ask for twenty-one, which is also a different number of movers.
   *
   * The field churns on its own (every mover dies and a fresh one takes its
   * slot), so this does not fix a layout so much as the whole sequence. Without
   * it two presets at the same count would run pixel-for-pixel identical for
   * ever.
   */
  seed: number;
  /**
   * How far a mover runs before it stops emitting, in CELLS.
   *
   * Not how long it is VISIBLE: when the head stops, the trail it has already
   * laid keeps fading, so the mover outlives its run by `tail`. That is the
   * difference between a comet and a light being switched off — and it is why
   * this is a distance rather than a lifetime.
   *
   * A mover that reaches the frame's edge before this simply leaves.
   */
  travel: number;
  /**
   * How far behind the head the trail is still lit, in CELLS. 0 leaves the head
   * alone on the grid.
   *
   * The same units as `travel` on purpose — the two are read against each
   * other, and a trail longer than the run is a mover that never fully forms.
   */
  tail: number;
  /**
   * Whether the trail fades CELL BY CELL or as one continuous gradient.
   *
   * 0 evaluates the fade at each cell's centre, so a cell is one flat value and
   * the trail steps down in whole pixels — the reference's look, and the reason
   * this shader draws a grid at all. 1 evaluates it where the fragment actually
   * is, so the tone varies across a pixel and meets its neighbours' without a
   * step.
   *
   * It moves the fade's VALUE only. WHICH CELLS are lit is decided at the
   * cell's centre whatever this is set to, so a lit pixel is a whole pixel at
   * every blend and the trail begins and ends on the lattice.
   *
   * That separation was not there at first, and the fault it caused is worth
   * recording: with the gates on the blended coordinate too, the trail's ends
   * landed wherever the head and the mover's own fractional spawn point fell —
   * never a cell boundary — so at 1 the band stopped half-way across a square
   * and slid along inside it as the head advanced. The pixels came out of
   * register with the grid, along the direction of travel and nowhere else.
   * Smoothing a fade and taking a trail off the lattice are two different acts.
   *
   * A SLIDER rather than a switch because the middle is a real setting: it
   * quantises part of the way, which reads as a stepped trail with its edges
   * softened rather than as either end.
   *
   * BOTH GLOWS follow it, and that is not a detail. A glow is cast by pixels,
   * so at 0 each pixel's halo carries that pixel's single value and the head's
   * bloom is centred on the head CELL. Left continuous while the trail beneath
   * it stepped — which is how this shipped first — the halo is a smooth
   * gradient laid over a stepped trail, and a smooth gradient is what the eye
   * reads: the trail stops looking like pixels fading in place and starts
   * looking like one gradient walking along behind the head. Only the falloff
   * itself stays continuous, since that is the bloom's shape rather than its
   * source.
   *
   * The head is a solid cell at every value. Only the fade behind it is in
   * question.
   */
  tailBlend: number;
  /**
   * How sharply the trail drops from one pixel to the next.
   *
   * 0 is a straight ramp: it loses 1/`tail` of its brightness per cell, so at
   * a tail of 14 the step between neighbours is 7% — and with `gridWidth` at 0
   * there is no edge between them either, so the trail reads as one bar with a
   * gradient on it rather than as pixels. Turning this up keeps a fixed
   * FRACTION of the cell in front instead, which makes that step the same all
   * along the trail and independent of how long the trail is.
   *
   * It shortens what you SEE without shortening `tail`: the curve still lands
   * on zero at exactly `tail` cells, it just spends most of its brightness in
   * the first few. Reach for `tail` to change the trail's length and for this
   * to change how much of it registers.
   */
  falloff: number;
  /** How bright the bloom around the HEAD is. 0 is a flat pixel. */
  headGlow: number;
  /**
   * How far that bloom reaches, in cells. Capped at `NEXUS_MAX_GLOW_REACH` —
   * past it the halo is clipped square rather than made larger.
   */
  headRadius: number;
  /**
   * How bright the bloom along the TRAIL is. Its own control rather than a
   * fraction of `headGlow` because the two answer different questions: a head
   * can flare over a trail that only barely glows, which is what a spark
   * looks like, and a trail can glow under a flat head, which is what a
   * light-pipe looks like.
   *
   * It is scaled by the trail's own fade, so the bloom dies with the ink rather
   * than outliving it.
   */
  tailGlow: number;
  /** How far the trail's bloom spreads either side of the line, in cells. */
  tailRadius: number;
  /**
   * How thick a grid line is, in CSS PIXELS — and the switch as well, since 0
   * is no lattice at all and the pixels touch.
   *
   * ADDED to the pitch, never taken out of the pixel, and that is the whole of
   * what makes the name honest. A line STROKED over a cell boundary takes its
   * width out of the two cells it divides, so turning the grid up would shrink
   * the pixels and `pixelSize` would stop naming the pixel. Here the cell is
   * `pixelSize + gridWidth` and the line is simply the space between one pixel
   * and the next, so widening it pushes them apart instead of eating them.
   *
   * It is also what makes a stepped trail read AS pixels. At 0 the lit cells of
   * a trail abut, and a run of them at neighbouring brightnesses is one bar
   * with a gradient on it — the eye has no edge to find. Open a line between
   * them and each cell is a separate square dimming in its own place, which is
   * the whole point of `tailBlend` 0.
   *
   * A screen measurement, like the pixel it separates — a line that halved on a
   * 2× display would be a different picture in an export than on the page.
   */
  gridWidth: number;
  /**
   * Every how-manieth line is drawn in `colorGridMajor` instead: graph paper.
   * 0 is off, and every line is the minor colour.
   *
   * A COUNT of cells, not a size, so the block it rules off grows with
   * `pixelSize` and the paper keeps its proportions as the grid coarsens.
   *
   * Counted from the lattice's own origin, which sits at the middle of the
   * frame — so the major lines stay where they are as the card is resized
   * rather than crawling in from an edge.
   *
   * Major lines are the same WIDTH as minor ones, which is the one place this
   * departs from paper. Widening them would have to take that width out of the
   * two pixels either side, and a pixel next to a major line would then be
   * smaller than one anywhere else — the exact fault `gridWidth` is added to
   * the pitch to avoid. Their weight lives in the swatch's alpha instead.
   */
  majorGrid: number;
  /**
   * How the run's speed is shaped, signed about a CONSTANT one.
   *
   * 0 is constant: the mover crosses at one rate and stops dead, which reads as
   * a packet. Toward 1 it decelerates into the end of its run, gliding to a
   * halt as its trail catches up — the sine `cosmicTrack` eases its turnarounds
   * on, re-pointed at a run that only goes one way. Toward -1 it does the
   * opposite and arrives fast.
   *
   * 1 is the default rather than the neutral 0, carried from cosmic track along
   * with the control.
   */
  easing: number;
  /**
   * Where the speed sits WITHIN the run — leaving fast and gliding in, or
   * easing away and arriving fast.
   *
   * Distinct from `easing`, which shapes the run symmetrically about its
   * middle. This is the one that makes the start differ from the end.
   *
   * The run keeps its length whatever this is set to: the warp integrates to
   * exactly 1 across it, so the control redistributes the time between the two
   * ends and never moves them.
   */
  easingBias: number;
}

export interface NexusUniforms {
  u_colors: [number, number, number, number][];
  u_colorsCount: number;
  u_colorBack: [number, number, number, number];
  u_colorGrid: [number, number, number, number];
  u_colorGridMajor: [number, number, number, number];
  u_pixelSize: number;
  u_count: number;
  u_seed: number;
  u_travel: number;
  u_tail: number;
  u_tailBlend: number;
  u_falloff: number;
  u_headGlow: number;
  u_headRadius: number;
  u_tailGlow: number;
  u_tailRadius: number;
  u_gridWidth: number;
  u_majorGrid: number;
  u_easing: number;
  u_easingBias: number;
}

/**
 * Google's four, plus the cyan the Nexus One's own live wallpaper ran on.
 *
 * Four colours and a dark ground is the reference read plainly: the movers are
 * the only saturated thing on the card, so they have to be able to sit beside
 * each other without any two of them reading as the same pixel.
 */
export const DEFAULT_NEXUS: NexusParams = {
  colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#00E5FF"],
  colorBack: "#080B12FF",
  colorGrid: "#A8C0FF29",
  colorGridMajor: "#A8C0FF5C",
  pixelSize: 8,
  count: 30,
  seed: 0,
  travel: 40,
  tail: 14,
  tailBlend: 0,
  falloff: 0.6,
  headGlow: 0.8,
  headRadius: 1.2,
  tailGlow: 0.4,
  tailRadius: 0.8,
  gridWidth: 2,
  majorGrid: 8,
  easing: 1,
  easingBias: 0,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function toNexusUniforms(params: NexusParams): NexusUniforms {
  const given = params.colors.slice(0, NEXUS_MAX_COLORS);
  // An empty list would leave every mover indexing an unset slot and drawing
  // black holes in the ground. A caller mistake should degrade to one colour,
  // not to a fault.
  const colors = given.length > 0 ? given : [params.colorGrid];

  const converted = colors.map(
    (color) =>
      getShaderColorFromString(color) as [number, number, number, number],
  );

  // The uniform slot is fixed-size, so the tail is padded — but `u_colorsCount`
  // reports the REAL count, or a mover's hash lands in the padding and the
  // palette silently gains a duplicate of its last stop.
  const padded = [...converted];
  while (padded.length < NEXUS_MAX_COLORS) {
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
    // Floored rather than clamped above: the ceiling is the panel's to choose
    // (and it is 10), but a cell finer than a device pixel is not a setting,
    // it is aliasing.
    u_pixelSize: Math.max(params.pixelSize, MIN_PIXEL_SIZE),
    // Floored at 0. Negative odds would fail every comparison in the shader and
    // empty the field, which reads as a broken shader rather than a still one.
    u_count: Math.max(params.count, 0),
    u_seed: params.seed,
    // Floored at one CELL. At zero the head has nowhere to go, so the mover
    // spawns and dies in place — and the run's length divides the progress, so
    // it would take the field with it.
    u_travel: Math.max(params.travel, 1),
    u_tail: Math.max(params.tail, 0),
    // A MIX factor, so it is clamped for the reason cosmic track clamps its
    // own: `mix` extrapolates, and past either end the fade is dragged beyond
    // both the arrangements it is blending between.
    u_tailBlend: clamp(params.tailBlend, 0, 1),
    // Clamped for the reason `tailBlend` is: the shader `mix`es the decay
    // between two constants with it, and `mix` extrapolates — past 1 the decay
    // goes under the hard end and past 0 it goes over 1, where the curve it
    // feeds is no longer a fade at all.
    u_falloff: clamp(params.falloff, 0, 1),
    u_headGlow: Math.max(params.headGlow, 0),
    // Capped at the shader's own lane reach. Past it the halo is not larger,
    // only clipped — and clipped square, which reads as a bug.
    u_headRadius: clamp(params.headRadius, 0, NEXUS_MAX_GLOW_REACH),
    u_tailGlow: Math.max(params.tailGlow, 0),
    u_tailRadius: clamp(params.tailRadius, 0, NEXUS_MAX_GLOW_REACH),
    u_gridWidth: Math.max(params.gridWidth, 0),
    // Rounded and floored: the shader counts lines with it, so a fractional
    // "every 3.5th" has no meaning, and a negative one would send `mod` looking
    // for a remainder in a range that runs backwards.
    u_majorGrid: Math.max(Math.round(params.majorGrid), 0),
    u_easing: clamp(params.easing, -1, 1),
    u_easingBias: clamp(params.easingBias, -1, 1),
  };
}
