// ---------------------------------------------------------------------------
// The shader playground's table of contents.
//
// One entry per shader worth pointing at the reference art (the Windsurf card
// backgrounds: fanned light-blades, soft colour washes). Each entry carries
// BOTH the control table — every uniform the page exposes, with the range the
// shader's own docs give it — and a handful of presets that park those controls
// somewhere recognisable.
//
// A table rather than a page full of hand-written rows, for the same reason
// `media-properties-panel.tsx` uses one: the rows differ only in their four
// numbers, and spelling them out invites the ranges to drift from the shader
// they describe. Ranges below are transcribed from the `u_*` docblocks in
// `node_modules/@paper-design/shaders/dist/shaders/*.d.ts` — if a control feels
// clamped, check there before widening it here.
//
// The presets are STARTING POINTS, not matches. They put you in the right
// neighbourhood of each reference card; the page exists because the last mile
// is eyeballing, not arithmetic.
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

export interface ShaderPreset {
  id: string;
  label: string;
  /** What in the reference art this preset is reaching for. */
  note: string;
  colors: string[];
  /** Required exactly when the shader has a `colorBack`; see the spec table test. */
  colorBack?: string;
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
  presets: ShaderPreset[];
}

// The sizing/motion uniforms every shader shares. Spread LAST into each control
// table so a shader's own parameters read first and the framing controls sit
// together at the foot of the panel wherever you are.
const SIZING_CONTROLS: ControlSpec[] = [
  { kind: "slider", key: "scale", label: "Scale", min: 0.01, max: 4, step: 0.01, value: 1 },
  { kind: "slider", key: "rotation", label: "Rotation", min: 0, max: 360, step: 1, value: 0 },
  { kind: "slider", key: "offsetX", label: "Offset X", min: -1, max: 1, step: 0.01, value: 0 },
  { kind: "slider", key: "offsetY", label: "Offset Y", min: -1, max: 1, step: 0.01, value: 0 },
  // Zero is not just "slow": the library cancels the rAF entirely at 0, so a
  // parked shader costs nothing per frame. Worth leaving here at rest.
  { kind: "slider", key: "speed", label: "Speed", min: 0, max: 2, step: 0.01, value: 0 },
];

// The reference palette, read off the artwork. Named rather than inlined so the
// same green means the same thing in three presets.
const FOREST = "#0A3B2CFF";
const EMERALD = "#12855FFF";
const SPRING = "#3ECC85FF";
const LIME = "#C6F24EFF";
const PALE_LIME = "#E9F9B8FF";
const PAPER = "#FBF6ECFF";
const BLUSH = "#F6B3CEFF";
const PLUM = "#3B0A45FF";
const MAGENTA = "#B0197FFF";
const GOLD = "#F5D14EFF";
const APRICOT = "#F5B183FF";
const CORNFLOWER = "#5B7FD4FF";
const DEEP_BLUE = "#2E4BA8FF";
const MINT = "#7FE8C0FF";

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
      ...SIZING_CONTROLS,
    ],
    presets: [
      {
        id: "aurora",
        label: "Aurora",
        note: "The reference's blue-to-peach ramp along a wide fan.",
        colors: ["#2E6BFF", "#C89BFF", "#FFB3D9", "#FFD9A0", "#FFF3C4"],
        colorBack: "#12042BFF",
        params: { angle: 0, stagger: 0.5, roundness: 0.4, apex: 2.4, rampLength: 1.8, spread: 0.25, bandwidth: 0.42, bandCount: 7, curve: 0.35, tilt: 0.6, fold: 0.18, softness: 0.55, tail: 0.3, dither: 0.5, ditherSize: 3 },
      },
      {
        id: "angle-swept",
        label: "Angle swept",
        note: "The ANGLE video. Drag Angle: every band slides along its track, and Stagger is the gap that makes their leading edges a staircase. Speed does the same thing on its own — the track never moves.",
        colors: [FOREST, "#1FBF8F", LIME, "#F9C8E0", PAPER],
        colorBack: FOREST,
        params: { angle: 0.25, stagger: 0.5, roundness: 0.5, apex: 2.8, rampLength: 2.6, spread: 0.3, bandwidth: 0.38, bandCount: 6, curve: 0.6, tilt: 0.85, fold: 0.12, softness: 0.7, tail: 0.35, speed: 0.5 },
      },
      {
        id: "bent-field",
        label: "Bent field",
        note: "Apex and Roundness both 0 — the convergence pulled into frame as a sharp point, showing the symmetric bowtie the fan is built on.",
        colors: [PLUM, MAGENTA, "#FF8FC7", GOLD, PAPER],
        colorBack: "#1A0320FF",
        params: { angle: 0.2, stagger: 0.4, roundness: 0, apex: 0, rampLength: 2.4, spread: 0.12, bandwidth: 0.5, bandCount: 9, curve: 0.2, tilt: 0, fold: 0.22, softness: 0.4, tail: 0.2 },
      },
    ],
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
      ...SIZING_CONTROLS,
    ],
    presets: [
      {
        id: "emerald-bloom",
        label: "Emerald bloom",
        note: "Soft vertical glow on the dark ground. Drop Density near 1 to see the folded-wing structure this is made of.",
        colors: [EMERALD, SPRING, LIME, PALE_LIME],
        colorBack: FOREST,
        params: { density: 3.7, angle1: 0.55, angle2: -0.35, length: 0.9, blur: 0.2, fadeIn: 0.3, fadeOut: 0.7, gradient: 1, scale: 0.7, rotation: 90, offsetY: 0 },
      },
      {
        id: "citrus-bloom",
        label: "Citrus bloom",
        note: "The same glow on the paper ground, with pink at the edges.",
        colors: [PALE_LIME, LIME, SPRING, BLUSH],
        colorBack: PAPER,
        params: { density: 3.4, angle1: 0.4, angle2: -0.25, length: 1, blur: 0.3, fadeIn: 0.45, fadeOut: 0.55, gradient: 1, scale: 0.75, rotation: 90 },
      },
      {
        id: "violet-blades",
        label: "Violet blades",
        note: "The purple card — few, hard-edged wings raking across a plum ground.",
        colors: [MAGENTA, BLUSH, GOLD, LIME],
        colorBack: PLUM,
        params: { density: 1.4, angle1: 0.45, angle2: -0.3, length: 1.4, blur: 0.06, fadeIn: 0.2, fadeOut: 0.8, gradient: 1, scale: 0.8, rotation: 66 },
      },
    ],
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
      ...SIZING_CONTROLS,
    ],
    presets: [
      {
        id: "beam-fan",
        label: "Beam fan",
        note: "Shafts thrown down from a source above the frame.",
        colors: [EMERALD, SPRING, LIME],
        colorBack: FOREST,
        extraColors: { colorBloom: LIME },
        // Density is the whole ballgame: at 0.8 the shafts read as grass, at
        // 0.3 they read as the broad soft blades in the art.
        params: { density: 0.3, intensity: 0.6, spotty: 0.12, midSize: 0.1, midIntensity: 0.1, bloom: 0.5, scale: 1.2, offsetY: -0.85 },
      },
      {
        id: "paper-beams",
        label: "Paper beams",
        note: "The same shafts on the cream ground, barely there.",
        colors: [LIME, SPRING, BLUSH],
        colorBack: PAPER,
        extraColors: { colorBloom: PALE_LIME },
        params: { density: 0.26, intensity: 0.4, spotty: 0.2, midSize: 0.25, midIntensity: 0.08, bloom: 0.65, scale: 1.1, offsetY: -0.8 },
      },
    ],
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
      ...SIZING_CONTROLS,
    ],
    presets: [
      {
        id: "green-ribbon",
        label: "Green ribbon",
        note: "Soft bands bending through the frame.",
        colors: [FOREST, EMERALD, SPRING, LIME, PALE_LIME],
        params: { shape: "stripes", softness: 0.95, shapeScale: 0.1, distortion: 0.12, swirl: 0.4, swirlIterations: 8, rotation: 14 },
      },
      {
        id: "sunset-ribbon",
        label: "Sunset ribbon",
        note: "The warm card's palette, run through the same bands.",
        colors: [PAPER, APRICOT, BLUSH, CORNFLOWER, DEEP_BLUE],
        params: { shape: "stripes", softness: 1, shapeScale: 0.18, distortion: 0.2, swirl: 0.5, swirlIterations: 10, rotation: 96 },
      },
    ],
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
      ...SIZING_CONTROLS,
    ],
    presets: [
      {
        id: "wedge-fan",
        label: "Wedge fan",
        note: "Twist at zero, centre pushed off the top edge.",
        colors: [EMERALD, SPRING, LIME, PALE_LIME],
        colorBack: FOREST,
        params: { bandCount: 9, twist: 0.05, center: 0.2, softness: 0.95, scale: 1.6, offsetY: -0.7 },
      },
    ],
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
      ...SIZING_CONTROLS,
    ],
    presets: [
      {
        id: "sunset-haze",
        label: "Sunset haze",
        note: "The warm card — cream falling through apricot and pink into blue.",
        colors: [PAPER, APRICOT, BLUSH, CORNFLOWER, DEEP_BLUE],
        params: { positions: 12, mixing: 0.75, waveY: 0.45, grainOverlay: 0.12 },
      },
      {
        id: "mint-wash",
        label: "Mint wash",
        note: "The pale green card — one soft vertical fall, almost no structure.",
        colors: [MINT, SPRING, PALE_LIME, PAPER],
        params: { positions: 4, mixing: 0.85, waveX: 0.15, waveY: 0.5, grainOverlay: 0.08 },
      },
    ],
  },
};

export const SHADER_IDS = Object.keys(SHADER_SPECS) as ShaderId[];

/** Every control's default, keyed by uniform — the shape the page holds in state. */
export function defaultParams(spec: ShaderSpec): Params {
  return Object.fromEntries(
    spec.controls.map((control) => [control.key, control.value]),
  );
}

export interface ResolvedPreset {
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
}

/**
 * The full starting state for one preset: its overrides laid over the control
 * table's defaults, so a preset only has to name what it actually changes.
 *
 * An unrecognised id resolves to the plain defaults rather than throwing — the
 * page reads the id from component state, and a stale one should show you the
 * shader, not an error boundary.
 *
 * Returns fresh objects every call: the caller puts these straight into state
 * and edits them, and sharing them would let one tweak rewrite the table.
 */
export function presetParams(spec: ShaderSpec, presetId: string): ResolvedPreset {
  const preset = spec.presets.find((candidate) => candidate.id === presetId);
  const extraColors = Object.fromEntries(
    spec.extraColors.map((extra) => [
      extra.key,
      preset?.extraColors?.[extra.key] ?? extra.value,
    ]),
  );

  if (!preset) {
    return {
      params: defaultParams(spec),
      colors: spec.presets[0] ? [...spec.presets[0].colors] : [],
      colorBack: spec.presets[0]?.colorBack,
      extraColors,
    };
  }

  return {
    params: { ...defaultParams(spec), ...preset.params },
    colors: [...preset.colors],
    colorBack: preset.colorBack,
    extraColors,
  };
}
