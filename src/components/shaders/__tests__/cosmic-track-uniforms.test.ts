import { describe, expect, it } from "vitest";
import {
  COSMIC_TRACK_MAX_COLORS,
  DEFAULT_COSMIC_TRACK,
  toCosmicTrackUniforms,
} from "../cosmic-track-uniforms";

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

    expect(uniforms.u_colors).toHaveLength(COSMIC_TRACK_MAX_COLORS);
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
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colors: [],
    });

    expect(uniforms.u_colorsCount).toBeGreaterThanOrEqual(1);
    expect(uniforms.u_colors).toHaveLength(COSMIC_TRACK_MAX_COLORS);
  });

  it("keeps a transparent background transparent", () => {
    const { u_colorBack } = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colorBack: "#00000000",
    });

    expect(u_colorBack[3]).toBe(0);
  });

  it("keeps the ramp phase and the fan geometry on separate uniforms", () => {
    const base = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);
    const turned = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      phaseDegrees: DEFAULT_COSMIC_TRACK.phaseDegrees + 15,
    });

    expect(turned.u_phase).not.toBe(base.u_phase);
    expect(turned.u_spread).toBe(base.u_spread);
    expect(turned.u_curve).toBe(base.u_curve);
  });

  it("carries a per-band stagger independent of the common offset", () => {
    const base = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);
    const staggered = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      stagger: DEFAULT_COSMIC_TRACK.stagger + 0.5,
    });

    expect(staggered.u_stagger).not.toBe(base.u_stagger);
    expect(staggered.u_phase).toBe(base.u_phase);
    expect(staggered.u_spread).toBe(base.u_spread);
  });

  it("blends the stagger arrangements with a symmetry in -1..1", () => {
    const linear = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      symmetry: 1,
    });
    const mirrored = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      symmetry: 0,
    });

    const reversed = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      symmetry: -1,
    });

    expect(linear.u_symmetry).toBe(1);
    expect(mirrored.u_symmetry).toBe(0);
    expect(reversed.u_symmetry).toBe(-1);
    expect(mirrored.u_stagger).toBe(linear.u_stagger);
  });

  it("clamps symmetry to the two arrangements it names", () => {
    const over = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, symmetry: 2.5 });
    const under = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, symmetry: -3 });

    expect(over.u_symmetry).toBe(1);
    expect(under.u_symmetry).toBe(-1);
  });

  it("keeps depth in the range where the surface stays in front of the eye", () => {
    const under = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, depth: -0.8 });
    const over = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, depth: 4 });

    expect(under.u_depth).toBe(0);
    expect(over.u_depth).toBe(1);
  });

  it("leaves the flat sheet alone by default", () => {
    expect(DEFAULT_COSMIC_TRACK.depth).toBe(0);
    expect(toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK).u_depth).toBe(0);
  });

  it("treats an edge thickness of 0 as no edge at all, and rests there", () => {
    expect(DEFAULT_COSMIC_TRACK.edgeWidth).toBe(0);
    expect(toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK).u_edgeWidth).toBe(0);

    const drawn = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      edgeWidth: 2.5,
    });
    expect(drawn.u_edgeWidth).toBe(2.5);
  });

  it("never sends a negative thickness", () => {
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeWidth: -3 })
        .u_edgeWidth,
    ).toBe(0);
  });

  it("converts the edge colour, alpha and all", () => {
    const { u_colorEdge } = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colorEdge: "#FF000080",
    });

    expect([u_colorEdge[0], u_colorEdge[1], u_colorEdge[2]]).toEqual([1, 0, 0]);
    expect(u_colorEdge[3]).toBeCloseTo(0.5, 2);
  });

  it("keeps the rails' reach off the ends of the track", () => {
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeTail: -2 }).u_edgeTail,
    ).toBe(0);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeTail: 1.25 }).u_edgeTail,
    ).toBe(1.25);
  });

  it("clamps the edge's dither to the two stages it names", () => {
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeDither: 4 })
        .u_edgeDither,
    ).toBe(2);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeDither: -2 })
        .u_edgeDither,
    ).toBe(0);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeDither: 1.6 })
        .u_edgeDither,
    ).toBe(1.6);
  });

  it("leaves the rails off the dither at rest", () => {
    expect(DEFAULT_COSMIC_TRACK.edgeDither).toBe(0);
    expect(
      toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK).u_edgeDither,
    ).toBe(0);
  });

  it("passes the shape parameters through untouched", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      phaseDegrees: 45,
      travel: 2.1,
      stagger: 0.31,
      symmetry: 0.4,
      spread: 0.66,
      bandwidth: 0.44,
      roundness: 0.22,
      apex: 1.9,
      rampLength: 1.4,
      bandCount: 7,
      curve: -0.3,
      tilt: 0.9,
      depth: 0.5,
      softness: 0.8,
      tail: 0.05,
      rampDither: 0.65,
      ditherSize: 4,
    });

    expect(uniforms.u_travel).toBe(2.1);
    expect(uniforms.u_stagger).toBe(0.31);
    expect(uniforms.u_symmetry).toBe(0.4);
    expect(uniforms.u_spread).toBe(0.66);
    expect(uniforms.u_bandwidth).toBe(0.44);
    expect(uniforms.u_roundness).toBe(0.22);
    expect(uniforms.u_apex).toBe(1.9);
    expect(uniforms.u_rampLength).toBe(1.4);
    expect(uniforms.u_bandCount).toBe(7);
    expect(uniforms.u_curve).toBe(-0.3);
    expect(uniforms.u_tilt).toBe(0.9);
    expect(uniforms.u_depth).toBe(0.5);
    expect(uniforms.u_softness).toBe(0.8);
    expect(uniforms.u_tail).toBe(0.05);
    expect(uniforms.u_rampDither).toBe(0.65);
    expect(uniforms.u_ditherSize).toBe(4);
  });

  it("converts the phase dial's degrees into track units", () => {
    const at = (phaseDegrees: number) =>
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, phaseDegrees }).u_phase;

    expect(at(90)).toBeCloseTo(7, 10);
    expect(at(-90)).toBeCloseTo(-7, 10);
    expect(at(0)).toBe(0);
    expect(at(45)).toBeCloseTo(3.5, 10);
    expect(at(-45)).toBeCloseTo(-3.5, 10);
  });

  it("guards the divisors the shader cannot take at zero", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      rampLength: 0,
      bandCount: 0,
    });

    expect(uniforms.u_rampLength).toBeGreaterThan(0);
    expect(uniforms.u_bandCount).toBeGreaterThanOrEqual(1);
  });

  it("defaults to the fully eased swing the shader has always had", () => {
    const uniforms = toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK);

    expect(uniforms.u_easing).toBe(1);
    expect(uniforms.u_easingBias).toBe(0);
  });

  it("passes the easing through untouched", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      easing: -0.4,
      easingBias: -0.6,
    });

    expect(uniforms.u_easing).toBe(-0.4);
    expect(uniforms.u_easingBias).toBe(-0.6);
  });

  it("clamps the easing to the curves it blends between", () => {
    const over = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      easing: 9,
      easingBias: 4,
    });
    const under = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      easing: -3,
      easingBias: -4,
    });

    expect(over.u_easing).toBe(1);
    expect(over.u_easingBias).toBe(1);
    expect(under.u_easing).toBe(-1);
    expect(under.u_easingBias).toBe(-1);
  });

  it("defaults to no rest at the ends", () => {
    expect(toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK).u_interval).toBe(0);
  });

  it("passes the rest through untouched", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      interval: 0.75,
    });

    expect(uniforms.u_interval).toBe(0.75);
  });

  it("clamps the rest to the range the shader can divide by", () => {
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, interval: -4 }).u_interval,
    ).toBe(0);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, interval: 9 }).u_interval,
    ).toBe(2);
  });

  it("keeps a linear swing at zero", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      easing: 0,
    });

    expect(uniforms.u_easing).toBe(0);
  });
});
