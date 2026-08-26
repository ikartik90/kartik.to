import { describe, expect, it } from "vitest";
import { SHADER_IDS, SHADER_SPECS, defaultState } from "@/data/shader-specs";
import {
  CoverContentSchema,
  DEFAULT_COVER_ASPECT,
  coverContentFor,
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
    const { phase: _dropped, ...withoutPhase } = settings.params;

    const result = CoverContentSchema.safeParse({
      shaderId: "cosmicTrack",
      // Exactly what a cover saved before `angle` became `phase` holds.
      settings: { ...settings, params: { ...withoutPhase, angle: -2.4 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.phase).toBe(-2.4);
    // The retired key does not survive alongside the one that replaced it.
    expect(result.success && "angle" in result.data.settings.params).toBe(false);
  });

  it("carries a stored value across every renamed control", () => {
    // One table, so a second rename is a row rather than a code path — but the
    // row still has to be exercised, or the next one is added untested.
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { phase: _p, rampDither: _d, ...rest } = settings.params;

    const result = CoverContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: { ...rest, angle: -1.5, dither: 0.8 } },
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.settings.params.phase).toBe(-1.5);
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
    const result = CoverContentSchema.safeParse({
      shaderId: "cosmicTrack",
      settings: {
        ...settings,
        params: { ...settings.params, phase: 1.5, angle: -2.4 },
      },
    });

    expect(result.success && result.data.settings.params.phase).toBe(1.5);
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
      settings: { ...settings, params: { ...settings.params, scale: 99 } },
    });
    expect(result.success).toBe(false);
  });

  // Forward compatibility, both directions. A preset written before a control
  // existed must still open, and one written before a control was REMOVED must
  // not fail on the leftover key.
  it("fills in a param the stored preset predates", () => {
    const settings = defaultState(SHADER_SPECS.cosmicTrack);
    const { scale: _dropped, ...withoutScale } = settings.params;
    const parsed = CoverContentSchema.parse({
      shaderId: "cosmicTrack",
      settings: { ...settings, params: withoutScale },
    });
    expect(parsed.settings.params.scale).toBe(1);
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
