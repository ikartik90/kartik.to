import { z } from "zod";
import {
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

// ---------------------------------------------------------------------------
// Cover — a saved shader background, authored in the playground and reused
// wherever a surface wants a ground: a picture or a clip in a collection, a
// component's backdrop.
//
// SHAPELESS, and the schema is where that is enforced rather than merely
// intended. Nothing here records a size, a padding or a corner: a cover takes
// the shape of whatever it is embedded into, the way an image under
// `object-fit: cover` does, so the host owns every one of those and a column
// for them here would be a second, disagreeing answer. It is the same call
// `shader-specs.ts` already makes in leaving the world box out of the controls
// — the surface IS the canvas — one level up.
//
// `aspect` is the ONE exception, and it is an exception because it is not a
// size: it is the shape the picture was JUDGED against. A god-ray fan tuned
// until it read on a 9:16 poster is a different composition from the same
// uniforms tuned on a 16:9 banner, and reopening the cover a month later
// without that fact means re-deriving it by eye. So it is stored as a note the
// playground reopens in, not as a frame the cover imposes: no consumer reads it
// to shape anything, and a host that embeds this cover in a square still gets a
// square. If it ever starts shaping something, the shapelessness above stops
// being true and this comment is the one that has to change first.
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
const CoverColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Expected an #RRGGBB(AA) colour")
  .transform((value) =>
    (value.length === 7 ? `${value}FF` : value).toUpperCase(),
  );

/**
 * The shape a cover was designed against — one of the app's own eleven ratios,
 * from the single table every aspect in the app is written in.
 *
 * An ENUM rather than a free `"w/h"` string, so a cover cannot record a frame
 * the app has no way of drawing: the playground's picker and the grid card's
 * picker offer the same list, and a twelfth shape added there reaches this
 * schema with no second edit.
 */
const CoverAspectSchema = z.enum(
  Object.keys(ASPECT_RATIOS) as [DemoFrameAspectRatio, ...DemoFrameAspectRatio[]],
);

/**
 * Where the playground opens, and what a cover saved before shapes were
 * recorded reads as: the portrait poster the reference art is drawn on, which
 * is the 380×680 card this playground has always shown.
 */
export const DEFAULT_COVER_ASPECT: DemoFrameAspectRatio = "9/16";

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
 * Controls that have been RENAMED, old key to new.
 *
 * Needed because the two forward-compatibility rules below combine badly for a
 * rename: the old key is unknown so it is stripped, the new one is missing so
 * it defaults, and a stored value is silently replaced by the control's default
 * rather than failing loudly. That is the worst of both — a saved cover opens
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

/**
 * The authored state for ONE shader.
 *
 * Unknown param keys are STRIPPED (Zod's default for an object), which is the
 * other half of forward compatibility: a preset written while a control existed
 * must not fail to parse once that control is retired. Between the two rules a
 * stored preset survives the control table changing under it in either
 * direction, which is the whole point of keeping the table as the source.
 */
function settingsSchemaFor(spec: ShaderSpec) {
  const params = z.preprocess(
    applyRenames,
    z.object(
      Object.fromEntries(
        spec.controls.map((control) => [control.key, controlSchema(control)]),
      ),
    ),
  );

  const extraColors = z.object(
    Object.fromEntries(
      spec.extraColors.map((extra) => [
        extra.key,
        CoverColorSchema.default(extra.value),
      ]),
    ),
  );

  return z.object({
    params,
    colors: z
      .array(CoverColorSchema)
      .min(1)
      .max(spec.maxColors)
      .default(() => [...spec.defaults.colors]),
    // Present exactly when the shader HAS a ground. Omitting the key for a mesh
    // gradient is what strips a stored `colorBack` on the way in: there, the
    // fill is opaque and a background colour is not merely unused but
    // meaningless, so carrying one forward would be recording a fact about the
    // picture that is not true of it.
    ...(spec.hasColorBack
      ? {
          colorBack: CoverColorSchema.default(
            spec.defaults.colorBack ?? "#000000FF",
          ),
        }
      : {}),
    extraColors,
    // Defaulted like a control, and for the same reason: every cover saved
    // before the playground had a frame is missing the key and must still open.
    aspect: CoverAspectSchema.default(DEFAULT_COVER_ASPECT),
  });
}

/** How a cover is set: the shader's uniforms and the colours it is given. */
export interface CoverSettings {
  params: Params;
  colors: string[];
  /** Present only for a shader that HAS a ground behind the fill. */
  colorBack?: string;
  extraColors: Record<string, string>;
  /** The shape it was designed against — a note, not a frame. See above. */
  aspect: DemoFrameAspectRatio;
}

/** A cover's content: which shader, and how it is set. */
export interface CoverContent {
  shaderId: ShaderId;
  settings: CoverSettings;
}

/**
 * The validator — a discriminated union, because the settings' SHAPE depends on
 * the shader: `angle` means nothing to a mesh gradient, and a `colorBack` is
 * meaningless on one. One branch per entry in the table, generated from it, so
 * the union cannot fall behind the shaders that exist.
 *
 * Typed as `CoverContent` rather than by inference, and the cast is the honest
 * move rather than a shortcut. `SHADER_IDS.map` yields an ARRAY where
 * `discriminatedUnion` wants a tuple, so inference is lost either way; and what
 * it would infer is a union of six branches whose `params` keys are literal —
 * a type no caller here can use, since the panel indexes params by a `string`
 * key read off the control table at runtime. The structural type above is what
 * consumers actually hold. The per-shader precision stays where it does the
 * work: at the parse.
 */
export const CoverContentSchema = z.discriminatedUnion(
  "shaderId",
  SHADER_IDS.map((id) =>
    z.object({
      shaderId: z.literal(id),
      settings: settingsSchemaFor(SHADER_SPECS[id]),
    }),
  ) as unknown as [z.ZodObject<z.ZodRawShape>, ...z.ZodObject<z.ZodRawShape>[]],
) as unknown as z.ZodType<CoverContent>;

/** Where a shader opens before anybody has tuned it — the table's own defaults. */
export function coverContentFor(shaderId: ShaderId): CoverContent {
  return CoverContentSchema.parse({
    shaderId,
    settings: defaultState(SHADER_SPECS[shaderId]),
  });
}

/**
 * A saved cover, as the database holds it.
 *
 * `shaderId` is a column of its own rather than a key inside the blob: it is
 * the discriminant every read switches on, it is a closed set, and it is what a
 * future library view would group by. Everything whose shape DEPENDS on it
 * stays in the blob, where it travels as one validated unit.
 */
export const CoverSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable().optional(),
  untitledIndex: z.number().int().nullable().optional(),
  shaderId: z.enum(SHADER_IDS as [ShaderId, ...ShaderId[]]),
  settings: z.unknown(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Cover = z.infer<typeof CoverSchema>;
