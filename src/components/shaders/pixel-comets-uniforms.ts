import { getShaderColorFromString } from "@paper-design/shaders";

// ---------------------------------------------------------------------------
// Pixel Comets — friendly props in, GLSL uniforms out.
//
// A pure module for the same reason `cosmic-track-uniforms` is one: jsdom has
// no WebGL and every suite that renders a shader mocks the library wholesale,
// so the conversion is the only part of a shader this repo can assert on at a
// desk. The component stays a thin binding over a function that can.
// ---------------------------------------------------------------------------

/** Matches `uniform vec4 u_colors[8]` in the fragment shader. Keep in step. */
export const PIXEL_COMETS_MAX_COLORS = 8;

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
export const PIXEL_COMETS_MAX_GLOW_REACH = 3;

/**
 * The floor on a pixel, in CSS pixels. Under one the lattice is finer than the
 * screen and every mover lands inside a single device pixel — the gutters
 * moiré, and the movers alias into noise. Not a taste call: there is nothing
 * left to resolve.
 */
const MIN_PIXEL_SIZE = 1;

export interface PixelCometsParams {
  /**
   * The palette a mover is drawn from — each one hashes to a single stop and
   * keeps it for its whole life. Up to `PIXEL_COMETS_MAX_COLORS`.
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
   * `COMET_SLOTS` in the shader): a lane carries at most two movers at a time,
   * so a coarse grid on a small card runs out of room before the slider does.
   */
  count: number;
  /**
   * The band of distances from the CENTRE a mover may be born in, measured in
   * HALF-FRAMES along its own lane: 0 is the centre, 1 is the frame's edge, 2
   * is half a frame beyond it.
   *
   * Half-frames rather than cells, and it is the one measurement here that
   * could not have been in cells. A cell is a fixed size on screen, so the
   * distance to the frame's edge is a different number of them at every Pixel
   * Size and on every card — and "born outside the frame" is exactly the
   * setting this control exists to offer. Against the frame it is 1, always.
   *
   * The two ends are not sorted. `mix` covers the same band either way round,
   * which is what lets a min be dragged past its max without the field
   * collapsing while the slider is in flight.
   *
   * A distance and not a position: which side of the centre a mover appears on
   * is the shader's own coin toss, and whichever side it is, the mover marches
   * BACK at the centre. That is why raising the far end reads as a field
   * converging on the middle rather than as one drifting across it.
   */
  originMin: number;
  originMax: number;
  /**
   * How far a mover runs before it stops emitting, in the same HALF-FRAMES.
   *
   * Not how long it is VISIBLE: when the head stops, the trail it has already
   * laid keeps fading, so the mover outlives its run by `tail`. That is the
   * difference between a comet and a light being switched off — and it is why
   * this is a distance rather than a lifetime.
   *
   * The frame unit is what makes the top of this control mean something. In
   * cells the same setting crossed the card at one Pixel Size and stranded a
   * mover in mid-air at another; here 2 is edge to edge whatever the lattice is
   * doing, and the panel's ceiling is set so that a mover born at the furthest
   * origin still leaves by the far side.
   *
   * `tail` is still in CELLS, and deliberately so: a trail is a handful of
   * pixels, which is a fact about the lattice rather than about the frame. The
   * two used to share a unit and be read against each other; they no longer
   * can, because they are no longer the same kind of measurement.
   */
  travelSpans: number;
  /**
   * How much the comets' speeds are spread apart, 0 for one flat plane.
   *
   * Each comet is handed a DEPTH and a nearer one covers more ground in the
   * same cycle, which is a comet moving faster. Nothing else about it changes:
   * a head is one cell wide by construction, so the near plane cannot be drawn
   * bigger, and the ratio between two crossing times is the only depth cue a
   * lattice this rigid has. It is also the strongest — parallax is what the eye
   * reads depth from when everything else is held equal.
   *
   * It only ever brings a comet NEARER: `travelSpans` names the far plane, and
   * spreading the other way would leave the slowest stranded inside the frame
   * at a Travel whose whole promise is that they leave.
   *
   * The field thins a little as this rises, and the reason is the effect
   * working: a nearer comet crosses sooner, so it spends less of its life on
   * the card. `count` is the dial for that. It is deliberately NOT corrected
   * for here — how much of a run lands on screen depends on `travelSpans` too,
   * so a correction would overshoot at a short run as badly as it helped at a
   * long one.
   */
  parallax: number;
  /**
   * How likely a comet is to change lane rather than run through the tail of
   * the other comet in its own. 0 for none, and free rather than merely
   * invisible — the shader skips the whole search.
   *
   * It steps ONE lane, left or right at random, at the cell its head was on
   * when it got halfway into the other's tail, and finishes its run there. The
   * trail bends at that cell rather than moving across with the head: the ink
   * already laid keeps the lane it was laid in.
   *
   * Its own lane's other slot is the only comet it can catch, and that is what
   * makes it affordable rather than a search — they share an axis and a lane,
   * and a lane carries at most two. A trail crossing perpendicular belongs to
   * some other lane, and nothing bounds which, so finding one would mean
   * sweeping every lane along the run for every comet at every fragment.
   *
   * WHERE it switches is sampled at four points along the run rather than
   * solved for. A trail here is derived, not remembered, so "the instant it
   * first got halfway in" is a question about when, and with `easing` on the
   * motion has no analytic inverse.
   */
  swerve: number;
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
   * 0 is NO drop: every cell of the trail is as opaque as the head's, and it
   * ends where `tail` says it ends. Turning this up keeps a fixed FRACTION of
   * the cell in front, which makes the step from one pixel to the next the same
   * all along the trail and independent of how long the trail is.
   *
   * It shortens what you SEE without shortening `tail`: the trail is `tail`
   * cells long at every setting, and this decides how many of them are still
   * bright enough to read. Reach for `tail` to change the length and for this
   * to change how much of it registers.
   *
   * The trail's END is a hard one at 0, necessarily — a trail that does not
   * fade has to stop. From about a third up, the curve is already at a few per
   * cent by the time it reaches the last cell and there is nothing to see.
   */
  falloff: number;
  /** How bright the bloom around the HEAD is. 0 is a flat pixel. */
  headGlow: number;
  /**
   * How far that bloom reaches, in cells. Capped at `PIXEL_COMETS_MAX_GLOW_REACH` —
   * past it the halo is clipped square rather than made larger.
   */
  headRadius: number;
  /**
   * How far the head's bloom is smeared BACKWARDS, in cells, at the far plane.
   * 0 is the bare radial glow.
   *
   * Motion blur on a radial glow, which is what a moving body's light does:
   * inertia drags the circle out opposite to the direction of travel. The shape
   * is the union of every position the circle held over the exposure — a
   * capsule, round at both ends, with the head at its leading cap — so it
   * reaches no further AHEAD than the bare circle ever did, and everything the
   * control adds goes behind.
   *
   * DIALLED, not derived from how fast the comet is going. Speed is the honest
   * reading of an exposure and it was written that way first; what it costs is
   * a streak length nothing on the panel names, drifting with `parallax` and
   * `travelSpans`, so the one thing you cannot do is set the look you want and
   * keep it.
   *
   * `headRadius` keeps naming the half-width ACROSS the lane and only the
   * along-lane axis stretches, which is not merely a choice about which number
   * means what. The across-lane reach is what the shader's neighbourhood walk is
   * sized against — see `PIXEL_COMETS_MAX_GLOW_REACH` — so stretching that way
   * would push the bloom past the lanes being walked and clip it square. Along
   * the lane it is free.
   */
  headStretch: number;
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

export interface PixelCometsUniforms {
  u_colors: [number, number, number, number][];
  u_colorsCount: number;
  u_colorBack: [number, number, number, number];
  u_colorGrid: [number, number, number, number];
  u_colorGridMajor: [number, number, number, number];
  u_pixelSize: number;
  u_count: number;
  u_originMin: number;
  u_originMax: number;
  u_travelSpans: number;
  u_parallax: number;
  u_swerve: number;
  u_tail: number;
  u_tailBlend: number;
  u_falloff: number;
  u_headGlow: number;
  u_headRadius: number;
  u_headStretch: number;
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
export const DEFAULT_PIXEL_COMETS: PixelCometsParams = {
  colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#00E5FF"],
  colorBack: "#080B12FF",
  colorGrid: "#A8C0FF29",
  colorGridMajor: "#A8C0FF5C",
  pixelSize: 8,
  count: 30,
  originMin: 0,
  originMax: 2,
  travelSpans: 1.5,
  parallax: 0,
  swerve: 1,
  tail: 14,
  tailBlend: 0,
  falloff: 0.6,
  headGlow: 0.8,
  headRadius: 1.2,
  headStretch: 2,
  tailGlow: 0.4,
  tailRadius: 0.8,
  gridWidth: 2,
  majorGrid: 8,
  easing: 1,
  easingBias: 0,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function toPixelCometsUniforms(params: PixelCometsParams): PixelCometsUniforms {
  const given = params.colors.slice(0, PIXEL_COMETS_MAX_COLORS);
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
  while (padded.length < PIXEL_COMETS_MAX_COLORS) {
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
    // Floored at the centre, not sorted. A distance from the centre has no
    // sign — the side is the shader's coin toss — so a negative here would be
    // the same band written backwards; and the two ends are left in whatever
    // order they came in because `mix` spans them either way.
    u_originMin: Math.max(params.originMin, 0),
    u_originMax: Math.max(params.originMax, 0),
    // Floored at nothing rather than at one cell. How many cells a run is
    // worth is not known until the frame is, so the one-cell floor — without
    // which the head has nowhere to go and the run's length divides the
    // progress to nothing — moved into the shader, where the frame is.
    u_travelSpans: Math.max(params.travelSpans, 0),
    // Floored at a flat field. Below zero the spread runs the wrong way and a
    // depth can reach nought, which is not a slow comet but a run of no length
    // at all. No ceiling — past 1 the near plane simply comes nearer.
    u_parallax: Math.max(params.parallax, 0),
    // Clamped BOTH ways, unlike the floors around it: it is read as odds
    // against a hash, so past 1 there is nothing further to buy and under 0 the
    // comparison can only fail. 0 is the field running straight through itself,
    // and the shader skips the search entirely there.
    u_swerve: clamp(params.swerve, 0, 1),
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
    u_headRadius: clamp(params.headRadius, 0, PIXEL_COMETS_MAX_GLOW_REACH),
    // Floored at no smear, which is the bare radial glow and a real setting. A
    // negative one would clamp against a segment running the wrong way and put
    // the blur in FRONT of the comet, which is the one direction inertia cannot
    // throw it. No ceiling, and no cap against the glow reach either: that cap
    // guards the LANE WALK, which only the across-lane radius can outrun — see
    // the bloom itself.
    u_headStretch: Math.max(params.headStretch, 0),
    u_tailGlow: Math.max(params.tailGlow, 0),
    u_tailRadius: clamp(params.tailRadius, 0, PIXEL_COMETS_MAX_GLOW_REACH),
    u_gridWidth: Math.max(params.gridWidth, 0),
    // Rounded and floored: the shader counts lines with it, so a fractional
    // "every 3.5th" has no meaning, and a negative one would send `mod` looking
    // for a remainder in a range that runs backwards.
    u_majorGrid: Math.max(Math.round(params.majorGrid), 0),
    u_easing: clamp(params.easing, -1, 1),
    u_easingBias: clamp(params.easingBias, -1, 1),
  };
}
