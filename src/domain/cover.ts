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

// ---------------------------------------------------------------------------
// Cover — a saved shader background, authored in the playground and reused
// wherever a surface wants a ground: a picture or a clip in a collection, a
// component's backdrop.
//
// SHAPELESS, and the schema is where that is enforced rather than merely
// intended. Nothing here records a size, an aspect, a padding or a corner: a
// cover takes the shape of whatever it is embedded into, the way an image
// under `object-fit: cover` does, so the host owns every one of those and a
// column for them here would be a second, disagreeing answer. It is the same
// call `shader-specs.ts` already makes in leaving the world box out of the
// controls — the surface IS the canvas — one level up.
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
 * The authored state for ONE shader.
 *
 * Unknown param keys are STRIPPED (Zod's default for an object), which is the
 * other half of forward compatibility: a preset written while a control existed
 * must not fail to parse once that control is retired. Between the two rules a
 * stored preset survives the control table changing under it in either
 * direction, which is the whole point of keeping the table as the source.
 */
function settingsSchemaFor(spec: ShaderSpec) {
  const params = z.object(
    Object.fromEntries(
      spec.controls.map((control) => [control.key, controlSchema(control)]),
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
  });
}

/** How a cover is set: the shader's uniforms and the colours it is given. */
export interface CoverSettings {
  params: Params;
  colors: string[];
  /** Present only for a shader that HAS a ground behind the fill. */
  colorBack?: string;
  extraColors: Record<string, string>;
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
