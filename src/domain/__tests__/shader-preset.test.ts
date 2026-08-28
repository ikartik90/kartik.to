import { describe, expect, it } from "vitest";
import { SHADER_IDS, SHADER_SPECS, defaultState } from "@/data/shader-specs";
import {
  ShaderPresetContentSchema,
  FRAMING_DEFAULTS,
  shaderPresetContentFor,
  framingFor,
  paletteFor,
  shaderParamsFor,
} from "../shader-preset";

describe("ShaderPresetContentSchema", () => {
  // The playground's own starting point has to be storable, or the first thing
  // anyone saves is a validation error.
  it("accepts every shader's defaults as authored", () => {
    for (const shaderId of SHADER_IDS) {
      const parsed = ShaderPresetContentSchema.safeParse({
        shaderId,
        settings: defaultState(SHADER_SPECS[shaderId]),
      });
      expect(parsed.success, `${shaderId} defaults should parse`).toBe(true);
    }
  });

  // A control that gets RENAMED is the one case the two compatibility rules
  // handle badly on their own: the old key is unknown so it is stripped, the
  // new one is missing so it defaults, and a stored value is quietly replaced
  // by the control's default. A preset saved before the rename would open
  // looking wrong with nothing to say why.
  it("carries a stored value across a renamed control", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phaseDegrees: _dropped, ...withoutPhase } = settings.params;

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      // Exactly what a preset saved before `angle` became `phase` holds.
      settings: { ...settings, params: { ...withoutPhase, angle: -7 } },
    });

    expect(result.success).toBe(true);
    // Two migrations in a chain: `angle` became `phase`, and `phase` is now
    // dialled in degrees — so a value from the very first naming still lands.
    expect(result.success && result.data.settings.params.phaseDegrees).toBe(-90);
    // The retired keys do not survive alongside the one that replaced them.
    expect(result.success && "angle" in result.data.settings.params).toBe(false);
    expect(result.success && "phase" in result.data.settings.params).toBe(false);
  });

  it("carries a stored value across every renamed control", () => {
    // One table, so a second rename is a row rather than a code path — but the
    // row still has to be exercised, or the next one is added untested.
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phaseDegrees: _p, rampDither: _d, ...rest } = settings.params;

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...rest, angle: -7, dither: 0.8 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.phaseDegrees).toBe(-90);
    expect(result.success && result.data.settings.params.rampDither).toBe(0.8);
  });

  // `ease`/`easeSkew` were renamed to say what they are rather than what they do
  // to a curve. The VALUES carry over unchanged on purpose: 1 was the fully
  // eased swing under the old 0..2 range and still is under -1..1, and 0 was a
  // linear one either way — so the rename is a rename, not a re-tuning.
  it("carries the easing controls across their rename", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { easing: _e, easingBias: _b, ...rest } = settings.params;

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...rest, ease: 0.4, easeSkew: -0.7 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.easing).toBe(0.4);
    expect(result.success && result.data.settings.params.easingBias).toBe(-0.7);
  });

  // `edgeThickness` became `edgeWidth` — the same measurement, said the way the
  // rest of the panel says it. Range and meaning are untouched, so the stored
  // value carries straight over.
  it("carries the rails' width across its rename", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { edgeWidth: _w, ...rest } = settings.params;

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...rest, edgeThickness: 2.5 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.edgeWidth).toBe(2.5);
  });

  it("prefers the current key when a stale one sits beside it", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phaseDegrees: _dropped, ...withoutPhase } = settings.params;
    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      // Both namings of the same control, from two different eras. The later
      // one is what the author last wrote; the earlier is residue.
      settings: {
        ...settings,
        params: { ...withoutPhase, phase: 7, angle: -2.4 },
      },
    });

    expect(result.success && result.data.settings.params.phaseDegrees).toBe(90);
  });

  it("rejects a shader it has never heard of", () => {
    expect(
      ShaderPresetContentSchema.safeParse({
        shaderId: "notAShader",
        settings: defaultState(SHADER_SPECS.cosmicTrack),
      }).success,
    ).toBe(false);
  });

  // A value the GPU would silently clamp is a slider that lies about what it
  // is doing — the same call `BackgroundEffectSchema` makes.
  it("rejects a param outside the control's own range", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...settings.params, rampLength: 99 } },
    });
    expect(result.success).toBe(false);
  });

  // Forward compatibility, both directions. A preset written before a control
  // existed must still open, and one written before a control was REMOVED must
  // not fail on the leftover key.
  it("fills in a param the stored preset predates", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { rampLength: _dropped, ...withoutRampLength } = settings.params;
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: withoutRampLength },
    });
    // The CONTROL's own default, which is what a missing key falls back to —
    // not the shader's `defaults.params` override, which is where the preset
    // started rather than where the schema puts it back.
    const control = SHADER_SPECS.cosmicTrack.controls.find(
      (spec) => spec.key === "rampLength",
    );
    expect(parsed.settings.params.rampLength).toBe(control?.value);
  });

  it("strips a param the shader no longer has", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...settings.params, retired: 3 } },
    });
    expect("retired" in parsed.settings.params).toBe(false);
  });

  it("holds the colour list to the shader's own ceiling", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    const settings = defaultState(spec);
    const tooMany = Array.from(
      { length: spec.maxColors + 1 },
      () => "#FFFFFFFF",
    );
    expect(
      ShaderPresetContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, colors: tooMany },
      }).success,
    ).toBe(false);
  });

  // A hand-written six-digit colour is legitimate INPUT — `parseColor` says so
  // ("a colour written by hand doesn't have to spell out FF"), and the spec
  // table takes it at its word. What is STORED is canonical, though: eight
  // digits always, so nothing downstream has to ask which form it is holding.
  it("normalises a six-digit colour to eight rather than rejecting it", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, colors: ["#2E6BFF"] },
    });
    // Both halves of the pair the bare string became — normalising happens
    // after the split, so neither half can be the short form.
    expect(parsed.settings.colors).toEqual([
      { light: "#2E6BFFFF", dark: "#2E6BFFFF" },
    ]);
  });

  it("stores every shader's defaults in the canonical eight-digit form", () => {
    for (const shaderId of SHADER_IDS) {
      const parsed = ShaderPresetContentSchema.parse({
        shaderId,
        settings: defaultState(SHADER_SPECS[shaderId]),
      });
      for (const color of parsed.settings.colors) {
        expect(color.light, `${shaderId} light colour`).toMatch(
          /^#[0-9A-F]{8}$/,
        );
        expect(color.dark, `${shaderId} dark colour`).toMatch(/^#[0-9A-F]{8}$/);
      }
    }
  });

  it("rejects something that is not a colour at all", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    expect(
      ShaderPresetContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, colors: ["rebeccapurple"] },
      }).success,
    ).toBe(false);
  });

  // A shader that is an opaque fill has no ground behind it, so a stored
  // `colorBack` is meaningless there rather than merely unused, and the schema
  // drops it on the way in.
  //
  // UNREACHABLE while every shader in `SHADER_SPECS` has a ground — the branch
  // is keyed on the table's `hasColorBack`, and the one shader that answered
  // false (StaticMeshGradient) left with the other built-ins. Kept as a todo
  // because the rule is still in the schema and the next groundless shader
  // needs it proved.
  it.todo("drops colorBack for a shader that has no background");

  // The one thing a preset records about SHAPE, and it records it as a note
  // rather than as a size: the aspect the picture was designed against, so
  // reopening it a month later reopens the frame it was judged in. Nothing
  // reading a preset is obliged to honour it — see the module comment.
  // A preset no longer records the shape it was judged in: it is framed for
  // every shape, so the note said nothing the `framing` keys do not. Any value
  // still in the column is dropped on the way in, the way every retired key is
  // — the playground opens square whatever a stored preset used to say.
  it("drops the shape a preset used to record", () => {
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), aspect: "16/9" },
    });
    expect("aspect" in parsed.settings).toBe(false);
  });

  // A ratio the app cannot draw is now only reachable as a `framing` key, and
  // it is stripped there rather than refused — see "rejects a shape the app
  // cannot draw" below.
});

// ---------------------------------------------------------------------------
// Framing, per shape.
//
// The four placement controls are the only ones whose right value depends on
// the SHAPE the preset is being looked at in — a fan tuned until it reads on a
// 9:16 poster is not framed the same way on a 2:1 banner — so a preset keeps one
// set per aspect ratio rather than one set full stop.
// ---------------------------------------------------------------------------
describe("framing", () => {
  const content = (settings: unknown) =>
    ShaderPresetContentSchema.parse({ shaderId: "cosmicTrack", settings });

  it("keeps the placement controls out of the shader's own params", () => {
    const parsed = content(defaultState(SHADER_SPECS.cosmicTrack));

    for (const key of ["scale", "rotation", "offsetX", "offsetY"]) {
      expect(key in parsed.settings.params).toBe(false);
    }
  });

  // The forward-compatibility promise, for a preset written before framing was
  // per-shape: its one set of placement values was tuned against the shape it
  // was saved in, so that is the shape they belong to. Stripping them as
  // unknown keys — which is what the params object would do on its own — would
  // silently unframe every saved preset.
  it("moves a stored preset's placement onto the shape it was saved in", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = content({
      ...settings,
      aspect: "2/1",
      params: { ...settings.params, scale: 2.5, rotation: 45 },
    });

    expect(parsed.settings.framing["2/1"]).toMatchObject({
      scale: 2.5,
      rotation: 45,
    });
  });

  it("leaves every other shape unframed", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = content({
      ...settings,
      aspect: "2/1",
      params: { ...settings.params, scale: 2.5 },
    });

    expect(parsed.settings.framing["1/2"]).toBeUndefined();
    expect(parsed.settings.framing["9/16"]).toBeUndefined();
  });

  // A preset written since the split is the authority on itself — the params
  // beside it are residue and must not overwrite what it says.
  it("does not overwrite a shape that is already framed", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = content({
      ...settings,
      aspect: "2/1",
      params: { ...settings.params, scale: 2.5 },
      framing: { "2/1": { ...FRAMING_DEFAULTS, scale: 4 } },
    });

    expect(parsed.settings.framing["2/1"]?.scale).toBe(4);
  });

  // The same range enforcement the params get, for the same reason: a value the
  // GPU would silently clamp is a slider lying about what it is doing.
  it("rejects a placement outside the control's own range", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    expect(
      ShaderPresetContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, framing: { "1/1": { scale: 99 } } },
      }).success,
    ).toBe(false);
  });

  it("rejects a shape the app cannot draw", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = content({
      ...settings,
      framing: { "7/3": { ...FRAMING_DEFAULTS } },
    });

    expect("7/3" in parsed.settings.framing).toBe(false);
  });
});

// Rotation reads -180..180 with zero in the middle, so that a turn either way
// from square-on is a move away from zero rather than a wrap through 360.
describe("rotation", () => {
  const content = (framing: unknown) =>
    ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), framing },
    });

  it("accepts both ends of the range and the zero between them", () => {
    for (const rotation of [-180, -90, 0, 90, 180]) {
      expect(content({ "1/1": { rotation } }).settings.framing["1/1"]?.rotation).toBe(
        rotation,
      );
    }
  });

  // An angle is MODULAR, unlike every other control here — so a rotation past
  // the end of the range is wrapped rather than refused. 400° names the same
  // picture as 40°, so a slider showing 40 is telling the truth, which is the
  // whole reason the other controls enforce their ranges instead of clamping.
  // (Scale has no such reading: 99 is not another way of writing a scale the
  // shader can draw, and `framing` above pins that it is still rejected.)
  it("wraps a rotation past the end of the range rather than refusing it", () => {
    expect(content({ "1/1": { rotation: 400 } }).settings.framing["1/1"]?.rotation).toBe(40);
    expect(content({ "1/1": { rotation: -400 } }).settings.framing["1/1"]?.rotation).toBe(-40);
  });

  it("still rejects a rotation that is not a number at all", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    expect(
      ShaderPresetContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, framing: { "1/1": { rotation: "sideways" } } },
      }).success,
    ).toBe(false);
  });

  // Every preset saved while the control ran 0..360 holds a rotation this range
  // has no room for, and the schema ENFORCES its ranges rather than clamping —
  // so without this a preset tuned to 270° would stop opening at all. The
  // wrapped value is the same angle, so the picture is untouched; clamping to
  // 180 would have quietly re-tuned it.
  it("carries a rotation saved under the old 0-360 range across", () => {
    expect(content({ "1/1": { rotation: 270 } }).settings.framing["1/1"]?.rotation).toBe(-90);
    expect(content({ "1/1": { rotation: 360 } }).settings.framing["1/1"]?.rotation).toBe(0);
    expect(content({ "1/1": { rotation: 181 } }).settings.framing["1/1"]?.rotation).toBe(-179);
  });

  // The same wrap has to reach the placement lifted out of `params`, which is
  // where every preset saved before framing was per-shape keeps its rotation.
  it("wraps a rotation lifted out of a legacy preset's params", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: {
        ...settings,
        aspect: "2/1",
        params: { ...settings.params, rotation: 270 },
      },
    });

    expect(parsed.settings.framing["2/1"]?.rotation).toBe(-90);
  });

  // A value already inside the range is left exactly as it is — 180 must not
  // become -180 just because the two name the same angle. The slider would jump
  // from one end of the track to the other for no reason the author can see.
  it("leaves a rotation already in range untouched", () => {
    expect(content({ "1/1": { rotation: 180 } }).settings.framing["1/1"]?.rotation).toBe(180);
  });
});

// Phase became a degree dial, reading and stepping like the Rotation beside it.
// Its stored numbers had to be re-expressed, which is the one migration in this
// file that changes a value rather than moving it.
describe("phase", () => {
  /**
   * A stored blob holding ONLY these params — every other control fills in from
   * its own default. Sparse on purpose: a preset saved before the degree dial
   * has no `phaseDegrees` key at all, and merging today's defaults in would
   * hand it one and hide the migration under the new-key-wins rule.
   */
  const parse = (params: Record<string, unknown>) =>
    ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), params },
    }).settings.params;

  // A preset saved under the old -7..7 track-unit scale holds a number the new
  // dial would read as a few degrees. Carried across by the SCALE the two share
  // — a QUARTER turn is the seven units the old control ran to — so the picture
  // is the one that was saved.
  it("carries a phase saved under the old track-unit scale across", () => {
    expect(parse({ phase: 7 }).phaseDegrees).toBe(90);
    expect(parse({ phase: -7 }).phaseDegrees).toBe(-90);
    expect(parse({ phase: 3.5 }).phaseDegrees).toBe(45);
  });

  // Rounded onto the dial's own stops, because a value between them is one the
  // control cannot express: the slider would show the nearest stop while the
  // shader drew something else, and the moment you touched it the original
  // would be gone for good. Off by at most half a step, and only for a preset
  // saved before the dial existed.
  it("rounds a converted phase onto the dial's stops", () => {
    // 1.0 track units is 12.9° — a stop and a bit under a stop away.
    expect(parse({ phase: 1 }).phaseDegrees).toBe(15);
    expect(parse({ phase: 0.1 }).phaseDegrees).toBe(0);
  });

  // Square-on is the one value that means the same in either scale, so it must
  // not be converted a second time when the preset is read again.
  it("leaves a phase already dialled in degrees alone", () => {
    expect(parse({ phaseDegrees: 90 }).phaseDegrees).toBe(90);
    expect(parse({ phaseDegrees: 0 }).phaseDegrees).toBe(0);
  });

  // The old key wins nothing where the new one is present: a preset written
  // since the dial is the authority on itself.
  it("prefers the degree dial when a stale track-unit key sits beside it", () => {
    expect(parse({ phase: 7, phaseDegrees: 45 }).phaseDegrees).toBe(45);
  });

  // The rename chain from the reference's original word still lands: `angle`
  // became `phase`, and `phase` is now dialled in degrees.
  it("carries the reference's original `angle` all the way through", () => {
    expect(parse({ angle: 3.5 }).phaseDegrees).toBe(45);
  });
});

describe("framingFor", () => {
  it("gives the shape's own framing where it has one", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 2 } },
    };

    expect(framingFor(settings, "4/3").scale).toBe(2);
  });

  // A shape nobody framed follows the CLOSEST shape somebody did. A preset is
  // authored for every ratio, so what a container gets is the placement from
  // the nearest shape the preset was actually judged in — not a starting point
  // no eye ever approved.
  it("follows the closest framed shape for one nobody has framed", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: {
        "1/1": { ...FRAMING_DEFAULTS, scale: 2 },
        "9/16": { ...FRAMING_DEFAULTS, scale: 4 },
      },
    };

    // 6:5 is a hair off square, and a long way off a poster.
    expect(framingFor(settings, "6/5").scale).toBe(2);
    // 1:2 is the other way about.
    expect(framingFor(settings, "1/2").scale).toBe(4);
  });

  // Closeness is measured on the RATIO rather than on the key, so the nearest
  // shape is the one that crops the picture most like this one — which lands on
  // the same orientation whenever the preset has been framed in it.
  it("prefers a framed shape of the same orientation to a nearer-named one", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: {
        "4/3": { ...FRAMING_DEFAULTS, scale: 2 },
        "9/16": { ...FRAMING_DEFAULTS, scale: 4 },
      },
    };

    expect(framingFor(settings, "3/4").scale).toBe(4);
  });

  // Two framed shapes equally far off resolve by the app's own table order, so
  // a preset draws the same way twice — 4:3 and 3:4 are the same distance from
  // square, and the answer must not depend on which key was written first.
  it("settles a tie the same way every time", () => {
    const framing = {
      "3/4": { ...FRAMING_DEFAULTS, scale: 3 },
      "4/3": { ...FRAMING_DEFAULTS, scale: 2 },
    };
    const base = shaderPresetContentFor("cosmicTrack").settings;

    expect(framingFor({ ...base, framing }, "1/1").scale).toBe(2);
    expect(
      framingFor(
        { ...base, framing: { "4/3": framing["4/3"], "3/4": framing["3/4"] } },
        "1/1",
      ).scale,
    ).toBe(2);
  });

  // An unframed shape in a preset nobody has framed AT ALL is not a broken one:
  // it reads as the table's own starting point, which is where every control
  // opens before anybody moves it.
  it("falls back to the defaults where nothing has been framed", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: {},
    };

    expect(framingFor(settings, "4/3")).toEqual(FRAMING_DEFAULTS);
  });
});

describe("shaderParamsFor", () => {
  // The canvas takes ONE object. The split is about where a value is kept, not
  // about what the shader is given, so this is the seam that puts them back
  // together — and the framing wins, because a stale placement key surviving in
  // params would otherwise outrank the frame you are looking at.
  it("hands the shader its uniforms with the current frame's placement over them", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 3 } },
    };

    const params = shaderParamsFor(settings, "4/3");
    expect(params.scale).toBe(3);
    expect(params.rampLength).toBe(
      defaultState(SHADER_SPECS.cosmicTrack).params.rampLength,
    );
  });
});

describe("shaderPresetContentFor", () => {
  // What the playground opens on for a shader it has just switched to — the
  // same starting point, but round-tripped through the validator so a defaults
  // table that drifted out of its own ranges fails here rather than on save.
  it("returns a valid content for every shader", () => {
    for (const shaderId of SHADER_IDS) {
      expect(
        ShaderPresetContentSchema.safeParse(shaderPresetContentFor(shaderId)).success,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Per-theme colours. Every colour a preset holds is a light/dark PAIR, so the
// same preset can read on either ground without a second preset existing.
// ---------------------------------------------------------------------------
describe("themed colours", () => {
  it("splits a preset written with one colour per stop into a matching pair", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      // Exactly what every preset saved before the split holds: bare strings.
      settings: { ...settings, colors: ["#FFAB6F", "#FF4D97FF"] },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.colors).toEqual([
      { light: "#FFAB6FFF", dark: "#FFAB6FFF" },
      { light: "#FF4D97FF", dark: "#FF4D97FF" },
    ]);
  });

  it("splits the background and the extra colours too", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: {
        ...settings,
        colorBack: "#101010FF",
        extraColors: { colorEdge: "#FFFFFF" },
      },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.colorBack).toEqual({
      light: "#101010FF",
      dark: "#101010FF",
    });
    expect(result.success && result.data.settings.extraColors.colorEdge).toEqual(
      { light: "#FFFFFFFF", dark: "#FFFFFFFF" },
    );
  });

  it("leaves a pair that already differs alone", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: {
        ...settings,
        colors: [{ light: "#000000FF", dark: "#FFFFFFFF" }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.colors).toEqual([
      { light: "#000000FF", dark: "#FFFFFFFF" },
    ]);
  });

  it("still rejects anything that is not a colour, in either half", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    for (const colors of [
      ["rebeccapurple"],
      [{ light: "#FFFFFFFF", dark: "nope" }],
    ]) {
      expect(
        ShaderPresetContentSchema.safeParse({
          shaderId: "cosmicTrack",
          settings: { ...settings, colors },
        }).success,
      ).toBe(false);
    }
  });
});

describe("paletteFor", () => {
  it("hands the shader one colour per stop, on the theme asked for", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      colors: [{ light: "#000000FF", dark: "#FFFFFFFF" }],
      colorBack: { light: "#EEEEEEFF", dark: "#111111FF" },
      extraColors: { colorEdge: { light: "#FF0000FF", dark: "#00FF00FF" } },
    };

    expect(paletteFor(settings, "light")).toEqual({
      colors: ["#000000FF"],
      colorBack: "#EEEEEEFF",
      extraColors: { colorEdge: "#FF0000FF" },
    });
    expect(paletteFor(settings, "dark")).toEqual({
      colors: ["#FFFFFFFF"],
      colorBack: "#111111FF",
      extraColors: { colorEdge: "#00FF00FF" },
    });
  });

  // ABSENT rather than undefined, so the palette can be spread onto a component
  // whose prop is optional without handing it a key it has no meaning for. The
  // settings are what this reads — a preset with no ground carries no
  // `colorBack`, whichever shader left it that way.
  it("leaves colorBack absent where the settings carry none", () => {
    const { colorBack: _none, ...settings } = shaderPresetContentFor(
      "cosmicTrack",
    ).settings;

    expect("colorBack" in paletteFor(settings, "light")).toBe(false);
  });
});
