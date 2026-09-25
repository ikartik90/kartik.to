import { z } from "zod";
import {
  FRAME_DISTANCE_STEP,
  FRAMING_CONTROLS,
  FRAMING_CONTROL_KEYS,
  PHASE_STEP,
  SHADER_IDS,
  SHADER_SPECS,
  defaultState,
  type ControlSpec,
  type Params,
  type ShaderId,
  type ShaderSpec,
} from "@/data/shader-specs";
import {
  ASPECT_RATIOS,
  type DemoFrameAspectRatio,
} from "@/utils/demo-frame-sizing";
import { wrapRotation } from "@/utils/rotation";
import { TRACK_UNITS_PER_DEGREE } from "@/components/shaders/cosmic-track-uniforms";

// A saved shader background. Shapeless: the host owns size, padding and corner.
// Framing is stored per aspect ratio; the validator is generated from `SHADER_SPECS`.

/** `#RRGGBBAA`; six digits are padded to eight so storage has one form. */
const ShaderPresetColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Expected an #RRGGBB(AA) colour")
  .transform((value) =>
    (value.length === 7 ? `${value}FF` : value).toUpperCase(),
  );

/** A bare string becomes the same colour on both themes. */
const ThemedColorSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? { light: value, dark: value } : value,
  z.object({ light: ShaderPresetColorSchema, dark: ShaderPresetColorSchema }),
);

export type ShaderPresetTheme = "light" | "dark";

export interface ThemedColor {
  light: string;
  dark: string;
}

function themed(color: string): ThemedColor {
  return { light: color, dark: color };
}

export const DEFAULT_SHADER_PRESET_ASPECT: DemoFrameAspectRatio = "1/1";

/**
 * Defaulted so presets saved before a control existed still parse. Ranges are
 * enforced, not clamped, so the panel never shows a value the picture lacks.
 */
function controlSchema(control: ControlSpec): z.ZodTypeAny {
  if (control.kind === "toggle") {
    return z.boolean().default(control.value);
  }
  if (control.kind === "select") {
    return z
      .enum(control.options.map((option) => option.value) as [string, ...string[]])
      .default(control.value);
  }
  if (control.kind === "toggles") {
    // Rejected, not defaulted: all-off is a state the panel can't write and the shader can't draw.
    return z
      .array(
        z.enum(control.options.map((option) => option.value) as [string, ...string[]]),
      )
      .nonempty()
      .default(control.value as [string, ...string[]]);
  }
  return z.number().min(control.min).max(control.max).default(control.value);
}

/** Wraps rotations saved under the old 0..360 range into the signed range (same angle). */
function normaliseRotation(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const framing = { ...(value as Record<string, unknown>) };
  if (typeof framing.rotation === "number") {
    framing.rotation = wrapRotation(framing.rotation);
  }
  return framing;
}

const FramingSchema = z.preprocess(
  normaliseRotation,
  z.object(
    Object.fromEntries(
      FRAMING_CONTROLS.map((control) => [control.key, controlSchema(control)]),
    ),
  ),
);

export type Framing = Record<string, number>;

export const FRAMING_DEFAULTS: Framing = FramingSchema.parse({}) as Framing;

/** Partial: a missing ratio means unframed (see `framingFor`), not framed at the defaults. */
const ShaderPresetFramingSchema = z
  .object(
    Object.fromEntries(
      (Object.keys(ASPECT_RATIOS) as DemoFrameAspectRatio[]).map((aspect) => [
        aspect,
        FramingSchema.optional(),
      ]),
    ),
  )
  .default({});

/** Old key → new key, so a renamed control's stored value isn't stripped and silently defaulted. */
const RENAMED_PARAMS: Record<string, string> = {
  angle: "phase",
  dither: "rampDither",
  ease: "easing",
  easeSkew: "easingBias",
  edgeThickness: "edgeWidth",
};

/** Keyed on the old name so a preset is never converted twice; runs after the renames. */
const RESCALED_PARAMS: {
  was: string;
  now: string;
  /** Set when the old key is still a live control on another shader. */
  shaderId?: ShaderId;
  convert: (value: number) => number;
}[] = [
  {
    // Rounded onto the dial's stops so the slider can show it.
    was: "phase",
    now: "phaseDegrees",
    convert: (value) =>
      Math.round(value / TRACK_UNITS_PER_DEGREE / PHASE_STEP) * PHASE_STEP,
  },
  {
    // Frozen anchors, not read from the control table: a migration must not drift with the defaults.
    was: "travel",
    now: "travelSpans",
    shaderId: "pixelComets",
    convert: (value) =>
      Math.max(
        Math.round(
          (value * TRAVEL_SPANS_AT_UNIT_CHANGE) /
            TRAVEL_CELLS_AT_UNIT_CHANGE /
            FRAME_DISTANCE_STEP,
        ) * FRAME_DISTANCE_STEP,
        // Never below the first stop: a one-cell run converts to less than one.
        FRAME_DISTANCE_STEP,
      ),
  },
];

/** Travel's default before and after the unit change: the conversion's only anchor. */
const TRAVEL_CELLS_AT_UNIT_CHANGE = 40;
const TRAVEL_SPANS_AT_UNIT_CHANGE = 1.5;

function applyRenames(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const params = { ...(value as Record<string, unknown>) };
  for (const [was, now] of Object.entries(RENAMED_PARAMS)) {
    if (was in params && !(now in params)) params[now] = params[was];
    delete params[was];
  }
  return params;
}

function applyRescales(value: unknown, shaderId: ShaderId): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const params = { ...(value as Record<string, unknown>) };
  for (const { was, now, shaderId: only, convert } of RESCALED_PARAMS) {
    if (only !== undefined && only !== shaderId) continue;
    if (!(was in params)) continue;
    const stored = params[was];
    if (typeof stored === "number" && !(now in params)) {
      params[now] = convert(stored);
    }
    delete params[was];
  }
  return params;
}

function migrateParamsFor(shaderId: ShaderId) {
  return (value: unknown): unknown => applyRescales(applyRenames(value), shaderId);
}

/** Migrates a single placement stored in `params` onto `framing[aspect]`, the shape it was saved in. */
function liftFraming(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const settings = { ...(value as Record<string, unknown>) };
  const raw = settings.params;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return settings;
  }

  const params = { ...(raw as Record<string, unknown>) };
  const lifted: Record<string, unknown> = {};
  for (const key of FRAMING_CONTROL_KEYS) {
    if (key in params) {
      lifted[key] = params[key];
      delete params[key];
    }
  }
  settings.params = params;
  if (Object.keys(lifted).length === 0) return settings;

  const stored = settings.framing;
  const framing = { ...(typeof stored === "object" && stored !== null ? stored : {}) } as Record<string, unknown>;
  const aspect =
    typeof settings.aspect === "string" ? settings.aspect : DEFAULT_SHADER_PRESET_ASPECT;
  if (!(aspect in framing)) framing[aspect] = lifted;
  settings.framing = framing;
  return settings;
}

function settingsSchemaFor(spec: ShaderSpec) {
  // Placement controls are stored per shape in `framing`, not here.
  const params = z.preprocess(
    migrateParamsFor(spec.id),
    z.object(
      Object.fromEntries(
        spec.controls
          .filter((control) => !FRAMING_CONTROL_KEYS.includes(control.key))
          .map((control) => [control.key, controlSchema(control)]),
      ),
    ),
  );

  const extraColors = z.object(
    Object.fromEntries(
      spec.extraColors.map((extra) => [
        extra.key,
        ThemedColorSchema.default(themed(extra.value)),
      ]),
    ),
  );

  return z.preprocess(liftFraming, z.object({
    params,
    colors: z
      .array(ThemedColorSchema)
      .min(1)
      .max(spec.maxColors)
      .default(() => spec.defaults.colors.map(themed)),
    // Only for a shader with a ground; omitting the key strips a stored `colorBack`.
    ...(spec.hasColorBack
      ? {
          colorBack: ThemedColorSchema.default(
            themed(spec.defaults.colorBack ?? "#000000FF"),
          ),
        }
      : {}),
    extraColors,
    framing: ShaderPresetFramingSchema,
  }));
}

export interface ShaderPresetSettings {
  params: Params;
  colors: ThemedColor[];
  /** Present only for a shader that HAS a ground behind the fill. */
  colorBack?: ThemedColor;
  extraColors: Record<string, ThemedColor>;
  /** Partial: an unframed shape follows the nearest framed one. */
  framing: Partial<Record<DemoFrameAspectRatio, Framing>>;
}

/** On the log of the ratio, so 2:1 and 1:2 are equally far from 1:1. */
const cropDistance = (a: DemoFrameAspectRatio, b: DemoFrameAspectRatio) => {
  const ratio = (aspect: DemoFrameAspectRatio) => {
    const [width, height] = ASPECT_RATIOS[aspect];
    return Math.log(width / height);
  };
  return Math.abs(ratio(a) - ratio(b));
};

/**
 * An unframed shape follows the nearest framed one; only a preset with no framing
 * uses the defaults. Ties resolve in `ASPECT_RATIOS` order.
 */
export function framingFor(
  settings: ShaderPresetSettings,
  aspect: DemoFrameAspectRatio,
): Framing {
  const own = settings.framing[aspect];
  if (own) return own;

  let nearest: Framing | null = null;
  let best = Infinity;
  for (const key of Object.keys(ASPECT_RATIOS) as DemoFrameAspectRatio[]) {
    const framing = settings.framing[key];
    if (!framing) continue;
    const distance = cropDistance(key, aspect);
    if (distance < best) {
      best = distance;
      nearest = framing;
    }
  }
  return nearest ?? FRAMING_DEFAULTS;
}

/** The placement wins over any stale placement key left in `params`. */
export function shaderParamsFor(
  settings: ShaderPresetSettings,
  aspect: DemoFrameAspectRatio,
): Params {
  return { ...settings.params, ...framingFor(settings, aspect) };
}

export interface ShaderPresetPalette {
  colors: string[];
  /** Present only for a shader that HAS a ground behind the fill. */
  colorBack?: string;
  extraColors: Record<string, string>;
}

/** `colorBack` stays absent (not undefined) so the result spreads onto optional props. */
export function paletteFor(
  settings: ShaderPresetSettings,
  theme: ShaderPresetTheme,
): ShaderPresetPalette {
  return {
    colors: settings.colors.map((color) => color[theme]),
    ...(settings.colorBack ? { colorBack: settings.colorBack[theme] } : {}),
    extraColors: Object.fromEntries(
      Object.entries(settings.extraColors).map(([key, color]) => [
        key,
        color[theme],
      ]),
    ),
  };
}

export interface ShaderPresetContent {
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
}

/** Cast: `SHADER_IDS.map` yields an array where `discriminatedUnion` wants a tuple. */
export const ShaderPresetContentSchema = z.discriminatedUnion(
  "shaderId",
  SHADER_IDS.map((id) =>
    z.object({
      shaderId: z.literal(id),
      settings: settingsSchemaFor(SHADER_SPECS[id]),
    }),
  ) as unknown as [z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]],
) as unknown as z.ZodType<ShaderPresetContent>;

export function shaderPresetContentFor(shaderId: ShaderId): ShaderPresetContent {
  return ShaderPresetContentSchema.parse({
    shaderId,
    settings: defaultState(SHADER_SPECS[shaderId]),
  });
}

export const ShaderPresetSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable().optional(),
  untitledIndex: z.number().int().nullable().optional(),
  shaderId: z.enum(SHADER_IDS as [ShaderId, ...ShaderId[]]),
  settings: z.unknown(),
  /** Null while the preset is the author's alone. */
  publishedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ShaderPreset = z.infer<typeof ShaderPresetSchema>;
