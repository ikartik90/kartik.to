import { describe, expect, it } from "vitest";
import { SHADER_IDS, SHADER_SPECS, defaultState } from "@/data/shader-specs";
import { CoverContentSchema, coverContentFor } from "../cover";

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
