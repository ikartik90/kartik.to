import {
  ROTATION_MAX,
  ROTATION_MIN,
  ROTATION_STEP,
} from "@/utils/rotation";

/** ±90°, not rotation's ±180: phase is a distance along a track that doesn't wrap. */
export const PHASE_MIN = -90;
export const PHASE_MAX = 90;
export const PHASE_STEP = 15;

/** Step for Origin and Travel; the stored-value migration rounds onto it too. */
export const FRAME_DISTANCE_STEP = 0.1;

export type ShaderId = "cosmicTrack" | "pixelComets";

/** Sidebar group; omitted, the control stays with the shader's own parameters. */
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

/** Independent toggles; the value must never be empty (the panel and schema assume it). */
export interface TogglesSpec {
  kind: "toggles";
  key: string;
  label: string;
  group?: ControlGroup;
  options: { value: string; label: string }[];
  value: string[];
}

export type ControlSpec = SliderSpec | ToggleSpec | SelectSpec | TogglesSpec;

export type ParamValue = number | boolean | string | string[];
export type Params = Record<string, ParamValue>;

/** A colour the shader takes that is not part of its `colors` ramp. */
export interface ExtraColorSpec {
  key: string;
  label: string;
  value: string;
  /** Extras naming the same row share it, labelled by the first. */
  row?: string;
}

export interface ExtraColorRow {
  label: string;
  colors: ExtraColorSpec[];
}

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

export interface ShaderDefaults {
  colors: string[];
  /** Required exactly when the shader has a colorBack (tested). */
  colorBack?: string;
  /** Only params that differ from each control's own value. */
  params?: Params;
  extraColors?: Record<string, string>;
}

export interface ShaderSpec {
  id: ShaderId;
  label: string;
  /** Heading for the shader's ungrouped parameters. */
  ownLabel: string;
  /** What the shader calls its `colors` swatches. */
  colorsLabel: string;
  /** The shader's own `maxColorCount`. */
  maxColors: number;
  hasColorBack: boolean;
  extraColors: ExtraColorSpec[];
  controls: ControlSpec[];
  defaults: ShaderDefaults;
}

// Spread last into every control table. Presets store these per aspect ratio (see
// @/domain/shader-preset); `fit` and the world box are omitted as the page pins fit="cover".
export const FRAMING_CONTROLS: ControlSpec[] = [
  { kind: "slider", key: "scale", label: "Scale", min: 0.01, max: 4, step: 0.1, value: 1 },
  // Range and step must match @/utils/rotation, where presets are reused.
  { kind: "slider", key: "rotation", label: "Rotation", min: ROTATION_MIN, max: ROTATION_MAX, step: ROTATION_STEP, value: 0 },
  { kind: "slider", key: "offsetX", label: "Offset X", min: -1, max: 1, step: 0.1, value: 0 },
  { kind: "slider", key: "offsetY", label: "Offset Y", min: -1, max: 1, step: 0.1, value: 0 },
];

// Spread only into shaders whose GLSL samples `u_time`, or Speed moves nothing.
const MOTION_CONTROLS: ControlSpec[] = [
  { kind: "slider", key: "speed", label: "Speed", min: 0, max: 5, step: 0.1, value: 0 },
];

/** Arrays, not sets: their order is the sidebar's render order. */
export const FRAMING_CONTROL_KEYS: string[] = FRAMING_CONTROLS.map(
  (control) => control.key,
);

export const MOTION_CONTROL_KEYS: string[] = MOTION_CONTROLS.map(
  (control) => control.key,
);

export const SHADER_SPECS: Record<ShaderId, ShaderSpec> = {
  cosmicTrack: {
    id: "cosmicTrack",
    label: "Cosmic Track",
    ownLabel: "Track",
    colorsLabel: "Ramp",
    maxColors: 10,
    hasColorBack: true,
    extraColors: [{ key: "colorEdge", label: "Edge", value: "#FFFFFFFF" }],
    controls: [
      // CSS px; 0 turns the rails off.
      { kind: "slider", key: "edgeWidth", label: "Edge Width", group: "edge", min: 0, max: 4, step: 0.1, value: 0 },
      { kind: "slider", key: "phaseDegrees", label: "Phase", group: "ramp", min: PHASE_MIN, max: PHASE_MAX, step: PHASE_STEP, value: 0 },
      { kind: "slider", key: "travel", label: "Travel", group: "ramp", min: 0, max: 4, step: 0.1, value: 1.5 },
      { kind: "slider", key: "interval", label: "Interval", group: "motion", min: 0, max: 2, step: 0.1, value: 0 },
      { kind: "slider", key: "easing", label: "Easing", group: "motion", min: -1, max: 1, step: 0.1, value: 1 },
      { kind: "slider", key: "easingBias", label: "Easing Bias", group: "motion", min: -1, max: 1, step: 0.1, value: 0 },
      { kind: "slider", key: "stagger", label: "Stagger", group: "ramp", min: -2, max: 2, step: 0.1, value: 0.45 },
      { kind: "slider", key: "symmetry", label: "Symmetry", group: "ramp", min: -1, max: 1, step: 0.1, value: 1 },
      { kind: "slider", key: "rampLength", label: "Length", group: "ramp", min: 0.05, max: 10, step: 0.1, value: 1.6 },
      // In ribbon widths; widens the stack rather than thinning the ribbons.
      { kind: "slider", key: "spread", label: "Spread", min: 0, max: 3, step: 0.1, value: 0.25 },
      { kind: "slider", key: "bandwidth", label: "Bandwidth", min: 0, max: 1, step: 0.1, value: 0.7 },
      // The track's half-width at the apex; 0 is a true point.
      { kind: "slider", key: "roundness", label: "Roundness", min: 0, max: 6, step: 0.1, value: 0.35 },
      { kind: "slider", key: "apex", label: "Apex", min: 0, max: 5, step: 0.1, value: 2.2 },
      { kind: "slider", key: "bandCount", label: "Count", min: 1, max: 20, step: 1, value: 7 },
      { kind: "slider", key: "curve", label: "Curve", min: -2, max: 2, step: 0.1, value: 0.35 },
      { kind: "slider", key: "tilt", label: "Tilt", min: -1.5, max: 1.5, step: 0.1, value: 0.6 },
      { kind: "slider", key: "depth", label: "Depth", min: 0, max: 1, step: 0.1, value: 0 },
      { kind: "slider", key: "softness", label: "Softness", group: "edge", min: 0, max: 1, step: 0.1, value: 0.55 },
      { kind: "slider", key: "tail", label: "Tail", group: "ramp", min: 0, max: 1, step: 0.1, value: 0.25 },
      // In ramp lengths past the band's end.
      { kind: "slider", key: "edgeTail", label: "Edge Tail", group: "edge", min: 0, max: 3, step: 0.1, value: 0.5 },
      { kind: "slider", key: "rampDither", label: "Ramp Dither", group: "dither", min: 0, max: 1, step: 0.1, value: 0.35 },
      // Runs to 2 on purpose: past 1 it lowers the coverage the threshold sees.
      { kind: "slider", key: "edgeDither", label: "Edge Dither", group: "dither", min: 0, max: 2, step: 0.1, value: 0 },
      // In device pixels; one Bayer matrix shared by ramp and rails.
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

  pixelComets: {
    id: "pixelComets",
    label: "Pixel Comets",
    ownLabel: "Comet Field",
    colorsLabel: "Comets",
    // Must match PIXEL_COMETS_MAX_COLORS in pixel-comets-uniforms (tested).
    maxColors: 8,
    hasColorBack: true,
    extraColors: [
      { key: "colorGrid", label: "Grid", value: "#A8C0FF29", row: "grid" },
      { key: "colorGridMajor", label: "Major", value: "#A8C0FF5C", row: "grid" },
    ],
    controls: [
      { kind: "slider", key: "count", label: "Count", min: 0, max: 120, step: 1, value: 30 },
      // Options must match PIXEL_COMETS_DIRECTIONS (tested).
      {
        kind: "toggles",
        key: "direction",
        label: "Direction",
        options: [
          { value: "up", label: "Up" },
          { value: "down", label: "Down" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
        value: ["up", "down", "left", "right"],
      },
      // In half-frames: 0 is the centre, 1 the frame's edge; past 1 a comet arrives from off-card.
      { kind: "slider", key: "originMin", label: "Origin Min", min: 0, max: 2, step: FRAME_DISTANCE_STEP, value: 0 },
      { kind: "slider", key: "originMax", label: "Origin Max", min: 0, max: 2, step: FRAME_DISTANCE_STEP, value: 2 },
      // In half-frames; the max must carry a comet from Origin Max out past the frame (tested).
      { kind: "slider", key: "travelSpans", label: "Travel", min: FRAME_DISTANCE_STEP, max: 4, step: FRAME_DISTANCE_STEP, value: 1.5 },
      // In cells.
      { kind: "slider", key: "tail", label: "Tail", min: 0, max: 60, step: 1, value: 14 },
      { kind: "slider", key: "tailBlend", label: "Tail Blend", min: 0, max: 1, step: 0.1, value: 0 },
      { kind: "slider", key: "falloff", label: "Falloff", min: 0, max: 1, step: 0.1, value: 0.6 },
      // CSS px at Scale 1, excluding the grid line.
      { kind: "slider", key: "pixelSize", label: "Pixel Size", group: "grid", min: 1, max: 20, step: 1, value: 8 },
      // CSS px, added to the pitch rather than taken out of the pixel; 0 hides the lattice.
      { kind: "slider", key: "gridWidth", label: "Grid Width", group: "grid", min: 0, max: 10, step: 0.5, value: 2 },
      // Every nth line uses the Major swatch; 0 is off.
      { kind: "slider", key: "majorGrid", label: "Major Grid", group: "grid", min: 0, max: 15, step: 1, value: 8 },
      { kind: "slider", key: "headGlow", label: "Head Glow", group: "glow", min: 0, max: 2, step: 0.1, value: 0.8 },
      // Max must stay within PIXEL_COMETS_MAX_GLOW_REACH or the bloom clips square (tested).
      { kind: "slider", key: "headRadius", label: "Head Radius", group: "glow", min: 0, max: 3, step: 0.1, value: 1.2 },
      // Backward smear in cells, along the lane, so no reach cap applies.
      { kind: "slider", key: "headStretch", label: "Head Stretch", group: "glow", min: 0, max: 12, step: 0.1, value: 2 },
      { kind: "slider", key: "tailGlow", label: "Tail Glow", group: "glow", min: 0, max: 2, step: 0.1, value: 0.4 },
      { kind: "slider", key: "tailRadius", label: "Tail Radius", group: "glow", min: 0, max: 3, step: 0.1, value: 0.8 },
      { kind: "slider", key: "parallax", label: "Parallax", group: "motion", min: 0, max: 1, step: 0.1, value: 0 },
      { kind: "slider", key: "swerve", label: "Swerve", group: "motion", min: 0, max: 1, step: 0.1, value: 1 },
      { kind: "slider", key: "easing", label: "Easing", group: "motion", min: -1, max: 1, step: 0.1, value: 1 },
      { kind: "slider", key: "easingBias", label: "Easing Bias", group: "motion", min: -1, max: 1, step: 0.1, value: 0 },
      ...FRAMING_CONTROLS,
      ...MOTION_CONTROLS,
    ],
    defaults: {
      colors: ["#4285F4", "#EA4335", "#FBBC05", "#34A853", "#00E5FF"],
      colorBack: "#080B12FF",
      params: { speed: 1 },
    },
  },
};

export const SHADER_IDS = Object.keys(SHADER_SPECS) as ShaderId[];

export function defaultParams(spec: ShaderSpec): Params {
  return Object.fromEntries(
    spec.controls.map((control) => [
      control.key,
      // Copied, so callers can't mutate the table's array.
      Array.isArray(control.value) ? [...control.value] : control.value,
    ]),
  );
}

export interface ShaderState {
  params: Params;
  colors: string[];
  colorBack: string | undefined;
  extraColors: Record<string, string>;
}

/** Fresh objects every call: callers edit them in state. */
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
