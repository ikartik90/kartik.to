import { describe, expect, it } from "vitest";
import {
  SHADER_SPECS,
  defaultParams,
  presetParams,
  type ShaderSpec,
} from "../shader-specs";

const specs = Object.values(SHADER_SPECS) as ShaderSpec[];

/** Every spec, as vitest `each` rows, so a failure names the shader. */
const eachSpec = specs.map((spec) => [spec.id, spec] as const);

describe("defaultParams", () => {
  it("returns one entry per control, holding that control's default", () => {
    const spec = SHADER_SPECS.colorPanels;
    const params = defaultParams(spec);

    expect(Object.keys(params).sort()).toEqual(
      spec.controls.map((control) => control.key).sort(),
    );
    for (const control of spec.controls) {
      expect(params[control.key]).toBe(control.value);
    }
  });
});

describe("presetParams", () => {
  it("overrides only the keys the preset names, leaving the rest at default", () => {
    const spec = SHADER_SPECS.colorPanels;
    const preset = spec.presets[0];
    const defaults = defaultParams(spec);
    const { params } = presetParams(spec, preset.id);

    for (const [key, value] of Object.entries(defaults)) {
      const override = preset.params?.[key];
      expect(params[key]).toBe(override ?? value);
    }
  });

  it("carries the preset's colours and background through", () => {
    const spec = SHADER_SPECS.colorPanels;
    const preset = spec.presets[0];
    const result = presetParams(spec, preset.id);

    expect(result.colors).toEqual(preset.colors);
    expect(result.colorBack).toBe(preset.colorBack);
  });

  it("merges a preset's extra colours over the spec's own defaults", () => {
    const spec = SHADER_SPECS.godRays;
    // The shader has a second colour beyond the ramp (the bloom tint), and a
    // preset may or may not have an opinion about it.
    expect(spec.extraColors.length).toBeGreaterThan(0);

    for (const preset of spec.presets) {
      const { extraColors } = presetParams(spec, preset.id);
      for (const extra of spec.extraColors) {
        expect(extraColors[extra.key]).toBe(
          preset.extraColors?.[extra.key] ?? extra.value,
        );
      }
    }
  });

  it("falls back to the plain defaults for an unknown preset", () => {
    const spec = SHADER_SPECS.colorPanels;
    const result = presetParams(spec, "no-such-preset");

    expect(result.params).toEqual(defaultParams(spec));
  });

  it("does not let a caller mutate the spec through the result", () => {
    const spec = SHADER_SPECS.colorPanels;
    const first = presetParams(spec, spec.presets[0].id);
    first.colors[0] = "#000000FF";

    expect(presetParams(spec, spec.presets[0].id).colors[0]).not.toBe(
      "#000000FF",
    );
  });
});

// The table is the contract these pages are built on, so it is worth asserting
// against directly: a typo'd preset key is silently inert at runtime (the
// shader just keeps its default) and would otherwise only show up as "that
// preset doesn't look right".
describe("the spec table itself", () => {
  it.each(eachSpec)("%s: every preset names a control that exists", (_, spec) => {
    const known = new Set(spec.controls.map((control) => control.key));
    for (const preset of spec.presets) {
      for (const key of Object.keys(preset.params ?? {})) {
        expect(known, `${preset.id} → ${key}`).toContain(key);
      }
    }
  });

  it.each(eachSpec)("%s: every slider default sits inside its own range", (_, spec) => {
    for (const control of spec.controls) {
      if (control.kind !== "slider") continue;
      expect(control.min).toBeLessThan(control.max);
      expect(control.value).toBeGreaterThanOrEqual(control.min);
      expect(control.value).toBeLessThanOrEqual(control.max);
    }
  });

  it.each(eachSpec)("%s: every preset value sits inside its control's range", (_, spec) => {
    const byKey = new Map(spec.controls.map((control) => [control.key, control]));
    for (const preset of spec.presets) {
      for (const [key, value] of Object.entries(preset.params ?? {})) {
        const control = byKey.get(key);
        if (control?.kind !== "slider") continue;
        expect(value, `${preset.id} → ${key}`).toBeGreaterThanOrEqual(control.min);
        expect(value, `${preset.id} → ${key}`).toBeLessThanOrEqual(control.max);
      }
    }
  });

  it.each(eachSpec)("%s: no preset exceeds the shader's colour ceiling", (_, spec) => {
    for (const preset of spec.presets) {
      expect(preset.colors.length, preset.id).toBeGreaterThan(0);
      expect(preset.colors.length, preset.id).toBeLessThanOrEqual(spec.maxColors);
    }
  });

  it.each(eachSpec)("%s: only shaders with a background take one", (_, spec) => {
    for (const preset of spec.presets) {
      expect(preset.colorBack === undefined, preset.id).toBe(!spec.hasColorBack);
    }
  });

  it.each(eachSpec)("%s: preset ids are unique", (_, spec) => {
    const ids = spec.presets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
