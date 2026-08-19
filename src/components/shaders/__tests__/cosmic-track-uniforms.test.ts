import { describe, expect, it } from "vitest";
import {
  COSMIC_TRACK_MAX_COLORS,
  DEFAULT_COSMIC_TRACK,
  toCosmicTrackUniforms,
} from "../cosmic-track-uniforms";

// The uniform conversion is the ONLY part of a shader this repo can test: jsdom
// has no WebGL, and every suite that renders a shader mocks the library
// wholesale. So the mapping lives in a pure function rather than the component
// body — the same split Paper makes with `toProcessedGemSmoke` and friends.

describe("toCosmicTrackUniforms", () => {
  it("converts each colour to a straight RGBA vec4 in 0..1", () => {
    const { u_colors } = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colors: ["#FF0000FF", "#0000FF80"],
    });

    expect(u_colors[0]).toEqual([1, 0, 0, 1]);
    const [r, g, b, a] = u_colors[1];
    expect([r, g, b]).toEqual([0, 0, 1]);
    expect(a).toBeCloseTo(0.5, 2);
  });

  it("reports the REAL colour count, not the padded array length", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colors: ["#FF0000FF", "#00FF00FF", "#0000FFFF"],
    });

    // The array is padded to the shader's fixed-size uniform slot...
    expect(uniforms.u_colors).toHaveLength(COSMIC_TRACK_MAX_COLORS);
    // ...but the ramp must only walk the colours actually given, or it fades
    // every gradient out into the unset tail.
    expect(uniforms.u_colorsCount).toBe(3);
  });

  it("clamps a colour list longer than the shader's slot", () => {
    const tooMany = Array.from(
      { length: COSMIC_TRACK_MAX_COLORS + 4 },
      () => "#FFFFFFFF",
    );
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colors: tooMany,
    });

    expect(uniforms.u_colors).toHaveLength(COSMIC_TRACK_MAX_COLORS);
    expect(uniforms.u_colorsCount).toBe(COSMIC_TRACK_MAX_COLORS);
  });

  it("never emits a zero colour count", () => {
    // A count of 0 divides by zero in the ramp and renders black. An empty list
    // is a caller mistake, but it should degrade to a flat colour, not a void.
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colors: [],
    });

    expect(uniforms.u_colorsCount).toBeGreaterThanOrEqual(1);
    expect(uniforms.u_colors).toHaveLength(COSMIC_TRACK_MAX_COLORS);
  });

  it("keeps a transparent background transparent", () => {
    // What makes the shader stackable over another layer: the output is
    // premultiplied, so an alpha-zero ground has to survive the conversion.
    const { u_colorBack } = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colorBack: "#00000000",
    });

    expect(u_colorBack[3]).toBe(0);
  });

  it("keeps the ramp phase and the fan geometry on separate uniforms", () => {
    // The correction that matters: `angle` slides the gradient ALONG the
    // ribbons and must not touch their shape — the reference's streamlines sit
    // in identical positions at both ends of its ANGLE slider. `spread` is the
    // geometry control `angle` was wrongly doubling as.
    const base = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);
    const turned = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      angle: DEFAULT_COSMIC_TRACK.angle + 0.6,
    });

    expect(turned.u_angle).not.toBe(base.u_angle);
    expect(turned.u_spread).toBe(base.u_spread);
    expect(turned.u_curve).toBe(base.u_curve);
  });

  it("carries a per-band stagger independent of the common offset", () => {
    // What makes the leading edges form a staircase instead of arriving
    // together: every band sits at its own offset along the track. `angle`
    // moves the whole set; `stagger` is the gap between neighbours.
    const base = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);
    const staggered = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      stagger: DEFAULT_COSMIC_TRACK.stagger + 0.5,
    });

    expect(staggered.u_stagger).not.toBe(base.u_stagger);
    expect(staggered.u_angle).toBe(base.u_angle);
    expect(staggered.u_spread).toBe(base.u_spread);
  });

  it("passes the shape parameters through untouched", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      angle: 0.42,
      travel: 2.1,
      stagger: 0.31,
      spread: 0.66,
      bandwidth: 0.44,
      roundness: 0.22,
      apex: 1.9,
      rampLength: 1.4,
      bandCount: 7,
      curve: -0.3,
      tilt: 0.9,
      fold: 0.25,
      softness: 0.8,
      tail: 0.05,
      dither: 0.65,
      ditherSize: 4,
    });

    expect(uniforms.u_angle).toBe(0.42);
    expect(uniforms.u_travel).toBe(2.1);
    expect(uniforms.u_stagger).toBe(0.31);
    expect(uniforms.u_spread).toBe(0.66);
    expect(uniforms.u_bandwidth).toBe(0.44);
    expect(uniforms.u_roundness).toBe(0.22);
    expect(uniforms.u_apex).toBe(1.9);
    expect(uniforms.u_rampLength).toBe(1.4);
    expect(uniforms.u_bandCount).toBe(7);
    expect(uniforms.u_curve).toBe(-0.3);
    expect(uniforms.u_tilt).toBe(0.9);
    expect(uniforms.u_fold).toBe(0.25);
    expect(uniforms.u_softness).toBe(0.8);
    expect(uniforms.u_tail).toBe(0.05);
    expect(uniforms.u_dither).toBe(0.65);
    expect(uniforms.u_ditherSize).toBe(4);
  });

  it("guards the divisors the shader cannot take at zero", () => {
    // `rampLength` divides the along-track coordinate. At zero it produces
    // inf/NaN across the whole frame, which reads as a dead canvas rather than
    // as a bad parameter — so the floor lives here, not in the UI.
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      rampLength: 0,
      bandCount: 0,
    });

    expect(uniforms.u_rampLength).toBeGreaterThan(0);
    expect(uniforms.u_bandCount).toBeGreaterThanOrEqual(1);
  });
});
