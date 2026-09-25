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
  it("accepts every shader's defaults as authored", () => {
    for (const shaderId of SHADER_IDS) {
      const parsed = ShaderPresetContentSchema.safeParse({
        shaderId,
        settings: defaultState(SHADER_SPECS[shaderId]),
      });
      expect(parsed.success, `${shaderId} defaults should parse`).toBe(true);
    }
  });

  it("carries a stored value across a renamed control", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phaseDegrees: _dropped, ...withoutPhase } = settings.params;

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...withoutPhase, angle: -7 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.phaseDegrees).toBe(-90);
    expect(result.success && "angle" in result.data.settings.params).toBe(false);
    expect(result.success && "phase" in result.data.settings.params).toBe(false);
  });

  it("carries a stored value across every renamed control", () => {
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

  it("rejects a param outside the control's own range", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...settings.params, rampLength: 99 } },
    });
    expect(result.success).toBe(false);
  });

  it("fills in a param the stored preset predates", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { rampLength: _dropped, ...withoutRampLength } = settings.params;
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: withoutRampLength },
    });
    // The control's own default, not the shader's `defaults.params` override.
    const control = SHADER_SPECS.cosmicTrack.controls.find(
      (spec) => spec.key === "rampLength",
    );
    expect(parsed.settings.params.rampLength).toBe(control?.value);
  });

  it("refuses a toggle row stored with nothing pressed", () => {
    const settings = defaultState(SHADER_SPECS.pixelComets);

    expect(() =>
      ShaderPresetContentSchema.parse({
        shaderId: "pixelComets",
        settings: { ...settings, params: { ...settings.params, direction: [] } },
      }),
    ).toThrow();
  });

  it("opens a preset written before the toggle row on all of its options", () => {
    const settings = defaultState(SHADER_SPECS.pixelComets);
    const { direction: _dropped, ...withoutDirection } = settings.params;
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "pixelComets",
      settings: { ...settings, params: withoutDirection },
    });

    const control = SHADER_SPECS.pixelComets.controls.find(
      (spec) => spec.key === "direction",
    );
    expect(parsed.settings.params.direction).toEqual(
      control?.kind === "toggles" ? control.value : undefined,
    );
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

  it("normalises a six-digit colour to eight rather than rejecting it", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, colors: ["#2E6BFF"] },
    });
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

  // A todo: unreachable while every shader in `SHADER_SPECS` has a ground.
  it.todo("drops colorBack for a shader that has no background");

  it("drops the shape a preset used to record", () => {
    const parsed = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), aspect: "16/9" },
    });
    expect("aspect" in parsed.settings).toBe(false);
  });
});

describe("framing", () => {
  const content = (settings: unknown) =>
    ShaderPresetContentSchema.parse({ shaderId: "cosmicTrack", settings });

  it("keeps the placement controls out of the shader's own params", () => {
    const parsed = content(defaultState(SHADER_SPECS.cosmicTrack));

    for (const key of ["scale", "rotation", "offsetX", "offsetY"]) {
      expect(key in parsed.settings.params).toBe(false);
    }
  });

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

  it("carries a rotation saved under the old 0-360 range across", () => {
    expect(content({ "1/1": { rotation: 270 } }).settings.framing["1/1"]?.rotation).toBe(-90);
    expect(content({ "1/1": { rotation: 360 } }).settings.framing["1/1"]?.rotation).toBe(0);
    expect(content({ "1/1": { rotation: 181 } }).settings.framing["1/1"]?.rotation).toBe(-179);
  });

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

  it("leaves a rotation already in range untouched", () => {
    expect(content({ "1/1": { rotation: 180 } }).settings.framing["1/1"]?.rotation).toBe(180);
  });
});

describe("phase", () => {
  // Sparse on purpose: a preset saved before the degree dial has no `phaseDegrees` key.
  const parse = (params: Record<string, unknown>) =>
    ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), params },
    }).settings.params;

  it("carries a phase saved under the old track-unit scale across", () => {
    expect(parse({ phase: 7 }).phaseDegrees).toBe(90);
    expect(parse({ phase: -7 }).phaseDegrees).toBe(-90);
    expect(parse({ phase: 3.5 }).phaseDegrees).toBe(45);
  });

  it("rounds a converted phase onto the dial's stops", () => {
    // 1.0 track units is 12.9° — a stop and a bit under a stop away.
    expect(parse({ phase: 1 }).phaseDegrees).toBe(15);
    expect(parse({ phase: 0.1 }).phaseDegrees).toBe(0);
  });

  it("leaves a phase already dialled in degrees alone", () => {
    expect(parse({ phaseDegrees: 90 }).phaseDegrees).toBe(90);
    expect(parse({ phaseDegrees: 0 }).phaseDegrees).toBe(0);
  });

  it("prefers the degree dial when a stale track-unit key sits beside it", () => {
    expect(parse({ phase: 7, phaseDegrees: 45 }).phaseDegrees).toBe(45);
  });

  it("carries the reference's original `angle` all the way through", () => {
    expect(parse({ angle: 3.5 }).phaseDegrees).toBe(45);
  });
});

describe("travel", () => {
  const parse = (params: Record<string, unknown>) =>
    ShaderPresetContentSchema.parse({
      shaderId: "pixelComets",
      settings: { ...defaultState(SHADER_SPECS.pixelComets), params },
    }).settings.params;

  it("carries a travel saved in cells across on the defaults' own scale", () => {
    expect(parse({ travel: 40 }).travelSpans).toBe(1.5);
    expect(parse({ travel: 80 }).travelSpans).toBe(3);
  });

  it("holds a run too short to express on the slider's first stop", () => {
    expect(parse({ travel: 1 }).travelSpans).toBe(0.1);
  });

  it("rounds a converted travel onto the slider's stops", () => {
    expect(parse({ travel: 41 }).travelSpans).toBe(1.5);
    expect(parse({ travel: 55 }).travelSpans).toBe(2.1);
  });

  it("leaves a travel already measured in half-frames alone", () => {
    expect(parse({ travelSpans: 2.5 }).travelSpans).toBe(2.5);
  });

  it("prefers the new measure when a stale cell count sits beside it", () => {
    expect(parse({ travel: 40, travelSpans: 3 }).travelSpans).toBe(3);
  });

  it("leaves the other shader's own travel where it is", () => {
    const params = ShaderPresetContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...defaultState(SHADER_SPECS.cosmicTrack), params: { travel: 3 } },
    }).settings.params;

    expect(params.travel).toBe(3);
    expect("travelSpans" in params).toBe(false);
  });

  it("drops a stored seed rather than reading it as a distance", () => {
    expect("seed" in parse({ seed: 42 })).toBe(false);
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

  it("follows the closest framed shape for one nobody has framed", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: {
        "1/1": { ...FRAMING_DEFAULTS, scale: 2 },
        "9/16": { ...FRAMING_DEFAULTS, scale: 4 },
      },
    };

    expect(framingFor(settings, "6/5").scale).toBe(2);
    expect(framingFor(settings, "1/2").scale).toBe(4);
  });

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

  it("falls back to the defaults where nothing has been framed", () => {
    const settings = {
      ...shaderPresetContentFor("cosmicTrack").settings,
      framing: {},
    };

    expect(framingFor(settings, "4/3")).toEqual(FRAMING_DEFAULTS);
  });
});

describe("shaderParamsFor", () => {
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
  it("returns a valid content for every shader", () => {
    for (const shaderId of SHADER_IDS) {
      expect(
        ShaderPresetContentSchema.safeParse(shaderPresetContentFor(shaderId)).success,
      ).toBe(true);
    }
  });
});

describe("themed colours", () => {
  it("splits a preset written with one colour per stop into a matching pair", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);

    const result = ShaderPresetContentSchema.safeParse({
      shaderId: "cosmicTrack",
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

  it("leaves colorBack absent where the settings carry none", () => {
    const { colorBack: _none, ...settings } = shaderPresetContentFor(
      "cosmicTrack",
    ).settings;

    expect("colorBack" in paletteFor(settings, "light")).toBe(false);
  });
});
