import { describe, expect, it } from "vitest";
import { cubicBezier, easedFadeOut } from "../eased-fade";

describe("cubicBezier", () => {
  const linear = cubicBezier(0, 0, 1, 1);
  const ease = cubicBezier(0.63, 0, 0.48, 1);

  it("holds both ends", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-0.5)).toBe(0);
    expect(ease(1.5)).toBe(1);
  });

  it("follows a straight line for the linear curve", () => {
    expect(linear(0.25)).toBeCloseTo(0.25, 3);
    expect(linear(0.5)).toBeCloseTo(0.5, 3);
  });

  it("starts slow on an ease-in-out curve and passes the middle at the middle", () => {
    expect(ease(0.1)).toBeLessThan(0.05);
    expect(ease(0.5)).toBeGreaterThan(0.4);
    expect(ease(0.5)).toBeLessThan(0.6);
  });
});

describe("easedFadeOut", () => {
  const fade = easedFadeOut(30);
  const stops = [...fade.matchAll(/rgb\(0 0 0 \/ ([\d.]+)\) ([\d.]+)%/g)].map(([, alpha, at]) => ({
    alpha: Number(alpha),
    at: Number(at),
  }));

  it("is a top-to-bottom mask", () => {
    expect(fade.startsWith("linear-gradient(to bottom, ")).toBe(true);
  });

  it("stays whole from the top down to where it starts fading", () => {
    expect(stops[0]).toEqual({ alpha: 1, at: 30 });
  });

  it("fades on enough stops that no step shows, ending clear at the foot", () => {
    expect(stops).toHaveLength(26);
    expect(stops[stops.length - 1]).toEqual({ alpha: 0, at: 100 });
  });

  it("only ever thins", () => {
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].alpha).toBeLessThanOrEqual(stops[i - 1].alpha);
      expect(stops[i].at).toBeGreaterThan(stops[i - 1].at);
    }
  });
});
