import { z } from "zod";
import {
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

// ---------------------------------------------------------------------------
// ShaderPreset — a saved shader background, authored in the playground and
// reused wherever a surface wants a ground: a picture or a clip in a
// collection, a component's backdrop.
//
// SHAPELESS, and the schema is where that is enforced rather than merely
// intended. Nothing here records a size, a padding or a corner: a preset takes
// the shape of whatever it is embedded into, the way an image under
// `object-fit: cover` does, so the host owns every one of those and a column
// for them here would be a second, disagreeing answer. It is the same call
// `shader-specs.ts` already makes in leaving the world box out of the controls
// — the surface IS the canvas — one level up.
//
// There is no exception, and there used to be one. A preset recorded the shape
// it was last JUDGED in and reopened there — a note rather than a frame, on the
// grounds that a god-ray fan tuned until it read on a 9:16 poster is a
// different composition from the same uniforms tuned on a 16:9 banner, and
// reopening a month later without that fact meant re-deriving it by eye.
//
// Framing per shape is what retired it. The fact the note carried is now
// carried properly, by a placement filed under each ratio, so the note was
// down to naming which of them you happened to look at last — a worse answer
// than the neutral one, and one more thing in the column for a reader to
// reconcile. The playground opens every preset square (see
// `DEFAULT_SHADER_PRESET_ASPECT`) and which shape you are in is the
// playground's own state, not the preset's.
//
// FRAMING is kept per shape, and it is what makes that possible.
// The four placement controls — scale, rotation, and the two offsets — are the
// only ones whose right value depends on the shape you are looking at: the same
// fan needs a different crop on a 2:1 banner than on a 9:16 poster, where every
// other uniform means exactly what it meant before. So `params` holds what the
// shader is, `framing` holds one placement per ratio, and `shaderParamsFor`
// puts them back together on the way to the canvas. Neither is complete on its
// own, which is the point: there is one place a placement for a given shape can
// live, and no way for two of them to disagree.
//
// EVERY ratio is its own, including the two halves of an orientation pair.
// Turning the frame over is not a special case here and deliberately gets no
// automatic quarter turn: 3:4 is simply a shape you have not framed yet, which
// opens on the placement you arrived with and is then yours to reframe, exactly
// like 2:1 or 6:5. An automatic turn would be the one shape change that also
// edited a control, and undoing it by hand is worse than never having it.
//
// The validator is GENERATED from `SHADER_SPECS` rather than written out. That
// table is the only place a uniform's range is written down, and it has already
// paid for the lesson elsewhere in this codebase: hand-kept copies drift, a
// correction lands in one of them, and every test stays green. A twelfth
// control must be one line THERE and reach this schema for free.
// ---------------------------------------------------------------------------

/**
 * A colour, stored as `#RRGGBBAA` — opacity is part of the colour rather than a
 * sibling field, so there is exactly one place a colour's alpha can live and no
 * way for the two to disagree (the same call `nodes.ts` makes).
 *
 * SIX digits are accepted on the way in and padded to eight, because
 * `parseColor` already says a hand-written colour "doesn't have to spell out
 * FF" and the spec table takes it at its word — `cosmicTrack`'s ramp is written
 * six-digit and `staticMeshGradient`'s eight. Normalising here rather than
 * rewriting the table keeps the authoring convenience and still leaves exactly
 * one form in the database, so nothing downstream has to ask which it is
 * holding. Anything that is not a hex colour is still rejected.
 */
const ShaderPresetColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Expected an #RRGGBB(AA) colour")
  .transform((value) =>
    (value.length === 7 ? `${value}FF` : value).toUpperCase(),
  );

/**
 * A colour a preset holds: one for each ground it can be read on.
 *
 * EVERY colour is a pair — the ramp's stops, the background and the rails alike
 * — because a preset is embedded in a page that has a theme, and a fan tuned to
 * read on paper is not the same fan on ink. Two presets would have been the
 * other answer, and it is the wrong one: everything else about them (the
 * shader, its uniforms, the framing per shape) would then exist twice with
 * nothing keeping the copies in step.
 *
 * A BARE STRING on the way in becomes the same colour twice, which is both the
 * migration for every preset written before the split and the rule for
 * authoring by hand — `shader-specs.ts` still writes one colour per stop,
 * because a reference palette read off the artwork has no opinion about themes
 * until somebody gives it one. "I have not chosen a dark colour" and "the dark
 * colour is the light one" are the same state deliberately: a pair that has
 * never been split is indistinguishable from one split into two identical
 * halves, so there is no third thing for the panel to render or the schema to
 * carry.
 */
const ThemedColorSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? { light: value, dark: value } : value,
  z.object({ light: ShaderPresetColorSchema, dark: ShaderPresetColorSchema }),
);

/** Which ground a colour is being read on. */
export type ShaderPresetTheme = "light" | "dark";

/** One colour, per ground. See {@link ThemedColorSchema}. */
export interface ThemedColor {
  light: string;
  dark: string;
}

/**
 * One colour on both grounds — an unsplit pair.
 *
 * The same thing `ThemedColorSchema` does to a bare string on the way in, in
 * the form a DEFAULT has to be written: Zod types `.default()` against a
 * schema's output, so the spec table's `"#FFFFFFFF"` cannot be handed over
 * as-is even though a stored one parses. Written once here rather than as
 * `{ light: v, dark: v }` at each of the three sites, so the rule that an
 * unchosen dark colour is the light one lives in one place.
 */
function themed(color: string): ThemedColor {
  return { light: color, dark: color };
}



/**
 * Where the playground opens, every time.
 *
 * The SQUARE, and it is a starting point rather than a remembered one. A preset
 * used to record the shape it was last judged in and reopen there, back when it
 * held one framing: which shape you had been looking at was the only clue to
 * what that framing had been tuned for. A preset now holds a framing per shape,
 * so there is nothing left for the note to say — and a shape picked once,
 * months ago, is a worse answer than the neutral one.
 *
 * Neutral is why it is 1:1: it is the one shape that favours neither
 * orientation, so the first thing you see is the composition rather than a crop
 * of it.
 */
export const DEFAULT_SHADER_PRESET_ASPECT: DemoFrameAspectRatio = "1/1";

/**
 * One control's validator, with the control's own default behind it.
 *
 * Defaulted rather than required, and that is the forward-compatibility half of
 * the contract: a preset saved before a control existed is missing that key,
 * and it must still open — picking up the new control's default — rather than
 * failing to parse. `BackgroundEffectSchema` makes the same promise ("`{}` is a
 * complete, valid effect") for the same reason.
 *
 * The RANGE is enforced rather than clamped. A value outside a uniform's
 * documented range is silently clamped by the GPU, which would leave the panel
 * reading a number the picture does not have — a slider lying about what it is
 * doing, which is worse than a rejected save.
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
  return z.number().min(control.min).max(control.max).default(control.value);
}

/**
 * A rotation saved under the old 0..360 range, brought into the signed
 * -180..180 the control reads today.
 *
 * The value migration that a range change needs, and the counterpart to
 * `RENAMED_PARAMS`: there the key moved and the value meant the same thing,
 * here the key is the same and the number has to be re-expressed. Without it a
 * preset tuned to 270° would stop opening — the schema ENFORCES its ranges
 * rather than clamping, on purpose, because a slider reading a number the
 * picture does not have is worse than a rejected save.
 *
 * WRAPPED rather than clamped, because 270 and -90 are the same angle: the
 * picture is untouched and only the way it is written down has changed.
 * Clamping to 180 would have quietly re-tuned every preset that used the far
 * half of the old range.
 *
 * The wrap itself is `@/utils/rotation`'s, shared with the background effect on
 * a media node — a preset reused as a background must not be described one way
 * here and another way there.
 */
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

/**
 * One shape's placement: the four framing controls, with their own ranges and
 * their own defaults behind them.
 *
 * Generated from the same array the sidebar renders, so a fifth placement
 * control is one line there and reaches this schema, the defaults below and the
 * per-shape map for free.
 */
const FramingSchema = z.preprocess(
  normaliseRotation,
  z.object(
    Object.fromEntries(
      FRAMING_CONTROLS.map((control) => [control.key, controlSchema(control)]),
    ),
  ),
);

/** How the graphic sits in ONE frame — see `FRAMING_CONTROLS`. */
export type Framing = Record<string, number>;

/**
 * Where a shape opens before anybody has framed it.
 *
 * PARSED from an empty object rather than written out, because every field of
 * `FramingSchema` already carries its control's default: asking the schema is
 * the one reading that cannot drift from the table the sliders are built from.
 */
export const FRAMING_DEFAULTS: Framing = FramingSchema.parse({}) as Framing;

/**
 * Every shape's placement, keyed by ratio — and PARTIAL, deliberately.
 *
 * A missing key is the honest record of "nobody has framed this shape", which
 * is a different fact from "framed at the defaults" and the one the playground
 * needs: a shape being looked at for the first time inherits the placement you
 * arrived with (see `seedFraming`), where a shape you have already framed keeps
 * what you gave it. A complete record would have to invent an answer for ten
 * shapes nobody had opened, and the difference would be gone.
 *
 * An OBJECT over the eleven known keys rather than a `z.record`, so a ratio the
 * app cannot draw is stripped on the way in the same way an unknown param is —
 * a stored placement for a shape with no frame to draw it in is residue, not a
 * reason to refuse the whole preset.
 */
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

/**
 * Controls that have been RENAMED, old key to new.
 *
 * Needed because the two forward-compatibility rules below combine badly for a
 * rename: the old key is unknown so it is stripped, the new one is missing so
 * it defaults, and a stored value is silently replaced by the control's default
 * rather than failing loudly. That is the worst of both — a saved preset opens
 * looking wrong and nothing says why. Moving the value across first turns a
 * rename back into what it should be, which is nothing happening at all.
 *
 * Keyed by nothing but the name, since a param key is unique across the whole
 * control table by construction; a shader that never had the old key simply has
 * no such entry to move.
 */
const RENAMED_PARAMS: Record<string, string> = {
  // `angle` was the reference's word for it and never meant an angle here — it
  // is where the set sits along the track. Renamed once the coordinate became
  // signed, at which point it reads as a phase end to end.
  angle: "phase",
  // Renamed once the rails got a dither of their own: with two of them, the
  // bare word said which one only by being the older.
  dither: "rampDither",
  // Renamed to say what they ARE rather than what they do to a curve, and to
  // stop reading as a verb beside the nouns around them. The values carry over
  // untouched: 1 was the fully eased swing under the old 0..2 range and still is
  // under -1..1, and 0 was a linear one either way.
  ease: "easing",
  easeSkew: "easingBias",
  // Renamed to say it the way the rest of the panel says a measurement, and to
  // stop it reading as a property of the swatch it sits beside. Same number,
  // same range — the stored value carries straight over.
  edgeThickness: "edgeWidth",
};

/**
 * Controls whose stored VALUE has to be re-expressed, not merely moved.
 *
 * The counterpart to `RENAMED_PARAMS` above, and separate from it on purpose:
 * that table's whole promise is that nothing happens to the number, and folding
 * a conversion into it would quietly break the one thing it guarantees. A
 * rename with a value change is a different act, and this is where it is
 * written down.
 *
 * Keyed on the OLD name, which is also what makes the migration idempotent: the
 * old key is gone once it has been converted, so a preset read twice is not
 * converted twice. That is why the key changes at all — the two scales overlap
 * near zero, so no amount of looking at a bare number can tell a stored 0.5 in
 * the old units from a legitimate 0.5 in the new.
 *
 * Runs AFTER the renames, so a chain still lands: the reference's `angle`
 * becomes `phase`, and `phase` is then dialled in degrees.
 */
const RESCALED_PARAMS: {
  was: string;
  now: string;
  convert: (value: number) => number;
}[] = [
  {
    // Phase was a signed distance along the track, -7..7. It is now dialled in
    // degrees so that it reads like a dial, with a QUARTER turn standing for
    // the full reach the old control had — so this is the conversion that keeps
    // every saved preset looking the way it looked.
    //
    // ROUNDED onto the dial's own stops, because a value between them is one
    // the control cannot express: the slider would show the nearest stop while
    // the shader drew something else, and the first touch of the control would
    // lose the original for good. At most half a step, and only for a preset
    // saved before the dial existed.
    was: "phase",
    now: "phaseDegrees",
    convert: (value) =>
      Math.round(value / TRACK_UNITS_PER_DEGREE / PHASE_STEP) * PHASE_STEP,
  },
];

/** Moves any stored value under a retired key onto the key that replaced it. */
function applyRenames(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const params = { ...(value as Record<string, unknown>) };
  for (const [was, now] of Object.entries(RENAMED_PARAMS)) {
    // The new key wins if BOTH are present: a preset written since the rename
    // is the authority on itself, and a stale key beside it is residue.
    if (was in params && !(now in params)) params[now] = params[was];
    delete params[was];
  }
  return params;
}

/** Re-expresses any stored value whose scale has changed — see `RESCALED_PARAMS`. */
function applyRescales(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const params = { ...(value as Record<string, unknown>) };
  for (const { was, now, convert } of RESCALED_PARAMS) {
    if (!(was in params)) continue;
    const stored = params[was];
    // The new key wins if BOTH are present, exactly as a rename does: a preset
    // written since the change is the authority on itself.
    if (typeof stored === "number" && !(now in params)) {
      params[now] = convert(stored);
    }
    delete params[was];
  }
  return params;
}

/** Every stored-params migration, in the order they have to run. */
function migrateParams(value: unknown): unknown {
  return applyRescales(applyRenames(value));
}

/**
 * The authored state for ONE shader.
 *
 * Unknown param keys are STRIPPED (Zod's default for an object), which is the
 * other half of forward compatibility: a preset written while a control existed
 * must not fail to parse once that control is retired. Between the two rules a
 * stored preset survives the control table changing under it in either
 * direction, which is the whole point of keeping the table as the source.
 */
/**
 * Moves a stored preset's ONE placement onto the shape it was saved in.
 *
 * The migration for every preset written before framing was per-shape. Those
 * four keys sat in `params`, where the object schema would now strip them as
 * unknown — silently unframing every saved preset, which is precisely the
 * failure `RENAMED_PARAMS` exists to prevent one control at a time. The values
 * were tuned against the shape the preset was saved in, so that is the shape
 * they belong to; every other shape is left unframed, to inherit the first time
 * it is opened.
 *
 * At the SETTINGS level rather than inside the params preprocess, because it
 * needs `aspect`, which is the params' sibling and not its own field.
 *
 * A preset written since the split wins outright: a placement already recorded
 * for that shape is what the author last chose, and a stale params key beside
 * it is residue.
 */
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
  // The shader's OWN uniforms. The placement controls are filtered out rather
  // than merely ignored: `spec.controls` is the complete list of what the
  // shader takes, and this is the layer that decides a placement is stored per
  // shape instead of once.
  const params = z.preprocess(
    migrateParams,
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
    // Present exactly when the shader HAS a ground. Omitting the key for a mesh
    // gradient is what strips a stored `colorBack` on the way in: there, the
    // fill is opaque and a background colour is not merely unused but
    // meaningless, so carrying one forward would be recording a fact about the
    // picture that is not true of it.
    ...(spec.hasColorBack
      ? {
          colorBack: ThemedColorSchema.default(
            themed(spec.defaults.colorBack ?? "#000000FF"),
          ),
        }
      : {}),
    extraColors,
    // No `aspect`. A preset used to record the shape it was last judged in, and
    // reopening there was the point; now that it holds a framing per shape,
    // that note says nothing the `framing` keys do not. It is left out rather
    // than stored and ignored — a stored value nothing reads is one that
    // eventually disagrees with something. Any still in the column is dropped
    // on the way in, the way every retired key is.
    framing: ShaderPresetFramingSchema,
  }));
}

/** How a preset is set: the shader's uniforms and the colours it is given. */
export interface ShaderPresetSettings {
  params: Params;
  colors: ThemedColor[];
  /** Present only for a shader that HAS a ground behind the fill. */
  colorBack?: ThemedColor;
  extraColors: Record<string, ThemedColor>;
  /**
   * How the graphic sits in each shape that has been framed.
   *
   * Partial: a shape with no entry has never been framed, and opens on the
   * placement you arrived with. See `ShaderPresetFramingSchema` and
   * `seedFraming`.
   */
  framing: Partial<Record<DemoFrameAspectRatio, Framing>>;
}

/**
 * How the graphic sits in ONE shape.
 *
 * The shape is passed in rather than read off the preset, because a preset no
 * longer has one: it is framed for every shape, and which of them you want is
 * the caller's business — the playground asks for the frame on screen, a
 * thumbnail asks for the square it is drawn in, and an embed would ask for the
 * shape of the surface it fills.
 */
export function framingFor(
  settings: ShaderPresetSettings,
  aspect: DemoFrameAspectRatio,
): Framing {
  return settings.framing[aspect] ?? FRAMING_DEFAULTS;
}

/**
 * Everything the mounted shader is handed: its own uniforms, with the current
 * frame's placement over them.
 *
 * The split is about where a value is KEPT, and the canvas takes one object —
 * so this is the seam that puts the two halves back together, and every surface
 * that draws a preset goes through it. The placement wins the overlap, which
 * only matters for a preset mid-migration: a stale placement key left in params
 * must not outrank the frame you are looking at.
 */
export function shaderParamsFor(
  settings: ShaderPresetSettings,
  aspect: DemoFrameAspectRatio,
): Params {
  return { ...settings.params, ...framingFor(settings, aspect) };
}

/** What a mounted shader is handed once a ground has been chosen. */
export interface ShaderPresetPalette {
  colors: string[];
  /** Present only for a shader that HAS a ground behind the fill. */
  colorBack?: string;
  extraColors: Record<string, string>;
}

/**
 * Every colour the preset holds, resolved onto ONE ground.
 *
 * The companion to `shaderParamsFor`, and the same kind of seam: the canvas
 * takes flat colours, a preset stores pairs, and this is the one place the
 * choice between them is made. Which theme is the CALLER's to know — the
 * playground asks for the one its preview card is standing in, which is not
 * necessarily the page's; a preset embedded in an article asks for the
 * article's.
 *
 * `colorBack` stays ABSENT rather than becoming undefined for a shader with no
 * ground, so the object can be spread onto a component whose prop is optional
 * without handing it a key it has no meaning for.
 */
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


/** A preset's content: which shader, and how it is set. */
export interface ShaderPresetContent {
  shaderId: ShaderId;
  settings: ShaderPresetSettings;
}

/**
 * The validator — a discriminated union, because the settings' SHAPE depends on
 * the shader: `angle` means nothing to a mesh gradient, and a `colorBack` is
 * meaningless on one. One branch per entry in the table, generated from it, so
 * the union cannot fall behind the shaders that exist.
 *
 * Typed as `ShaderPresetContent` rather than by inference, and the cast is the
 * honest move rather than a shortcut. `SHADER_IDS.map` yields an ARRAY where
 * `discriminatedUnion` wants a tuple, so inference is lost either way; and what
 * it would infer is a union of six branches whose `params` keys are literal —
 * a type no caller here can use, since the panel indexes params by a `string`
 * key read off the control table at runtime. The structural type above is what
 * consumers actually hold. The per-shader precision stays where it does the
 * work: at the parse.
 */
export const ShaderPresetContentSchema = z.discriminatedUnion(
  "shaderId",
  SHADER_IDS.map((id) =>
    z.object({
      shaderId: z.literal(id),
      settings: settingsSchemaFor(SHADER_SPECS[id]),
    }),
  ) as unknown as [z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]],
) as unknown as z.ZodType<ShaderPresetContent>;

/** Where a shader opens before anybody has tuned it — the table's own defaults. */
export function shaderPresetContentFor(shaderId: ShaderId): ShaderPresetContent {
  return ShaderPresetContentSchema.parse({
    shaderId,
    settings: defaultState(SHADER_SPECS[shaderId]),
  });
}

/**
 * A saved preset, as the database holds it.
 *
 * `shaderId` is a column of its own rather than a key inside the blob: it is
 * the discriminant every read switches on, it is a closed set, and it is what a
 * future library view would group by. Everything whose shape DEPENDS on it
 * stays in the blob, where it travels as one validated unit.
 */
export const ShaderPresetSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable().optional(),
  untitledIndex: z.number().int().nullable().optional(),
  shaderId: z.enum(SHADER_IDS as [ShaderId, ...ShaderId[]]),
  settings: z.unknown(),
  /**
   * When the preset went on show, and null while it is the author's alone.
   *
   * The DATE rather than a boolean, matching `Post.publishedAt`: it records
   * when as well as whether, and a boolean beside a timestamp is the pair that
   * eventually disagrees. Nothing reads the moment yet — what every read of the
   * library does with it is ask whether it is null (see `getShaderPresets`) —
   * but the cheap column is the one that can answer "since when" later without
   * a migration.
   */
  publishedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ShaderPreset = z.infer<typeof ShaderPresetSchema>;
