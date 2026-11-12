import { describe, expect, it } from "vitest";
import { SHADER_SPECS, type SliderSpec } from "@/data/shader-specs";
import { PALETTE } from "../ds-tokens";
import { hexOf } from "../oklch";
import { GROUND_SLIDERS, PRISM_GROUND, mergeGround } from "../prism-ground";

const sw = (ramp: string, step: string) =>
  hexOf(PALETTE.find((r) => r.name === ramp)!.steps.find(([s]) => s === step)![1]);

const sliders = SHADER_SPECS.prismFold.controls.filter((c): c is SliderSpec => c.kind === "slider");

describe("the overlay's Prism Fold ground", () => {
  it("holds Kartik's tuned values, in blues from SW Curie, standing still", () => {
    expect(PRISM_GROUND).toEqual({
      colors: ["#B9CFFEFF", "#9AB6F9FF", sw("Blue Ribbon", "300"), sw("Blue Ribbon", "200"), "#4168D8FF", sw("Blue Ribbon", "400")],
      colorSeam: "#FFFFFFFF",
      folds: 2,
      fan: 60,
      curve: 0.4,
      lift: 0.6,
      softness: 0.1,
      spread: 0.8,
      warp: 0.2,
      sheen: 0.8,
      sheenWidth: 0.4,
      seam: 0.8,
      seamWidth: 2,
      seamFalloff: 0.1,
      dispersion: 0.5,
      grain: 0,
      scale: 1.01,
      rotation: 15,
      offsetX: 0.1,
      offsetY: -0.2,
      speed: 0,
    });
  });

  it("has a slider for every number it holds, from the playground's spec", () => {
    expect(GROUND_SLIDERS.map((s) => s.key)).toEqual(sliders.map((s) => s.key));
    const numbers = Object.entries(PRISM_GROUND).filter(([, v]) => typeof v === "number").map(([k]) => k);
    expect(numbers.sort()).toEqual(sliders.map((s) => s.key).sort());
  });

  it("takes valid numbers over the current ones, kept within each slider's range", () => {
    const next = mergeGround(PRISM_GROUND, { folds: 3, curve: 99, grain: -5, fan: "wide", lift: Number.NaN });
    expect(next).toMatchObject({ folds: 3, curve: 4, grain: 0, fan: PRISM_GROUND.fan, lift: PRISM_GROUND.lift });
  });

  it("takes a ramp of one to eight hex colours and a hex seam colour", () => {
    expect(mergeGround(PRISM_GROUND, { colors: ["#112233", "#445566FF"], colorSeam: "#ABCDEF80" })).toMatchObject({
      colors: ["#112233", "#445566FF"],
      colorSeam: "#ABCDEF80",
    });
  });

  it("keeps the current colours when given an empty, too long or malformed ramp", () => {
    for (const colors of [[], Array(9).fill("#FFFFFF"), ["red"], ["#FFF", 4]]) {
      expect(mergeGround(PRISM_GROUND, { colors, folds: 1 })?.colors).toEqual(PRISM_GROUND.colors);
    }
    expect(mergeGround(PRISM_GROUND, { colorSeam: "white", folds: 1 })?.colorSeam).toBe(PRISM_GROUND.colorSeam);
  });

  it("returns null when given nothing it knows, so a stray paste changes nothing", () => {
    expect(mergeGround(PRISM_GROUND, null)).toBeNull();
    expect(mergeGround(PRISM_GROUND, [1, 2])).toBeNull();
    expect(mergeGround(PRISM_GROUND, { unknown: 1 })).toBeNull();
  });
});
