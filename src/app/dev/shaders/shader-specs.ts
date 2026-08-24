// ---------------------------------------------------------------------------
// The shader playground's table of contents.
//
// One entry per shader worth pointing at the reference art (the Windsurf card
// backgrounds: fanned light-blades, soft colour washes). Each entry carries
// BOTH the control table — every uniform the page exposes, with the range the
// shader's own docs give it — and the starting point those controls open on.
//
// A table rather than a page full of hand-written rows, for the same reason
// `media-properties-panel.tsx` uses one: the rows differ only in their four
// numbers, and spelling them out invites the ranges to drift from the shader
// they describe. Ranges below are transcribed from the `u_*` docblocks in
// `node_modules/@paper-design/shaders/dist/shaders/*.d.ts` — if a control feels
// clamped, check there before widening it here.
//
// A shader's `defaults` are a STARTING POINT, not a match. They put you in the
// right neighbourhood of the reference card; the page exists because the last
// mile is eyeballing, not arithmetic.
// ---------------------------------------------------------------------------

export type ShaderId =
  | "cosmicTrack"
  | "colorPanels"
  | "godRays"
  | "warp"
  | "swirl"
  | "staticMeshGradient";

export interface SliderSpec {
  kind: "slider";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface ToggleSpec {
  kind: "toggle";
  key: string;
  label: string;
  value: boolean;
}

export interface SelectSpec {
  kind: "select";
  key: string;
  label: string;
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
  /** The shader's own `maxColorCount`. */
  maxColors: number;
  /** False for the mesh gradients, which are opaque fills with no background. */
  hasColorBack: boolean;
  extraColors: ExtraColorSpec[];
  controls: ControlSpec[];
  defaults: ShaderDefaults;
}

// How the graphic is FRAMED in the card — the four sizing props that visibly
// move it. Spread LAST into each control table so a shader's own parameters
// read first and the framing sits together at the foot of the sidebar wherever
// you are.
//
// The rest of `ShaderSizingParams` is deliberately absent. `fit` and the world
// box (`worldWidth`/`worldHeight`, and the `originX`/`originY` that only
// position that box) describe how the shader's coordinate space maps onto a
// canvas — and here the card IS the canvas, pinned at `fit="cover"` by the page
// so the ground has no margins. Left at the canvas size, origin and world size
// do nothing you can see; `fit: none` against a zero-size world collapses the
// box to a pixel and renders nothing at all. Controls whose only settings are
// "no change" and "broken" are not properties of the shader worth showing.
const FRAMING_CONTROLS: ControlSpec[] = [
  { kind: "slider", key: "scale", label: "Scale", min: 0.01, max: 4, step: 0.01, value: 1 },
  { kind: "slider", key: "rotation", label: "Rotation", min: 0, max: 360, step: 1, value: 0 },
  { kind: "slider", key: "offsetX", label: "Offset X", min: -1, max: 1, step: 0.01, value: 0 },
  { kind: "slider", key: "offsetY", label: "Offset Y", min: -1, max: 1, step: 0.01, value: 0 },
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
  { kind: "slider", key: "speed", label: "Speed", min: 0, max: 2, step: 0.01, value: 0 },
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

// The reference palette, read off the artwork. Named rather than inlined so the
// same green means the same thing in every shader that reaches for it.
const FOREST = "#0A3B2CFF";
const EMERALD = "#12855FFF";
const SPRING = "#3ECC85FF";
const LIME = "#C6F24EFF";
const PALE_LIME = "#E9F9B8FF";
const PAPER = "#FBF6ECFF";
const BLUSH = "#F6B3CEFF";
const APRICOT = "#F5B183FF";
const CORNFLOWER = "#5B7FD4FF";
const DEEP_BLUE = "#2E4BA8FF";

export const SHADER_SPECS: Record<ShaderId, ShaderSpec> = {
  // Ours — the only entry here that is not a library built-in. Everything else
  // on this page is a shader we are auditing; this one is a shader we are
  // building, and the controls are how it gets tuned.
  cosmicTrack: {
    id: "cosmicTrack",
    label: "Cosmic Track",
    maxColors: 10,
    hasColorBack: true,
    extraColors: [],
    controls: [
      // The reference's own slider — slides every band along the track at once.
      { kind: "slider", key: "angle", label: "Angle", min: -4, max: 4, step: 0.01, value: 0 },
      // How far Speed swings the set either side of Angle. Motion oscillates
      // out and back rather than drifting one way, so the bands always return.
      { kind: "slider", key: "travel", label: "Travel", min: 0, max: 4, step: 0.01, value: 1.5 },
      // The gap between one band and the next. At 0 they advance as one flat
      // front; turning it up is what produces the reference's staircase.
      { kind: "slider", key: "stagger", label: "Stagger", min: -2, max: 2, step: 0.01, value: 0.45 },
      // How far a band's single gradient spans along the track. Beyond its two
      // ends the track carries ground, not another copy of the palette.
      { kind: "slider", key: "rampLength", label: "Ramp Length", min: 0.05, max: 6, step: 0.01, value: 1.6 },
      // The gap between adjacent ribbons. 0 is touching; raising it opens
      // ground between them without moving them off their own tracks.
      { kind: "slider", key: "spread", label: "Spread", min: 0, max: 0.95, step: 0.01, value: 0.25 },
      // How wide the stack of ribbons is, from the centre outward. Narrowing it
      // narrows every ribbon together — applied BEFORE the slots are cut, so they
      // stay stuck edge to edge. Spread below is applied after, and separates them.
      { kind: "slider", key: "bandwidth", label: "Bandwidth", min: 0, max: 1, step: 0.01, value: 0.7 },
      // How the ribbons meet. 0 is a sharp apex — a true point — and anything
      // above rounds the convergence into a curve.
      { kind: "slider", key: "roundness", label: "Roundness", min: 0, max: 1.5, step: 0.01, value: 0.35 },
      // Where the fan converges, leftward from centre. The fan is symmetric
      // about its apex, so 0 puts it mid-frame and shows two mirrored lobes;
      // past the edge (the default) leaves one continuous track.
      { kind: "slider", key: "apex", label: "Apex", min: 0, max: 5, step: 0.01, value: 2.2 },
      { kind: "slider", key: "bandCount", label: "Band Count", min: 1, max: 24, step: 1, value: 7 },
      { kind: "slider", key: "curve", label: "Curve", min: -2, max: 2, step: 0.01, value: 0.35 },
      // The angle the tracks make with the surface. 0 is flat-on; raising it
      // leans the plane away so the ribbons foreshorten toward a horizon.
      { kind: "slider", key: "tilt", label: "Tilt", min: -1.5, max: 1.5, step: 0.01, value: 0.6 },
      { kind: "slider", key: "fold", label: "Fold", min: 0, max: 1, step: 0.01, value: 0.18 },
      { kind: "slider", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, value: 0.55 },
      { kind: "slider", key: "tail", label: "Tail", min: 0, max: 1, step: 0.01, value: 0.25 },
            // Ordered (Bayer) dither: quantises to fewer levels and patterns the
      // rounding. 0 is off; higher drops the level count and the crosshatch shows.
      { kind: "slider", key: "dither", label: "Dither", min: 0, max: 1, step: 0.01, value: 0.35 },
      // Size of one Bayer cell in DEVICE pixels — so on a 2x display 1 puts the
      // whole 8x8 matrix inside 4 CSS px, too fine to read. Raise to coarsen.
      { kind: "slider", key: "ditherSize", label: "Dither Size", min: 1, max: 12, step: 1, value: 3 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: ["#2E6BFF", "#C89BFF", "#FFB3D9", "#FFD9A0", "#FFF3C4"],
      colorBack: "#12042BFF",
      params: { angle: 0, stagger: 0.5, roundness: 0.4, apex: 2.4, rampLength: 1.8, spread: 0.25, bandwidth: 0.42, bandCount: 7, curve: 0.35, tilt: 0.6, fold: 0.18, softness: 0.55, tail: 0.3, dither: 0.5, ditherSize: 3 },
    },
  },

  // The closest thing in the library to the hero motif: tapered blades fanning
  // around an axis, each carrying a gradient along its length. Push the axis
  // off the top of the frame (negative Offset Y) and you have the card.
  colorPanels: {
    id: "colorPanels",
    label: "Color Panels",
    maxColors: 7,
    hasColorBack: true,
    extraColors: [],
    controls: [
      { kind: "slider", key: "density", label: "Density", min: 0.25, max: 7, step: 0.05, value: 2.2 },
      { kind: "slider", key: "angle1", label: "Angle 1", min: -1, max: 1, step: 0.01, value: 0.1 },
      { kind: "slider", key: "angle2", label: "Angle 2", min: -1, max: 1, step: 0.01, value: -0.1 },
      { kind: "slider", key: "length", label: "Length", min: 0, max: 3, step: 0.01, value: 2.4 },
      { kind: "slider", key: "blur", label: "Blur", min: 0, max: 0.5, step: 0.01, value: 0.28 },
      { kind: "slider", key: "fadeIn", label: "Fade In", min: 0, max: 1, step: 0.01, value: 0.35 },
      { kind: "slider", key: "fadeOut", label: "Fade Out", min: 0, max: 1, step: 0.01, value: 0.65 },
      { kind: "slider", key: "gradient", label: "Gradient", min: 0, max: 1, step: 0.01, value: 1 },
      { kind: "toggle", key: "edges", label: "Edge highlight", value: false },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: [EMERALD, SPRING, LIME, PALE_LIME],
      colorBack: FOREST,
      params: { density: 3.7, angle1: 0.55, angle2: -0.35, length: 0.9, blur: 0.2, fadeIn: 0.3, fadeOut: 0.7, gradient: 1, scale: 0.7, rotation: 90, offsetY: 0 },
    },
  },

  // The other reading of the same motif: light shafts rather than solid blades.
  // Softer and hazier than Color Panels, and the bloom tint is the strongest
  // single lever on how the whole frame reads.
  godRays: {
    id: "godRays",
    label: "God Rays",
    maxColors: 5,
    hasColorBack: true,
    extraColors: [{ key: "colorBloom", label: "Bloom", value: LIME }],
    controls: [
      { kind: "slider", key: "density", label: "Density", min: 0, max: 1, step: 0.01, value: 0.8 },
      { kind: "slider", key: "intensity", label: "Intensity", min: 0, max: 1, step: 0.01, value: 0.55 },
      { kind: "slider", key: "spotty", label: "Spotty", min: 0, max: 1, step: 0.01, value: 0.15 },
      { kind: "slider", key: "midSize", label: "Mid Size", min: 0, max: 1, step: 0.01, value: 0.2 },
      { kind: "slider", key: "midIntensity", label: "Mid Intensity", min: 0, max: 1, step: 0.01, value: 0.15 },
      { kind: "slider", key: "bloom", label: "Bloom", min: 0, max: 1, step: 0.01, value: 0.45 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: [EMERALD, SPRING, LIME],
      colorBack: FOREST,
      extraColors: { colorBloom: LIME },
      // Density is the whole ballgame: at 0.8 the shafts read as grass, at
      // 0.3 they read as the broad soft blades in the art.
      params: { density: 0.3, intensity: 0.6, spotty: 0.12, midSize: 0.1, midIntensity: 0.1, bloom: 0.5, scale: 1.2, offsetY: -0.85 },
    },
  },

  // Not a fan at all, but `stripes` with a little swirl lands on the flowing
  // ribbon look some of the cards have where the blades bend.
  warp: {
    id: "warp",
    label: "Warp",
    maxColors: 10,
    hasColorBack: false,
    extraColors: [],
    controls: [
      {
        kind: "select",
        key: "shape",
        label: "Pattern",
        options: [
          { value: "stripes", label: "Stripes" },
          { value: "checks", label: "Checks" },
          { value: "edge", label: "Edge" },
        ],
        value: "stripes",
      },
      { kind: "slider", key: "proportion", label: "Proportion", min: 0, max: 1, step: 0.01, value: 0.5 },
      { kind: "slider", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, value: 0.9 },
      { kind: "slider", key: "shapeScale", label: "Shape Scale", min: 0, max: 1, step: 0.01, value: 0.12 },
      { kind: "slider", key: "distortion", label: "Distortion", min: 0, max: 1, step: 0.01, value: 0.15 },
      { kind: "slider", key: "swirl", label: "Swirl", min: 0, max: 1, step: 0.01, value: 0.35 },
      { kind: "slider", key: "swirlIterations", label: "Swirl Iterations", min: 0, max: 20, step: 1, value: 6 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: [FOREST, EMERALD, SPRING, LIME, PALE_LIME],
      params: { shape: "stripes", softness: 0.95, shapeScale: 0.1, distortion: 0.12, swirl: 0.4, swirlIterations: 8, rotation: 14 },
    },
  },

  // Sectoral bands around a centre. With `twist` near zero these are straight
  // wedges — the fan again, from a third direction.
  swirl: {
    id: "swirl",
    label: "Swirl",
    maxColors: 10,
    hasColorBack: true,
    extraColors: [],
    controls: [
      { kind: "slider", key: "bandCount", label: "Band Count", min: 0, max: 15, step: 1, value: 6 },
      { kind: "slider", key: "twist", label: "Twist", min: 0, max: 1, step: 0.01, value: 0.15 },
      { kind: "slider", key: "center", label: "Center", min: 0, max: 1, step: 0.01, value: 0.4 },
      { kind: "slider", key: "proportion", label: "Proportion", min: 0, max: 1, step: 0.01, value: 0.5 },
      { kind: "slider", key: "softness", label: "Softness", min: 0, max: 1, step: 0.01, value: 0.9 },
      { kind: "slider", key: "noise", label: "Noise", min: 0, max: 1, step: 0.01, value: 0.1 },
      { kind: "slider", key: "noiseFrequency", label: "Noise Frequency", min: 0, max: 1, step: 0.01, value: 0.3 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: [EMERALD, SPRING, LIME, PALE_LIME],
      colorBack: FOREST,
      params: { bandCount: 9, twist: 0.05, center: 0.2, softness: 0.95, scale: 1.6, offsetY: -0.7 },
    },
  },

  // The soft-wash cards. This is the shader already shipping behind pictures in
  // `background-effect.tsx`, so anything tuned here transfers straight over.
  staticMeshGradient: {
    id: "staticMeshGradient",
    label: "Static Mesh Gradient",
    maxColors: 10,
    hasColorBack: false,
    extraColors: [],
    controls: [
      // A placement SEED, not a position — nudging it re-rolls the field rather
      // than sliding it, which is why it steps by whole numbers.
      { kind: "slider", key: "positions", label: "Positions", min: 0, max: 100, step: 1, value: 8 },
      { kind: "slider", key: "waveX", label: "Wave X", min: 0, max: 1, step: 0.01, value: 0.3 },
      { kind: "slider", key: "waveXShift", label: "Wave X Shift", min: 0, max: 1, step: 0.01, value: 0.5 },
      { kind: "slider", key: "waveY", label: "Wave Y", min: 0, max: 1, step: 0.01, value: 0.3 },
      { kind: "slider", key: "waveYShift", label: "Wave Y Shift", min: 0, max: 1, step: 0.01, value: 0.5 },
      { kind: "slider", key: "mixing", label: "Mixing", min: 0, max: 1, step: 0.01, value: 0.6 },
      { kind: "slider", key: "grainMixer", label: "Grain Mixer", min: 0, max: 1, step: 0.01, value: 0.2 },
      { kind: "slider", key: "grainOverlay", label: "Grain Overlay", min: 0, max: 1, step: 0.01, value: 0.1 },
      ...FRAMING_CONTROLS,
      // No MOTION_CONTROLS: this shader's fragment shader never reads
      // `u_time`, so a Speed slider here would be a control that does
      // nothing. The name is the specification — it is STATIC.
    ],
    defaults: {
      colors: [PAPER, APRICOT, BLUSH, CORNFLOWER, DEEP_BLUE],
      params: { positions: 12, mixing: 0.75, waveY: 0.45, grainOverlay: 0.12 },
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
