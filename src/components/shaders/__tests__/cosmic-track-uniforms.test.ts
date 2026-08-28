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
    // The correction that matters: `phase` slides the gradient ALONG the
    // ribbons and must not touch their shape — the reference's streamlines sit
    // in identical positions at both ends of its ANGLE slider. `spread` is the
    // geometry control `phase` was wrongly doubling as.
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
    // What makes the leading edges form a staircase instead of arriving
    // together: every band sits at its own offset along the track. `phase`
    // moves the whole set; `stagger` is the gap between neighbours.
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
    // 1 is the staircase the reference shows: each band offset one more step
    // along the track than the one before it, so the first leads and the last
    // trails by the full span. 0 mirrors the set about its middle band — the
    // first and last bands share an offset, the second and second-last share
    // theirs, and the stagger grows from the CENTRE rather than from an edge.
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
    // -1 carries the walk past the middle band to the LAST one, so the stack
    // runs the other way down. Reachable only here: `stagger` can negate every
    // offset at once, but it cannot half-mirror the stack.
    expect(reversed.u_symmetry).toBe(-1);
    // It picks the ARRANGEMENT only. The size of one step is still `stagger`,
    // so mirroring a set must not quietly resize its staircase.
    expect(mirrored.u_stagger).toBe(linear.u_stagger);
  });

  it("clamps symmetry to the two arrangements it names", () => {
    // The shader mixes between them and `mix` EXTRAPOLATES, so a value past
    // either end is not a third arrangement — it drags the bands beyond both.
    const over = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, symmetry: 2.5 });
    const under = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, symmetry: -3 });

    expect(over.u_symmetry).toBe(1);
    expect(under.u_symmetry).toBe(-1);
  });

  it("keeps depth in the range where the surface stays in front of the eye", () => {
    // Depth curls the plane the tracks lie on, and it does that through the
    // same perspective divide as `tilt` — so a NEGATIVE curl drives the divisor
    // toward zero and past it, where the surface has crossed the viewer and the
    // plane folds back on itself. 0 is the flat sheet the shader shipped with.
    const under = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, depth: -0.8 });
    const over = toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, depth: 4 });

    expect(under.u_depth).toBe(0);
    expect(over.u_depth).toBe(1);
  });

  it("leaves the flat sheet alone by default", () => {
    // The curl is an addition to what already shipped, not a replacement for
    // it: at rest the shader must render exactly as it did before depth existed.
    expect(DEFAULT_COSMIC_TRACK.depth).toBe(0);
    expect(toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK).u_depth).toBe(0);
  });

  it("treats an edge thickness of 0 as no edge at all, and rests there", () => {
    // The thickness IS the switch — a separate toggle beside it would be a step
    // this value can take on its own, and the two could disagree. Off at rest,
    // so the shader renders exactly as it did before the highlight existed.
    expect(DEFAULT_COSMIC_TRACK.edgeWidth).toBe(0);
    expect(toCosmicTrackUniforms(DEFAULT_COSMIC_TRACK).u_edgeWidth).toBe(0);

    const drawn = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      edgeWidth: 2.5,
    });
    expect(drawn.u_edgeWidth).toBe(2.5);
  });

  it("never sends a negative thickness", () => {
    // Negative would flip the stroke's smoothstep inside out — not a thinner
    // line but a lit band everywhere the line is not.
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeWidth: -3 })
        .u_edgeWidth,
    ).toBe(0);
  });

  it("converts the edge colour, alpha and all", () => {
    // The alpha is the highlight's STRENGTH, not decoration: the shader
    // crossfades the rail over the fill by it and contributes it as coverage,
    // so a caller reaching for a softer line reaches for this.
    const { u_colorEdge } = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      colorEdge: "#FF000080",
    });

    expect([u_colorEdge[0], u_colorEdge[1], u_colorEdge[2]]).toEqual([1, 0, 0]);
    expect(u_colorEdge[3]).toBeCloseTo(0.5, 2);
  });

  it("keeps the rails' reach off the ends of the track", () => {
    // A negative reach would invert the smoothstep the rails fade over, which
    // is not a shorter tail but a rail that lights up where it should be gone.
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeTail: -2 }).u_edgeTail,
    ).toBe(0);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeTail: 1.25 }).u_edgeTail,
    ).toBe(1.25);
  });

  it("clamps the edge's dither to the two stages it names", () => {
    // The shader splits this: 0..1 is how much of the threshold to take, 1..2
    // is how far the pattern opens into the line's core. Past 2 there is no
    // third stage — only a duty driven negative.
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeDither: 4 })
        .u_edgeDither,
    ).toBe(2);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeDither: -2 })
        .u_edgeDither,
    ).toBe(0);
    // Past the threshold's own ceiling is reachable, which is the point of it.
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, edgeDither: 1.6 })
        .u_edgeDither,
    ).toBe(1.6);
  });

  it("leaves the rails off the dither at rest", () => {
    // A hairline has nowhere to put a stipple: the threshold cuts it into
    // dashes rather than stippling it, so the default is off. The RIBBONS are
    // dithered regardless — that is `dither`'s business, not this one.
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

  // Phase is the one parameter that is NOT passed through: the control is
  // dialled in degrees so it reads like the rotation beside it, and the shader
  // is in track units end to end. This is where the two meet, and it is the
  // only place they do.
  it("converts the phase dial's degrees into track units", () => {
    const at = (phaseDegrees: number) =>
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, phaseDegrees }).u_phase;

    // A QUARTER turn is the full reach in one direction — the seven track units
    // the control ran to before it was dialled in degrees, so every phase saved
    // under the old scale converts to the same picture. The dial stops there
    // rather than at a half turn, because the run does not repeat and a ±180
    // dial would imply that its two ends meet.
    expect(at(90)).toBeCloseTo(7, 10);
    expect(at(-90)).toBeCloseTo(-7, 10);
    // Square-on is the one value that means the same in either scale.
    expect(at(0)).toBe(0);
    // And it is LINEAR, not an angle: half the deflection is half the distance,
    // not the sine of anything.
    expect(at(45)).toBeCloseTo(3.5, 10);
    expect(at(-45)).toBeCloseTo(-3.5, 10);
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

  // ---------------------------------------------------------------------------
  // Easing — the SHAPE of the swing, apart from its size (`travel`) and its rate
  // (the mount's own `speed`).
  // ---------------------------------------------------------------------------

  // The defaults have to reproduce the plain sine the shader animated on before
  // these existed, or every saved preset starts moving differently. That is the
  // TOP of the easing range, and deliberately: a fully eased turnaround was the
  // shader's own choice long before there was a control to undo it.
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

  // Both are MIX FACTORS in the shader, and `mix` extrapolates: past either end
  // the swing is dragged beyond the curves it is blending between, which is not
  // a stronger ease but a broken one. Same reasoning as `symmetry`.
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

  // The rest at each end of the travel. 0 is the unbroken swing this had before
  // the control existed, so it has to be the default.
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

  // Measured in SWEEP LENGTHS, and it divides by (1 + interval) in the shader —
  // so a negative one below -1 flips the sign of the whole half-cycle and the
  // set runs backwards through its own rest.
  it("clamps the rest to the range the shader can divide by", () => {
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, interval: -4 }).u_interval,
    ).toBe(0);
    expect(
      toCosmicTrackUniforms({ ...DEFAULT_COSMIC_TRACK, interval: 9 }).u_interval,
    ).toBe(2);
  });

  // 0 is the middle of the range now, not the bottom of it: no easing at all,
  // which is a linear sweep. It has to survive the clamp rather than being
  // treated as an absent value.
  it("keeps a linear swing at zero", () => {
    const uniforms = toCosmicTrackUniforms({
      ...DEFAULT_COSMIC_TRACK,
      easing: 0,
    });

    expect(uniforms.u_easing).toBe(0);
  });
});
