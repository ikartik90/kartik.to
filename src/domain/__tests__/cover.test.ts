import { describe, expect, it } from "vitest";
import { SHADER_IDS, SHADER_SPECS, defaultState } from "@/data/shader-specs";
import {
  CoverContentSchema,
  DEFAULT_COVER_ASPECT,
  FRAMING_DEFAULTS,
  coverContentFor,
  framingFor,
  shaderParamsFor,
} from "../cover";

describe("CoverContentSchema", () => {
  // The playground's own starting point has to be storable, or the first thing
  // anyone saves is a validation error.
  it("accepts every shader's defaults as authored", () => {
    for (const shaderId of SHADER_IDS) {
      const parsed = CoverContentSchema.safeParse({
        shaderId,
        settings: defaultState(SHADER_SPECS[shaderId]),
      });
      expect(parsed.success, `${shaderId} defaults should parse`).toBe(true);
    }
  });

  // A control that gets RENAMED is the one case the two compatibility rules
  // handle badly on their own: the old key is unknown so it is stripped, the
  // new one is missing so it defaults, and a stored value is quietly replaced
  // by the control's default. A cover saved before the rename would open
  // looking wrong with nothing to say why.
  it("carries a stored value across a renamed control", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phaseDegrees: _dropped, ...withoutPhase } = settings.params;

    const result = CoverContentSchema.safeParse({
      shaderId: "cosmicTrack",
      // Exactly what a cover saved before `angle` became `phase` holds.
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

    const result = CoverContentSchema.safeParse({
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

    const result = CoverContentSchema.safeParse({
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

    const result = CoverContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...rest, edgeThickness: 2.5 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.edgeWidth).toBe(2.5);
  });

  it("prefers the current key when a stale one sits beside it", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phaseDegrees: _dropped, ...withoutPhase } = settings.params;
    const result = CoverContentSchema.safeParse({
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
      CoverContentSchema.safeParse({
        shaderId: "notAShader",
        settings: defaultState(SHADER_SPECS.cosmicTrack),
      }).success,
    ).toBe(false);
  });

  // A value the GPU would silently clamp is a slider that lies about what it
  // is doing — the same call `BackgroundEffectSchema` makes.
  it("rejects a param outside the control's own range", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const result = CoverContentSchema.safeParse({
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
    const parsed = CoverContentSchema.parse({
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
    const parsed = CoverContentSchema.parse({
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
      CoverContentSchema.safeParse({
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
    const parsed = CoverContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, colors: ["#2E6BFF"] },
    });
    expect(parsed.settings.colors).toEqual(["#2E6BFFFF"]);
  });

  it("stores every shader's defaults in the canonical eight-digit form", () => {
    for (const shaderId of SHADER_IDS) {
      const parsed = CoverContentSchema.parse({
        shaderId,
        settings: defaultState(SHADER_SPECS[shaderId]),
      });
      for (const color of parsed.settings.colors) {
        expect(color, `${shaderId} colour`).toMatch(/^#[0-9A-F]{8}$/);
      }
    }
  });

  it("rejects something that is not a colour at all", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    expect(
      CoverContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, colors: ["rebeccapurple"] },
      }).success,
    ).toBe(false);
  });

  // A mesh gradient is an opaque fill with no ground behind it, so a stored
  // `colorBack` is meaningless there rather than merely unused.
  it("drops colorBack for a shader that has no background", () => {
    const spec = SHADER_SPECS.staticMeshGradient;
    expect(spec.hasColorBack).toBe(false);
    const parsed = CoverContentSchema.parse({
      shaderId: "staticMeshGradient",
      settings: { ...defaultState(spec), colorBack: "#000000FF" },
    });
    expect(parsed.settings.colorBack).toBeUndefined();
  });

  // The one thing a cover records about SHAPE, and it records it as a note
  // rather than as a size: the aspect the picture was designed against, so
  // reopening it a month later reopens the frame it was judged in. Nothing
  // reading a cover is obliged to honour it — see the module comment.
  it("keeps the aspect the cover was designed at", () => {
    const parsed = CoverContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), aspect: "16/9" },
    });
    expect(parsed.settings.aspect).toBe("16/9");
  });

  it("opens a cover saved before shapes were recorded at the default", () => {
    const parsed = CoverContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: defaultState(SHADER_SPECS.cosmicTrack),
    });
    expect(parsed.settings.aspect).toBe(DEFAULT_COVER_ASPECT);
  });

  // A ratio the app cannot draw is a frame nothing can reopen in, so it is
  // rejected rather than quietly replaced with the default.
  it("rejects a shape that is not one of the app's ratios", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    expect(
      CoverContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, aspect: "7/3" },
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Framing, per shape.
//
// The four placement controls are the only ones whose right value depends on
// the SHAPE the cover is being looked at in — a fan tuned until it reads on a
// 9:16 poster is not framed the same way on a 2:1 banner — so a cover keeps one
// set per aspect ratio rather than one set full stop.
// ---------------------------------------------------------------------------
describe("framing", () => {
  const content = (settings: unknown) =>
    CoverContentSchema.parse({ shaderId: "cosmicTrack", settings });

  it("keeps the placement controls out of the shader's own params", () => {
    const parsed = content(defaultState(SHADER_SPECS.cosmicTrack));

    for (const key of ["scale", "rotation", "offsetX", "offsetY"]) {
      expect(key in parsed.settings.params).toBe(false);
    }
  });

  // The forward-compatibility promise, for a cover written before framing was
  // per-shape: its one set of placement values was tuned against the shape it
  // was saved in, so that is the shape they belong to. Stripping them as
  // unknown keys — which is what the params object would do on its own — would
  // silently unframe every saved cover.
  it("moves a stored cover's placement onto the shape it was saved in", () => {
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

  // A cover written since the split is the authority on itself — the params
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
      CoverContentSchema.safeParse({
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
    CoverContentSchema.parse({
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
      CoverContentSchema.safeParse({
        shaderId: "cosmicTrack",
        settings: { ...settings, framing: { "1/1": { rotation: "sideways" } } },
      }).success,
    ).toBe(false);
  });

  // Every cover saved while the control ran 0..360 holds a rotation this range
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
  // where every cover saved before framing was per-shape keeps its rotation.
  it("wraps a rotation lifted out of a legacy preset's params", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = CoverContentSchema.parse({
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
   * its own default. Sparse on purpose: a cover saved before the degree dial
   * has no `phaseDegrees` key at all, and merging today's defaults in would
   * hand it one and hide the migration under the new-key-wins rule.
   */
  const parse = (params: Record<string, unknown>) =>
    CoverContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), params },
    }).settings.params;

  // A cover saved under the old -7..7 track-unit scale holds a number the new
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
  // would be gone for good. Off by at most half a step, and only for a cover
  // saved before the dial existed.
  it("rounds a converted phase onto the dial's stops", () => {
    // 1.0 track units is 12.9° — a stop and a bit under a stop away.
    expect(parse({ phase: 1 }).phaseDegrees).toBe(15);
    expect(parse({ phase: 0.1 }).phaseDegrees).toBe(0);
  });

  // Square-on is the one value that means the same in either scale, so it must
  // not be converted a second time when the cover is read again.
  it("leaves a phase already dialled in degrees alone", () => {
    expect(parse({ phaseDegrees: 90 }).phaseDegrees).toBe(90);
    expect(parse({ phaseDegrees: 0 }).phaseDegrees).toBe(0);
  });

  // The old key wins nothing where the new one is present: a cover written
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
      ...defaultState(SHADER_SPECS.cosmicTrack),
      aspect: "4/3" as const,
      framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 2 } },
    };

    expect(framingFor(settings).scale).toBe(2);
  });

  // An unframed shape is not a broken one: it reads as the table's own starting
  // point, which is where every control opens before anybody moves it.
  it("falls back to the defaults for a shape nobody has framed", () => {
    const settings = {
      ...defaultState(SHADER_SPECS.cosmicTrack),
      aspect: "4/3" as const,
      framing: {},
    };

    expect(framingFor(settings)).toEqual(FRAMING_DEFAULTS);
  });
});

describe("shaderParamsFor", () => {
  // The canvas takes ONE object. The split is about where a value is kept, not
  // about what the shader is given, so this is the seam that puts them back
  // together — and the framing wins, because a stale placement key surviving in
  // params would otherwise outrank the frame you are looking at.
  it("hands the shader its uniforms with the current frame's placement over them", () => {
    const settings = {
      ...defaultState(SHADER_SPECS.cosmicTrack),
      aspect: "4/3" as const,
      framing: { "4/3": { ...FRAMING_DEFAULTS, scale: 3 } },
    };

    const params = shaderParamsFor(settings);
    expect(params.scale).toBe(3);
    expect(params.rampLength).toBe(
      defaultState(SHADER_SPECS.cosmicTrack).params.rampLength,
    );
  });
});

describe("coverContentFor", () => {
  // What the playground opens on for a shader it has just switched to — the
  // same starting point, but round-tripped through the validator so a defaults
  // table that drifted out of its own ranges fails here rather than on save.
  it("returns a valid content for every shader", () => {
    for (const shaderId of SHADER_IDS) {
      expect(
        CoverContentSchema.safeParse(coverContentFor(shaderId)).success,
      ).toBe(true);
    }
  });
});
