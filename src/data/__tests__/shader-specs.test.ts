import { describe, expect, it } from "vitest";
import {
  SHADER_SPECS,
  extraColorRows,
  FRAMING_CONTROL_KEYS,
  MOTION_CONTROL_KEYS,
  defaultParams,
  defaultState,
  type ShaderSpec,
} from "../shader-specs";

const specs = Object.values(SHADER_SPECS) as ShaderSpec[];

/** Every spec, as vitest `each` rows, so a failure names the shader. */
const eachSpec = specs.map((spec) => [spec.id, spec] as const);

describe("defaultParams", () => {
  it("returns one entry per control, holding that control's default", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    const params = defaultParams(spec);

    expect(Object.keys(params).sort()).toEqual(
      spec.controls.map((control) => control.key).sort(),
    );
    for (const control of spec.controls) {
      expect(params[control.key]).toBe(control.value);
    }
  });
});

describe("defaultState", () => {
  it("overrides only the keys the shader's defaults name, leaving the rest at the control's own", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    const controlDefaults = defaultParams(spec);
    const { params } = defaultState(spec);

    for (const [key, value] of Object.entries(controlDefaults)) {
      const override = spec.defaults.params?.[key];
      expect(params[key]).toBe(override ?? value);
    }
  });

  it("carries the colours and background through", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    const result = defaultState(spec);

    expect(result.colors).toEqual(spec.defaults.colors);
    expect(result.colorBack).toBe(spec.defaults.colorBack);
  });

  it("merges the shader's extra colours over the spec's own defaults", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    // The shader has a second colour beyond the ramp (the bloom tint), and the
    // defaults may or may not have an opinion about it.
    expect(spec.extraColors.length).toBeGreaterThan(0);

    const { extraColors } = defaultState(spec);
    for (const extra of spec.extraColors) {
      expect(extraColors[extra.key]).toBe(
        spec.defaults.extraColors?.[extra.key] ?? extra.value,
      );
    }
  });

  it("does not let a caller mutate the spec through the result", () => {
    const spec = SHADER_SPECS.cosmicTrack;
    const first = defaultState(spec);
    first.colors[0] = "#000000FF";
    first.params.scale = 99;

    const second = defaultState(spec);
    expect(second.colors[0]).not.toBe("#000000FF");
    expect(second.params.scale).not.toBe(99);
  });
});

// The table is the contract this page is built on, so it is worth asserting
// against directly: a typo'd key in a shader's defaults is silently inert at
// runtime (the control just keeps its own default) and would otherwise only
// show up as "that shader doesn't open looking right".
describe("the spec table itself", () => {
  it.each(eachSpec)("%s: every default names a control that exists", (_, spec) => {
    const known = new Set(spec.controls.map((control) => control.key));
    for (const key of Object.keys(spec.defaults.params ?? {})) {
      expect(known, key).toContain(key);
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

  it.each(eachSpec)("%s: every default value sits inside its control's range", (_, spec) => {
    const byKey = new Map(spec.controls.map((control) => [control.key, control]));
    for (const [key, value] of Object.entries(spec.defaults.params ?? {})) {
      const control = byKey.get(key);
      if (control?.kind !== "slider") continue;
      expect(value, key).toBeGreaterThanOrEqual(control.min);
      expect(value, key).toBeLessThanOrEqual(control.max);
    }
  });

  it.each(eachSpec)("%s: the defaults do not exceed the shader's colour ceiling", (_, spec) => {
    expect(spec.defaults.colors.length).toBeGreaterThan(0);
    expect(spec.defaults.colors.length).toBeLessThanOrEqual(spec.maxColors);
  });

  // The sidebar renders the framing group by looking each of these up in the
  // shader's own table, so a shader missing one shows a hole rather than an
  // error.
  it.each(eachSpec)("%s: exposes every shared framing control", (_, spec) => {
    const keys = spec.controls.map((control) => control.key);
    for (const key of FRAMING_CONTROL_KEYS) {
      expect(keys, key).toContain(key);
    }
  });

  // Motion is NOT shared, and that is the point of it being its own block: a
  // shader whose fragment shader never reads `u_time` must not carry a Speed
  // slider, and the type system will never catch one that does — every
  // paper-shaders component ACCEPTS `speed`, since they all extend
  // `ShaderMotionParams`. The table's one static shader (StaticMeshGradient)
  // went with the rest of the built-ins, so every spec left animates; the
  // exception this row used to carry is the shape to bring back with the next
  // shader that does not.
  it.each(eachSpec)("%s: animates, so it exposes the motion controls", (_, spec) => {
    const keys = spec.controls.map((control) => control.key);
    for (const key of MOTION_CONTROL_KEYS) {
      expect(keys, key).toContain(key);
    }
  });

  // ONE decimal in the panel, everywhere. The readout's precision is taken from
  // the step (see `formatSliderValue`), so this is the only place it is set —
  // and a stray hundredth would show up as a control that reads to a different
  // precision from the ones above and below it.
  it.each(eachSpec)("%s: no slider asks for a second decimal", (_, spec) => {
    for (const control of spec.controls) {
      if (control.kind !== "slider") continue;
      expect(
        Number.isInteger(control.step * 10),
        `${control.label} steps by ${control.step}`,
      ).toBe(true);
    }
  });

  it.each(eachSpec)("%s: only shaders with a background take one", (_, spec) => {
    expect(spec.defaults.colorBack === undefined).toBe(!spec.hasColorBack);
  });
});

// The panel draws one row per GROUP of extra colours, not one per colour, so
// that two inks which are one decision (a lattice's minor and major) sit side
// by side under a single label. The grouping is a reading of the TABLE, which
// is why it is asserted here rather than through the sidebar.
describe("extraColorRows", () => {
  it("gives a colour naming no row a row of its own, under its own label", () => {
    const rows = extraColorRows(SHADER_SPECS.cosmicTrack);

    expect(rows).toHaveLength(SHADER_SPECS.cosmicTrack.extraColors.length);
    for (const row of rows) {
      expect(row.colors).toHaveLength(1);
      expect(row.label).toBe(row.colors[0].label);
    }
  });

  it("collapses colours naming the same row, keeping the table's order", () => {
    const rows = extraColorRows(SHADER_SPECS.nexus);
    const grid = rows.find((row) => row.label === "Grid");

    expect(grid?.colors.map((color) => color.key)).toEqual([
      "colorGrid",
      "colorGridMajor",
    ]);
    // The FIRST of them names the row — the second is a swatch beside it, not a
    // row of its own.
    expect(rows.some((row) => row.label === "Major")).toBe(false);
  });

  it("names every one of a shader's extra colours exactly once", () => {
    // The rows are what the panel renders, so a colour missing from them is a
    // control the author cannot reach, and one appearing twice is two swatches
    // writing the same key.
    for (const spec of specs) {
      const drawn = extraColorRows(spec).flatMap((row) =>
        row.colors.map((color) => color.key),
      );
      expect(drawn.sort(), spec.id).toEqual(
        spec.extraColors.map((extra) => extra.key).sort(),
      );
    }
  });
});
