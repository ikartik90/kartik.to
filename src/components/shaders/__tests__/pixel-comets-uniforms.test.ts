import { describe, expect, it } from "vitest";
import {
  DEFAULT_PIXEL_COMETS,
  PIXEL_COMETS_MAX_COLORS,
  PIXEL_COMETS_MAX_GLOW_REACH,
  toPixelCometsUniforms,
  type PixelCometsParams,
} from "../pixel-comets-uniforms";

/** The defaults with one thing changed — the shape every case below wants. */
const params = (overrides: Partial<PixelCometsParams> = {}): PixelCometsParams => ({
  ...DEFAULT_PIXEL_COMETS,
  ...overrides,
});

describe("toPixelCometsUniforms colours", () => {
  it("reports the real count and pads the rest of the slot", () => {
    const uniforms = toPixelCometsUniforms(params({ colors: ["#FF0000", "#00FF00"] }));

    expect(uniforms.u_colorsCount).toBe(2);
    expect(uniforms.u_colors).toHaveLength(PIXEL_COMETS_MAX_COLORS);
    // The padding is the LAST real colour repeated, so a mover whose hash lands
    // past the count still draws something rather than an unset slot.
    expect(uniforms.u_colors[2]).toEqual(uniforms.u_colors[1]);
    expect(uniforms.u_colors[PIXEL_COMETS_MAX_COLORS - 1]).toEqual(
      uniforms.u_colors[1],
    );
  });

  it("drops colours past the shader's ceiling rather than overflowing it", () => {
    const tooMany = Array.from(
      { length: PIXEL_COMETS_MAX_COLORS + 3 },
      () => "#123456",
    );
    const uniforms = toPixelCometsUniforms(params({ colors: tooMany }));

    expect(uniforms.u_colors).toHaveLength(PIXEL_COMETS_MAX_COLORS);
    expect(uniforms.u_colorsCount).toBe(PIXEL_COMETS_MAX_COLORS);
  });

  it("degrades an empty palette to one colour rather than to a void", () => {
    const uniforms = toPixelCometsUniforms(params({ colors: [] }));

    expect(uniforms.u_colorsCount).toBe(1);
    expect(uniforms.u_colors).toHaveLength(PIXEL_COMETS_MAX_COLORS);
    expect(uniforms.u_colors[0]).toEqual(uniforms.u_colorGrid);
  });

  it("converts the ground and the lattice to RGBA the shader can read", () => {
    const uniforms = toPixelCometsUniforms(
      params({ colorBack: "#000000FF", colorGrid: "#FFFFFF80" }),
    );

    expect(uniforms.u_colorBack).toEqual([0, 0, 0, 1]);
    const [r, g, b, a] = uniforms.u_colorGrid;
    expect([r, g, b]).toEqual([1, 1, 1]);
    // The lattice's alpha is its STRENGTH, so it has to survive the conversion.
    expect(a).toBeGreaterThan(0.4);
    expect(a).toBeLessThan(0.6);
  });
});

describe("toPixelCometsUniforms guards", () => {
  // Each of these is a value the panel cannot produce but a direct consumer of
  // the component can. Clamping in the UI would leave the component unsafe for
  // every caller that is not the playground.

  it("keeps a cell at a device pixel or larger", () => {
    expect(toPixelCometsUniforms(params({ pixelSize: 0 })).u_pixelSize).toBe(1);
    expect(toPixelCometsUniforms(params({ pixelSize: -4 })).u_pixelSize).toBe(1);
    // No ceiling here: the panel's 10 is a choice, not a limit of the shader.
    expect(toPixelCometsUniforms(params({ pixelSize: 40 })).u_pixelSize).toBe(40);
  });

  it("floors the count at an empty field rather than at negative odds", () => {
    expect(toPixelCometsUniforms(params({ count: -5 })).u_count).toBe(0);
  });

  it("floors the run at nothing, leaving the cell floor to the shader", () => {
    // Travel is measured in HALF-FRAMES now, so how many cells a run is worth
    // is not known until the frame is — which is where the one-cell floor
    // moved to. Here the only wrong value is a negative one: it would send the
    // comet back the way it came, which the direction has already decided.
    expect(toPixelCometsUniforms(params({ travelSpans: -2 })).u_travelSpans).toBe(0);
    // No ceiling. The panel's 4 is the range worth dialling, not a limit of the
    // shader — a comet asked to run further simply leaves sooner.
    expect(toPixelCometsUniforms(params({ travelSpans: 40 })).u_travelSpans).toBe(40);
  });

  it("floors both ends of the spawn band at the centre", () => {
    // A distance FROM the centre, so it has no sign: which side a comet is
    // born on is the shader's own coin toss, and a negative here would be the
    // same band written backwards.
    expect(toPixelCometsUniforms(params({ originMin: -1 })).u_originMin).toBe(0);
    expect(toPixelCometsUniforms(params({ originMax: -1 })).u_originMax).toBe(0);
  });

  it("allows a bare head but not a negative tail", () => {
    expect(toPixelCometsUniforms(params({ tail: 0 })).u_tail).toBe(0);
    expect(toPixelCometsUniforms(params({ tail: -3 })).u_tail).toBe(0);
  });

  it("clamps the tail's blend to the two fades it mixes between", () => {
    // `mix` extrapolates: past either end the fade is dragged beyond both the
    // stepped and the smooth reading rather than reaching a stronger one.
    expect(toPixelCometsUniforms(params({ tailBlend: 1.8 })).u_tailBlend).toBe(1);
    expect(toPixelCometsUniforms(params({ tailBlend: -0.5 })).u_tailBlend).toBe(0);
  });

  it("clamps the falloff to the two decays it blends between", () => {
    // The shader `mix`es the per-cell decay between two constants with it, and
    // `mix` extrapolates: past 1 the decay drops under the hard end and past 0
    // it climbs over 1, where the curve it feeds stops being a fade at all.
    expect(toPixelCometsUniforms(params({ falloff: 2.5 })).u_falloff).toBe(1);
    expect(toPixelCometsUniforms(params({ falloff: -0.4 })).u_falloff).toBe(0);
  });

  it("stops both glow radii at the shader's lane reach", () => {
    // Past it the halo is not wider, only clipped square at the lane boundary.
    const wide = toPixelCometsUniforms(
      params({ headRadius: 99, tailRadius: 99 }),
    );
    expect(wide.u_headRadius).toBe(PIXEL_COMETS_MAX_GLOW_REACH);
    expect(wide.u_tailRadius).toBe(PIXEL_COMETS_MAX_GLOW_REACH);

    const negative = toPixelCometsUniforms(
      params({ headRadius: -1, tailRadius: -1 }),
    );
    expect(negative.u_headRadius).toBe(0);
    expect(negative.u_tailRadius).toBe(0);
  });

  it("floors the glows and the grid line at off", () => {
    const off = toPixelCometsUniforms(
      params({ headGlow: -2, tailGlow: -2, gridWidth: -2 }),
    );
    expect(off.u_headGlow).toBe(0);
    expect(off.u_tailGlow).toBe(0);
    // 0 is a real setting here — pixels touching, no lattice — so the floor is
    // the only guard the width needs.
    expect(off.u_gridWidth).toBe(0);
  });

  it("leaves the pixel alone as the grid line widens", () => {
    // The property the whole geometry turns on: a line laid BETWEEN the pixels
    // adds to the pitch instead of eating them, so Grid Width must not move
    // Pixel Size. The shader forms the pitch from the two, so the conversion's
    // job is to hand both across untouched.
    const tight = toPixelCometsUniforms(params({ pixelSize: 8, gridWidth: 0 }));
    const wide = toPixelCometsUniforms(params({ pixelSize: 8, gridWidth: 6 }));

    expect(tight.u_pixelSize).toBe(8);
    expect(wide.u_pixelSize).toBe(8);
    expect(wide.u_gridWidth).toBe(6);
  });

  it("counts the major grid in whole lines, and floors it at off", () => {
    // The shader counts boundaries with it, so a fractional "every 3.5th" has
    // nothing to point at — and a negative one would send mod() looking for a
    // remainder in a range that runs backwards.
    expect(toPixelCometsUniforms(params({ majorGrid: 3.4 })).u_majorGrid).toBe(3);
    expect(toPixelCometsUniforms(params({ majorGrid: 3.6 })).u_majorGrid).toBe(4);
    expect(toPixelCometsUniforms(params({ majorGrid: -5 })).u_majorGrid).toBe(0);
    expect(toPixelCometsUniforms(params({ majorGrid: 0 })).u_majorGrid).toBe(0);
  });

  it("converts the major lines' ink to RGBA of its own", () => {
    const uniforms = toPixelCometsUniforms(
      params({ colorGrid: "#FFFFFF20", colorGridMajor: "#FF0000FF" }),
    );
    expect(uniforms.u_colorGridMajor).toEqual([1, 0, 0, 1]);
    // Two inks, not one read twice.
    expect(uniforms.u_colorGrid).not.toEqual(uniforms.u_colorGridMajor);
  });

  it("clamps both easing controls to the curves they blend between", () => {
    expect(toPixelCometsUniforms(params({ easing: 3 })).u_easing).toBe(1);
    expect(toPixelCometsUniforms(params({ easing: -3 })).u_easing).toBe(-1);
    expect(toPixelCometsUniforms(params({ easingBias: 3 })).u_easingBias).toBe(1);
    expect(toPixelCometsUniforms(params({ easingBias: -3 })).u_easingBias).toBe(-1);
  });

  it("floors the head's smear at none, which is the bare radial glow", () => {
    // A negative smear clamps against a segment running the wrong way and puts
    // the blur in FRONT of the comet — the one direction inertia cannot throw
    // it. Zero is the circle this started as, and a real setting.
    expect(toPixelCometsUniforms(params({ headStretch: 0 })).u_headStretch).toBe(0);
    expect(toPixelCometsUniforms(params({ headStretch: -3 })).u_headStretch).toBe(0);
    // No ceiling: the panel's 8 is the range worth dialling, and along the lane
    // the reach is free.
    expect(toPixelCometsUniforms(params({ headStretch: 20 })).u_headStretch).toBe(20);
  });

  it("floors the depth spread at a flat field", () => {
    // Below zero the spread runs the wrong way and a comet's depth can reach
    // nought, which is a run of no length at all — the field stops rather than
    // flattening.
    expect(toPixelCometsUniforms(params({ parallax: -0.5 })).u_parallax).toBe(0);
    // No ceiling: the panel's 1 is the range worth dialling, and past it the
    // near plane simply comes nearer.
    expect(toPixelCometsUniforms(params({ parallax: 3 })).u_parallax).toBe(3);
  });

  // The two ends are NOT sorted, and that is deliberate: `mix` covers the same
  // band whichever way round they are, so a min dragged past its max keeps
  // drawing rather than collapsing to nothing while the slider is in motion.
  it("takes the band's two ends in either order", () => {
    const swapped = toPixelCometsUniforms(params({ originMin: 2, originMax: 0.5 }));
    expect([swapped.u_originMin, swapped.u_originMax]).toEqual([2, 0.5]);
  });
});
