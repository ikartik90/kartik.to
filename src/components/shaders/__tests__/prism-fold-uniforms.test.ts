import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRISM_FOLD,
  PRISM_FOLD_MAX_COLORS,
  PRISM_FOLD_MAX_FOLDS,
  toPrismFoldUniforms,
} from "../prism-fold-uniforms";

describe("toPrismFoldUniforms", () => {
  it("converts each colour to a straight RGBA vec4 in 0..1", () => {
    const { u_colors } = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      colors: ["#FF0000FF", "#0000FF80"],
    });

    expect(u_colors[0]).toEqual([1, 0, 0, 1]);
    const [r, g, b, a] = u_colors[1];
    expect([r, g, b]).toEqual([0, 0, 1]);
    expect(a).toBeCloseTo(0.5, 2);
  });

  it("pads the colours to the uniform's size but reports the real count", () => {
    const uniforms = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      colors: ["#FF0000FF", "#00FF00FF", "#0000FFFF"],
    });

    expect(uniforms.u_colors).toHaveLength(PRISM_FOLD_MAX_COLORS);
    expect(uniforms.u_colorsCount).toBe(3);
  });

  it("clamps a colour list longer than the shader's slot", () => {
    const uniforms = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      colors: Array.from({ length: PRISM_FOLD_MAX_COLORS + 3 }, () => "#FFFFFFFF"),
    });

    expect(uniforms.u_colors).toHaveLength(PRISM_FOLD_MAX_COLORS);
    expect(uniforms.u_colorsCount).toBe(PRISM_FOLD_MAX_COLORS);
  });

  it("falls back to the seam colour when given no colours, never a zero count", () => {
    const uniforms = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      colors: [],
      colorSeam: "#00FF00FF",
    });

    expect(uniforms.u_colorsCount).toBe(1);
    expect(uniforms.u_colors[0]).toEqual([0, 1, 0, 1]);
  });

  it("turns the fan from degrees into radians", () => {
    const { u_fan } = toPrismFoldUniforms({ ...DEFAULT_PRISM_FOLD, fan: 90 });
    expect(u_fan).toBeCloseTo(Math.PI / 2, 5);
  });

  it("keeps the fold count a whole number within the shader's loop", () => {
    expect(toPrismFoldUniforms({ ...DEFAULT_PRISM_FOLD, folds: 2.6 }).u_folds).toBe(3);
    expect(toPrismFoldUniforms({ ...DEFAULT_PRISM_FOLD, folds: 0 }).u_folds).toBe(1);
    expect(toPrismFoldUniforms({ ...DEFAULT_PRISM_FOLD, folds: 40 }).u_folds).toBe(
      PRISM_FOLD_MAX_FOLDS,
    );
  });

  it("never sends a zero width the shader divides by", () => {
    const uniforms = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      softness: 0,
      sheenWidth: 0,
      seamWidth: 0,
    });

    expect(uniforms.u_softness).toBeGreaterThan(0);
    expect(uniforms.u_sheenWidth).toBeGreaterThan(0);
    expect(uniforms.u_seamWidth).toBeGreaterThan(0);
  });

  it("clamps the seam falloff to 0..1, so later folds never outshine the first", () => {
    expect(toPrismFoldUniforms({ ...DEFAULT_PRISM_FOLD, seamFalloff: 2 }).u_seamFalloff).toBe(1);
    expect(toPrismFoldUniforms({ ...DEFAULT_PRISM_FOLD, seamFalloff: -1 }).u_seamFalloff).toBe(0);
  });

  it("clamps the strengths to 0..1", () => {
    const over = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      sheen: 3,
      seam: 2,
      grain: 5,
      warp: 4,
    });
    const under = toPrismFoldUniforms({
      ...DEFAULT_PRISM_FOLD,
      sheen: -1,
      seam: -1,
      grain: -1,
      warp: -1,
    });

    expect([over.u_sheen, over.u_seam, over.u_grain, over.u_warp]).toEqual([1, 1, 1, 1]);
    expect([under.u_sheen, under.u_seam, under.u_grain, under.u_warp]).toEqual([0, 0, 0, 0]);
  });
});
