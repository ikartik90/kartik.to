import {
  ROTATION_MAX,
  ROTATION_MIN,
  ROTATION_STEP,
} from "@/utils/rotation";

/**
 * The Phase dial: a QUARTER turn of deflection either way, on the same 15°
 * stops the Rotation control uses.
 *
 * Its own constants rather than rotation's, and the difference is the point.
 * Phase is a signed DISTANCE along the track dialled in degrees so that it
 * reads like a dial — but the run does not repeat, so a ±180 range would imply
 * a full turn and invite the reading that its two ends are the same place. They
 * are opposite ends of the track. ±90 says deflection either way from
 * square-on, which is true of it.
 *
 * Not imported from `@/utils/rotation` for the same reason: that module is the
 * app's one ROTATION control, and phase is not one. The shared 15 is written
 * again here deliberately — the two dials snap alike because that reads well,
 * not because one is the other.
 *
 * The degrees convert to track units in exactly one place, on the way to the
 * uniform — see `TRACK_UNITS_PER_DEGREE`.
 */
export const PHASE_MIN = -90;
export const PHASE_MAX = 90;
export const PHASE_STEP = 15;

// ---------------------------------------------------------------------------
// The shader playground's table of contents.
//
// TWO entries now, both ours. It carried five of the library's built-ins
// alongside them for a while — the playground began as an audition, pointing
// each of them at the reference art (the Windsurf card backgrounds: fanned
// light-blades, soft colour washes) to see which came closest. Cosmic Track is
// what that audition produced, so the built-ins have gone: a picker offering
// five shaders no preset uses is a menu of dead ends, and their control tables
// were five more things to keep parsing.
//
// The SHAPE is what everything downstream reads, and the second shader is what
// proved it was worth keeping through the year it held one: `ShaderId` is a
// union and `SHADER_SPECS` a record over it, so the domain schema, the store
// and the stage all ask the table rather than assuming the answer. Nexus cost
// one entry here, one `case` in `shader-stage.tsx`, and nothing else.
//
// A table rather than a page full of hand-written rows, for the same reason
// `media-properties-panel.tsx` uses one: the rows differ only in their four
// numbers, and spelling them out invites the ranges to drift from the shader
// they describe.
//
// A shader's `defaults` are a STARTING POINT, not a match. They put you in the
// right neighbourhood of the reference card; the page exists because the last
// mile is eyeballing, not arithmetic.
// ---------------------------------------------------------------------------

export type ShaderId = "cosmicTrack" | "nexus";

/**
 * Which group in the sidebar a control is drawn in. Omitted — the usual case —
 * leaves it with the shader's own parameters.
 *
 * "edge" is for the rails: how wide the line is, how sharply the fill it traces
 * ends, and how far the line outlives that fill. The rails' COLOUR is not one of
 * them — a colour belongs with the colours, and what these three share is the
 * line rather than its ink.
 *
 * "motion" is for a control that shapes what MOVES. The shared block below owns
 * the one control every animated shader has — its speed — and this is how a
 * shader whose GLSL is ours adds timing of its own to the same group without
 * pretending it is shared: the built-ins come from the library as finished
 * programs, so a uniform we invented exists in exactly one of them.
 *
 * "dither" is for the ordered-dither controls, which are one mechanism read
 * three ways: two strengths over a single Bayer matrix, and the cell size that
 * matrix is sampled at. Left among the geometry sliders, only their names said
 * they had anything to do with each other — and the size, which both strengths
 * read, sat as far from them as any unrelated control.
 *
 * "ramp" is for where the colours SIT along the track and how they are shared
 * out between the bands. It draws next to the colours themselves, because the
 * ramp is those colours laid along the fan — leaving Parameters to hold the
 * fan's own geometry, which the ramp is drawn on but does not decide.
 *
 * "grid" is for the LATTICE a shader draws on rather than for what it draws:
 * how big a cell is, how heavy the line between cells is. Its ink is not one of
 * them, for the same reason the rails' colour is not an "edge" control.
 *
 * "glow" is for bloom — how bright it is and how far it reaches. Its own group
 * because a shader that blooms two different things wants both strengths beside
 * both reaches, and split across Parameters they read as four unrelated
 * sliders that happen to share two words.
 */
export type ControlGroup =
  | "dither"
  | "edge"
  | "glow"
  | "grid"
  | "motion"
  | "ramp";

export interface SliderSpec {
  kind: "slider";
  key: string;
  label: string;
  group?: ControlGroup;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface ToggleSpec {
  kind: "toggle";
  key: string;
  label: string;
  group?: ControlGroup;
  value: boolean;
}

export interface SelectSpec {
  kind: "select";
  key: string;
  label: string;
  group?: ControlGroup;
  options: { value: string; label: string }[];
  value: string;
}

export type ControlSpec = SliderSpec | ToggleSpec | SelectSpec;

export type ParamValue = number | boolean | string;
export type Params = Record<string, ParamValue>;

/** A colour the shader takes that is not part of its `colors` ramp. */
export interface ExtraColorSpec {
  key: string;
  label: string;
  value: string;
  /**
   * Which control ROW this colour draws on. Extras naming the same row share
   * one row and one swatch grid, in table order, under the FIRST of their
   * labels; an extra naming none keeps a row to itself.
   *
   * For colours that are one decision in two parts — a lattice's minor and
   * major ink — where a row each would state they were unrelated, and spend a
   * label and a line of the panel doing it.
   */
  row?: string;
}

/** One drawn row of extra colours — see `ExtraColorSpec.row`. */
export interface ExtraColorRow {
  /** The row's visible label, which is its first colour's. */
  label: string;
  colors: ExtraColorSpec[];
}

/**
 * A shader's extra colours as the panel draws them: one entry per row, in the
 * order the table names them.
 *
 * Here rather than in the panel because it is a reading of the TABLE, and the
 * table is the thing every surface asks rather than assuming — the same reason
 * `defaultState` lives here. A row is a fact about the shader's colours, not
 * about the sidebar that happens to show them.
 */
export function extraColorRows(spec: ShaderSpec): ExtraColorRow[] {
  const rows: ExtraColorRow[] = [];
  const byName = new Map<string, ExtraColorRow>();

  for (const extra of spec.extraColors) {
    const existing = extra.row === undefined ? undefined : byName.get(extra.row);
    if (existing) {
      existing.colors.push(extra);
      continue;
    }
    const row: ExtraColorRow = { label: extra.label, colors: [extra] };
    rows.push(row);
    if (extra.row !== undefined) byName.set(extra.row, row);
  }

  return rows;
}

/** Where a shader's controls open — one starting point per shader. */
export interface ShaderDefaults {
  colors: string[];
  /** Required exactly when the shader has a `colorBack`; see the spec table test. */
  colorBack?: string;
  /** Only the controls this shader wants moved off their own default. */
  params?: Params;
  extraColors?: Record<string, string>;
}

export interface ShaderSpec {
  id: ShaderId;
  label: string;
  /**
   * The heading the shader's OWN parameters are drawn under — the ones that
   * name no group, and so are whatever this shader is made of.
   *
   * Per shader because the group has no shader-independent name. It read
   * "Track" while the table held one entry, which was right for the fan and
   * meaningless over Nexus's lattice; "Parameters" would be right for both and
   * describe neither, and this panel is the one place a shader gets to say what
   * its parts are called.
   */
  ownLabel: string;
  /** The shader's own `maxColorCount`. */
  maxColors: number;
  /** False for the mesh gradients, which are opaque fills with no background. */
  hasColorBack: boolean;
  extraColors: ExtraColorSpec[];
  controls: ControlSpec[];
  defaults: ShaderDefaults;
}

// How the graphic is FRAMED in the preset — the four sizing props that visibly
// move it. Spread LAST into each control table so a shader's own parameters
// read first and the framing sits together at the foot of the sidebar wherever
// you are.
//
// They belong to every shader equally, which is why they are one array spread
// six times rather than six copies — and it is also why a preset STORES them
// apart from the rest: these four are the only controls whose right value
// depends on the shape the preset is being looked at in, so a preset keeps one
// set per aspect ratio rather than one set full stop. `spec.controls` stays the
// complete list of what a shader takes; where each value lives is
// `@/domain/shader-preset`'s to decide, and `shaderParamsFor` is what puts the
// two back together on the way to the canvas.
//
// The rest of `ShaderSizingParams` is deliberately absent. `fit` and the world
// box (`worldWidth`/`worldHeight`, and the `originX`/`originY` that only
// position that box) describe how the shader's coordinate space maps onto a
// canvas — and here the preset IS the canvas, pinned at `fit="cover"` by the
// page so the ground has no margins. Left at the canvas size, origin and world
// size do nothing you can see; `fit: none` against a zero-size world collapses
// the box to a pixel and renders nothing at all. Controls whose only settings
// are "no change" and "broken" are not properties of the shader worth showing.
export const FRAMING_CONTROLS: ControlSpec[] = [
  { kind: "slider", key: "scale", label: "Scale", min: 0.01, max: 4, step: 0.1, value: 1 },
  // SIGNED, about a zero in the middle of the track, rather than 0..360. The
  // control names a turn away from square-on, and which way you turned is the
  // thing you are choosing — under 0..360 one of the two directions was only
  // reachable by running the slider almost all the way to the far end, and the
  // neutral setting sat on the boundary where the two ends meet. Covers saved
  // under the old range are carried across by `@/domain/shader-preset`, since
  // 270 and -90 are the same angle.
  // Range and step from the app's ONE rotation control, not written out here:
  // a preset tuned in this playground is reused as a background elsewhere, and
  // a panel offering different stops would make a preset unreachable in the
  // surface it was built for. See `@/utils/rotation`.
  { kind: "slider", key: "rotation", label: "Rotation", min: ROTATION_MIN, max: ROTATION_MAX, step: ROTATION_STEP, value: 0 },
  { kind: "slider", key: "offsetX", label: "Offset X", min: -1, max: 1, step: 0.1, value: 0 },
  { kind: "slider", key: "offsetY", label: "Offset Y", min: -1, max: 1, step: 0.1, value: 0 },
];

// Spread ONLY into a shader whose fragment shader actually samples `u_time`.
// The library types accept `speed` on every component — they all extend
// `ShaderMotionParams` — but StaticMeshGradient's fragment shader contains no
// reference to `u_time` at all, so the value travels all the way to the mount
// and changes nothing. A slider that cannot move what it names is worse than a
// missing one: it reads as a broken shader rather than as a still one.
//
// Zero is not just "slow": the library cancels the rAF entirely at 0, so a
// parked shader costs nothing per frame. Worth leaving here at rest.
const MOTION_CONTROLS: ControlSpec[] = [
  { kind: "slider", key: "speed", label: "Speed", min: 0, max: 5, step: 0.1, value: 0 },
];

/**
 * The keys of the two shared blocks, in order — the sidebar reads these to
 * split a shader's OWN parameters from the framing and the motion. Arrays
 * rather than sets: they are also the order the groups render in.
 */
export const FRAMING_CONTROL_KEYS: string[] = FRAMING_CONTROLS.map(
  (control) => control.key,
);

export const MOTION_CONTROL_KEYS: string[] = MOTION_CONTROLS.map(
  (control) => control.key,
);

export const SHADER_SPECS: Record<ShaderId, ShaderSpec> = {
  // Ours, and now the only one: a shader we are BUILDING rather than one we
  // are auditing, which is why its control table is the long one — every
  // uniform its GLSL takes is a decision still being made, and the sliders are
  // how it gets made.
  cosmicTrack: {
    id: "cosmicTrack",
    label: "Cosmic Track",
    ownLabel: "Track",
    maxColors: 10,
    hasColorBack: true,
    // The rails are painted in a colour of their OWN rather than lifted out of
    // the ramp. Borrowing the ramp tied the line to whatever the band happened
    // to be showing under it — and the ramp peaks at its lightest colour in the
    // middle of every band, so the rails blew out to white there while staying
    // tinted at the ends, which reads as a fault rather than a decision.
    extraColors: [{ key: "colorEdge", label: "Edge", value: "#FFFFFFFF" }],
    controls: [
      // How thick a rail is drawn, in CSS pixels — and the switch as well, since
      // 0 is no line at all. One control rather than a toggle beside a width:
      // a switch that only ever gates another control is a step the value can
      // take on its own, and two of them can disagree (on at zero thickness) in
      // a way one cannot.
      //
      // A screen measurement rather than a track one, so it holds its weight
      // where Tilt and Depth crush the far end of the track instead of thinning
      // away with what it traces.
      //
      // Drawn with the other EDGE controls — see `group`. Not beside the swatch
      // it shares a name with: a colour belongs with the colours, and what this
      // has in common with Softness and Edge Tail is the line itself.
      { kind: "slider", key: "edgeWidth", label: "Edge Width", group: "edge", min: 0, max: 4, step: 0.1, value: 0 },
      // Slides every band along the track at once. 0 parks the set at the
      // frame's centre and -Apex puts it exactly on the apex, so the range has
      // to cover Apex's own (0..5) with room for a band's length either side,
      // or the far lobe is unreachable at a high Apex.
      { kind: "slider", key: "phaseDegrees", label: "Phase", group: "ramp", min: PHASE_MIN, max: PHASE_MAX, step: PHASE_STEP, value: 0 },
      // How far Speed swings the set either side of Phase. Motion oscillates
      // out and back rather than drifting one way, so the bands always return.
      { kind: "slider", key: "travel", label: "Travel", group: "ramp", min: 0, max: 4, step: 0.1, value: 1.5 },
      // The swing's timing CURVE, drawn with Speed rather than here — how far
      // it goes is a shape decision, how it gets there is a motion one.
      //
      // Signed about a linear swing: 0 is constant speed and a reversal on the
      // spot, positive eases OUT of each sweep (decelerating into the end),
      // negative eases IN. 1 is the sine this animated on before the control
      // existed, which is why it defaults there rather than to the neutral
      // middle — see `cosmic-track-uniforms`.
      // How long the set rests at each end before starting back, in sweep
      // lengths. Taken out of the half-cycle rather than added to it, so the
      // cadence stays Speed's and only the crossing gets brisker.
      { kind: "slider", key: "interval", label: "Interval", group: "motion", min: 0, max: 2, step: 0.1, value: 0 },
      { kind: "slider", key: "easing", label: "Easing", group: "motion", min: -1, max: 1, step: 0.1, value: 1 },
      // Where the speed sits within a sweep across the track. Easing shapes each
      // sweep symmetrically; this is the one that makes a sweep's start differ
      // from its end — positive pushes off fast and glides in, negative eases
      // away and arrives fast. It inverts with the direction of travel, so the
      // way back leans the same way relative to where it is going.
      { kind: "slider", key: "easingBias", label: "Easing Bias", group: "motion", min: -1, max: 1, step: 0.1, value: 0 },
      // The gap between one band and the next. At 0 they advance as one flat
      // front; turning it up is what produces the reference's staircase.
      { kind: "slider", key: "stagger", label: "Stagger", group: "ramp", min: -2, max: 2, step: 0.1, value: 0.45 },
      // Which band the staircase is measured from, at the same step size — the
      // control walks the LEADER across the stack. 1 runs it straight down from
      // the first band; 0 mirrors it about the middle band, so the outermost
      // pair share an offset and the stagger grows from the centre outward; -1
      // carries the walk on to the last band and the stack runs the other way.
      { kind: "slider", key: "symmetry", label: "Symmetry", group: "ramp", min: -1, max: 1, step: 0.1, value: 1 },
      // How far a band's single gradient spans along the track. Beyond its two
      // ends the track carries ground, not another copy of the palette.
      { kind: "slider", key: "rampLength", label: "Length", group: "ramp", min: 0.05, max: 10, step: 0.1, value: 1.6 },
      // The gap between adjacent ribbons, measured in RIBBON WIDTHS — 0 is
      // touching, 1 puts a ribbon's worth of ground between them, 2 puts two.
      // It widens the stack to make room rather than thinning the ribbons, so
      // Bandwidth below owns how wide a ribbon is and this owns only how far
      // apart they sit. Past the top of the range the outermost ribbons pass
      // the fan's own silhouette and are clipped by it.
      { kind: "slider", key: "spread", label: "Spread", min: 0, max: 3, step: 0.1, value: 0.25 },
      // How WIDE each ribbon is — the stack's width at Spread 0, shared out
      // between Band Count ribbons that sit edge to edge there. Independent of
      // Spread, which only adds ground around them.
      { kind: "slider", key: "bandwidth", label: "Bandwidth", min: 0, max: 1, step: 0.1, value: 0.7 },
      // How the ribbons meet, and — the same thing — the track's HALF-WIDTH at
      // the apex, in the same units as its width anywhere else. 0 is a true
      // point; raising it opens the convergence into a curve and widens the
      // waist with it. The range runs well past the frame on purpose: only
      // there do the sides stop tapering and the track read as parallel.
      { kind: "slider", key: "roundness", label: "Roundness", min: 0, max: 6, step: 0.1, value: 0.35 },
      // Where the fan converges, leftward from centre. The fan is symmetric
      // about its apex, so 0 puts it mid-frame and shows two mirrored lobes;
      // past the edge (the default) leaves one continuous track.
      { kind: "slider", key: "apex", label: "Apex", min: 0, max: 5, step: 0.1, value: 2.2 },
      { kind: "slider", key: "bandCount", label: "Count", min: 1, max: 20, step: 1, value: 7 },
      { kind: "slider", key: "curve", label: "Curve", min: -2, max: 2, step: 0.1, value: 0.35 },
      // The angle the tracks make with the surface. 0 is flat-on; raising it
      // leans the plane away so the ribbons foreshorten toward a horizon.
      { kind: "slider", key: "tilt", label: "Tilt", min: -1.5, max: 1.5, step: 0.1, value: 0.6 },
      // Curls the surface the tracks lie on, through the same divide as Tilt —
      // so the bend arrives with foreshortening and the ribbons crowd where it
      // turns away. 0 is the flat sheet; Curve is the flat-glass counterpart.
      { kind: "slider", key: "depth", label: "Depth", min: 0, max: 1, step: 0.1, value: 0 },
      { kind: "slider", key: "softness", label: "Softness", group: "edge", min: 0, max: 1, step: 0.1, value: 0.55 },
      { kind: "slider", key: "tail", label: "Tail", group: "ramp", min: 0, max: 1, step: 0.1, value: 0.25 },
      // How far past its band a rail keeps running before it goes out, in ramp
      // lengths. Its own control rather than a multiple of Tail because the two
      // answer different questions — Tail is how softly a band ENDS, this is
      // how far its rails OUTLIVE it. The two still start their fade together
      // (see the shader), so this only ever moves where the rails finish.
      { kind: "slider", key: "edgeTail", label: "Edge Tail", group: "edge", min: 0, max: 3, step: 0.1, value: 0.5 },
      // Ordered (Bayer) dither: quantises to fewer levels and patterns the
      // rounding. 0 is off; higher drops the level count and the crosshatch
      // shows.
      { kind: "slider", key: "rampDither", label: "Ramp Dither", group: "dither", min: 0, max: 1, step: 0.1, value: 0.35 },
      // How hard the RAILS are dithered — independent of Ramp Dither, so either
      // can be on with the other off. The two share one matrix, and so one
      // Dither Size.
      //
      // It runs to 2, not 1, and the second half is the point. A threshold can
      // only bite on coverage below 1, and a rail's core IS 1 — so at 1 the
      // stipple has reached everything it can (the flanks and the tail) and
      // more threshold changes nothing. Past 1 the control lowers the coverage
      // the threshold sees, opening the pattern across the whole line. The line
      // thins as it goes, which is what more dither looks like.
      { kind: "slider", key: "edgeDither", label: "Edge Dither", group: "dither", min: 0, max: 2, step: 0.1, value: 0 },
      // Size of one Bayer cell in DEVICE pixels — so on a 2x display 1 puts the
      // whole 8x8 matrix inside 4 CSS px, too fine to read. Raise to coarsen.
      //
      // Not "Ramp" anything: there is ONE matrix, and the ramp and the rails
      // both read it. Two cell sizes would beat against each other where a rail
      // crosses its own ribbon.
      { kind: "slider", key: "ditherSize", label: "Dither Size", group: "dither", min: 1, max: 12, step: 1, value: 3 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: ["#2E6BFF", "#C89BFF", "#FFB3D9", "#FFD9A0", "#FFF3C4"],
      colorBack: "#12042BFF",
      params: { phaseDegrees: 0, stagger: 0.5, roundness: 0.4, apex: 2.4, rampLength: 1.8, spread: 0.25, bandwidth: 0.42, bandCount: 7, curve: 0.35, tilt: 0.6, softness: 0.55, tail: 0.3, rampDither: 0.5, ditherSize: 3, easing: 1, easingBias: 0, interval: 0 },
    },
  },

  // Ours, and the second. After the Nexus One's live wallpaper and the Nexus
  // 4's pixel fields: a lattice, and coloured pixels running its lanes for one
  // of the four edges, each dragging a fading trail.
  //
  // Where Cosmic Track is one continuous surface read through a ramp, this is
  // DISCRETE — a cell is lit or it is not — so almost every control here counts
  // something (cells, movers, pixels) rather than scaling something. That is
  // the reason the two share so few sliders despite sharing every framing one.
  nexus: {
    id: "nexus",
    label: "Nexus",
    ownLabel: "Field",
    // Matches `NEXUS_MAX_COLORS` in `nexus-uniforms`, which is what sizes the
    // uniform array — see `nexus-shader.test.ts`, which holds the two in step.
    maxColors: 8,
    hasColorBack: true,
    // The lattice's two inks. A colour of their own rather than one of the
    // movers': the grid is the ground they run on, and borrowing a mover's
    // colour would tie the whole lattice to whichever pixel happened to spawn
    // first.
    //
    // Low alpha is the setting, not a shy default. The reference's grid is a
    // hint that the movers are travelling on SOMETHING; drawn at full strength
    // it becomes the picture and the movers become decoration on it.
    //
    // The pair is a graph paper's: the same hue at two strengths, so the field
    // reads at two scales at once rather than as two grids laid over each other.
    // Major is inert until Major Grid is turned up, which is the bargain
    // `colorEdge` and `edgeWidth` strike above — the colour is not the switch.
    extraColors: [
      { key: "colorGrid", label: "Grid", value: "#A8C0FF29", row: "grid" },
      { key: "colorGridMajor", label: "Major", value: "#A8C0FF5C", row: "grid" },
    ],
    controls: [
      // How many movers are alive at once, across the whole frame — an absolute
      // number, so making the grid finer gives you smaller pixels rather than
      // more of them.
      //
      // An EXPECTED count: the shader turns it into the odds any one lane fires
      // (see there), so the live number breathes around it the way a random
      // field does. It saturates at whatever the lattice can hold, which on a
      // coarse grid over a small card is reached before the slider ends.
      { kind: "slider", key: "count", label: "Count", min: 0, max: 120, step: 1, value: 30 },
      // WHICH movers, at the same count — and nothing else. Its own control
      // because the alternative is one dial doing two jobs: if the count were
      // the only thing hashed there would be exactly ONE thirty-mover
      // arrangement, and the only way to see a different one would be to ask
      // for thirty-one.
      { kind: "slider", key: "seed", label: "Seed", min: 0, max: 100, step: 1, value: 0 },
      // How far a mover runs before it stops emitting, in CELLS — not how long
      // it is visible, since the trail it has already laid keeps fading for
      // `tail` cells after the head has gone.
      { kind: "slider", key: "travel", label: "Travel", min: 1, max: 120, step: 1, value: 40 },
      // How far behind the head the trail is still lit, in the same cells so the
      // two can be read against each other. 0 leaves the head alone on the grid.
      { kind: "slider", key: "tail", label: "Tail", min: 0, max: 60, step: 1, value: 14 },
      // Whether the trail fades CELL BY CELL or as one gradient. 0 evaluates the
      // fade at each cell's centre, so a cell is one flat value that dims in
      // place and the trail steps down in whole pixels; 1 evaluates it where the
      // fragment is. Both GLOWS follow it — a halo is cast by a pixel, so it
      // carries that pixel's value (see `nexus-uniforms`, where leaving the two
      // out of step is what made a stepped trail read as a smooth one).
      //
      // A slider rather than the switch it sounds like, because the middle is a
      // real setting — it quantises part of the way, which reads as a stepped
      // trail with its edges softened rather than as either end. The head stays
      // a solid cell at every value; only the fade behind it is in question.
      { kind: "slider", key: "tailBlend", label: "Tail Blend", min: 0, max: 1, step: 0.1, value: 0 },
      // How sharply the trail drops from one pixel to the next.
      //
      // 0 is a straight ramp, which loses 1/Tail per cell — 7% at the default
      // Tail, and with Grid Width at 0 there is no edge between neighbours
      // either, so the trail reads as one bar with a gradient on it. Turning
      // this up keeps a fixed FRACTION of the cell in front instead, so the
      // step is the same all along the trail and does not thin out as Tail
      // grows.
      //
      // It shortens what you SEE without shortening Tail: the curve still lands
      // on zero at exactly Tail cells, it just spends most of its brightness in
      // the first few.
      { kind: "slider", key: "falloff", label: "Falloff", min: 0, max: 1, step: 0.1, value: 0.6 },
      // The size of one PIXEL, in CSS pixels — a 10 is a ten-by-ten pixel, and on
      // a 1.5x display it lands on fifteen device pixels and still reads as ten.
      // The pixel, not the cell around it: Spread is added outside it.
      //
      // A SCREEN measurement rather than a count across the frame, so a pixel is
      // the same size on a phone as on a lightbox instead of the grid getting
      // finer as the card grows. Framing's Scale still scales it: those controls
      // move a camera over the field, and the size named here is the one at
      // Scale 1.
      { kind: "slider", key: "pixelSize", label: "Pixel Size", group: "grid", min: 1, max: 20, step: 1, value: 8 },
      // How thick a grid line is, in CSS pixels — and the switch as well, since
      // 0 is no lattice at all and the pixels touch.
      //
      // ADDED to the pitch, never taken out of the pixel, and that is what makes
      // the name honest: a line STROKED over a cell boundary takes its width out
      // of the two cells it divides, so turning the grid up would shrink the
      // pixels and Pixel Size would stop naming the pixel. Here the line is the
      // space between one pixel and the next, so widening it pushes them apart.
      //
      // It is also what makes a stepped trail read AS pixels rather than as one
      // bar with a gradient on it — abutting cells at neighbouring brightnesses
      // give the eye no edge to find.
      { kind: "slider", key: "gridWidth", label: "Grid Width", group: "grid", min: 0, max: 10, step: 0.5, value: 2 },
      // Every how-manieth line is drawn in the Major swatch instead: graph
      // paper. 0 is off and every line is the minor colour.
      //
      // A COUNT of cells rather than a size, so the block it rules off grows
      // with Pixel Size and the paper keeps its proportions as the grid
      // coarsens. Integer steps because it is a count — an "every 3.5th line"
      // has nothing to point at.
      //
      // Major lines are the same WIDTH as minor ones. Widening them would have
      // to take that width out of the two pixels either side, and a pixel beside
      // a major line would then be smaller than one anywhere else — the fault
      // Grid Width is added to the pitch to avoid. Their weight is the swatch's
      // alpha instead.
      { kind: "slider", key: "majorGrid", label: "Major Grid", group: "grid", min: 0, max: 15, step: 1, value: 8 },
      { kind: "slider", key: "headGlow", label: "Head Glow", group: "glow", min: 0, max: 2, step: 0.1, value: 0.8 },
      // Capped at the shader's own lane reach (`NEXUS_MAX_GLOW_REACH`), which is
      // how far out a fragment looks for movers. A radius past it is not a wider
      // halo but one clipped square at the lane boundary — so the range is the
      // constant's, and `nexus-shader.test.ts` holds them together.
      { kind: "slider", key: "headRadius", label: "Head Radius", group: "glow", min: 0, max: 3, step: 0.1, value: 1.2 },
      // Its own strength rather than a fraction of the head's: a head flaring
      // over a barely-lit trail is a spark, a flat head over a glowing trail is
      // a light-pipe, and neither is reachable from one control.
      { kind: "slider", key: "tailGlow", label: "Tail Glow", group: "glow", min: 0, max: 2, step: 0.1, value: 0.4 },
      { kind: "slider", key: "tailRadius", label: "Tail Radius", group: "glow", min: 0, max: 3, step: 0.1, value: 0.8 },
      { kind: "slider", key: "easing", label: "Easing", group: "motion", min: -1, max: 1, step: 0.1, value: 1 },
      { kind: "slider", key: "easingBias", label: "Easing Bias", group: "motion", min: -1, max: 1, step: 0.1, value: 0 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      // Google's four, plus the cyan the Nexus One's own wallpaper ran on. Four
      // saturated colours on a near-black ground is the reference read plainly:
      // the movers are the only vivid thing on the card, so no two of them may
      // read as the same pixel.
      colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#00E5FF"],
      colorBack: "#080B12FF",
      // The one shader in the table that opens MOVING. Speed is 0 everywhere
      // else because a fan parked mid-sweep is still the whole picture — here a
      // parked field is a picture of trails with nothing making them, which
      // reads as a bug rather than as a still.
      params: { speed: 1 },
    },
  },
};

export const SHADER_IDS = Object.keys(SHADER_SPECS) as ShaderId[];

/** Every control's default, keyed by uniform — the shape the page holds in state. */
export function defaultParams(spec: ShaderSpec): Params {
  return Object.fromEntries(
    spec.controls.map((control) => [control.key, control.value]),
  );
}

export interface ShaderState {
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
}

/**
 * The full starting state for a shader: its `defaults` laid over the control
 * table's own, so the table only has to name what it actually moves.
 *
 * Returns fresh objects every call: the caller puts these straight into state
 * and edits them, and sharing them would let one tweak rewrite the table.
 */
export function defaultState(spec: ShaderSpec): ShaderState {
  return {
    params: { ...defaultParams(spec), ...spec.defaults.params },
    colors: [...spec.defaults.colors],
    colorBack: spec.defaults.colorBack,
    extraColors: Object.fromEntries(
      spec.extraColors.map((extra) => [
        extra.key,
        spec.defaults.extraColors?.[extra.key] ?? extra.value,
      ]),
    ),
  };
}
