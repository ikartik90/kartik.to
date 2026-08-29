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

describe("toPixelCometsUniforms direction", () => {
  // The four directions reach the shader as TWO readings, because it asks two
  // separate questions of them:
  //
  //   u_axes         which axes carry comets at all, and so how many lanes the
  //                  frame holds to share Count over.
  //   u_axisHeading  which WAY they run on each axis: +1, -1, or 0 for "both,
  //                  toss for it" — the shader's own coin toss, kept.
  //
  // Derived here rather than in GLSL because it is a fold over a list, which
  // is a sentence of TypeScript and a mess of masks in a fragment shader.

  it("runs every direction unless asked otherwise", () => {
    const uniforms = toPixelCometsUniforms(params());

    expect(uniforms.u_axes).toEqual([1, 1]);
    // Neither axis has a heading forced on it, so both keep the coin toss.
    expect(uniforms.u_axisHeading).toEqual([0, 0]);
  });

  it("keeps only the axis the chosen directions use", () => {
    // Comets going left or right travel along X, which is a ROW, so the rows
    // are the lanes left running — and vice versa. Getting this pair the wrong
    // way round is silent: the field still fills, at right angles to the label.
    expect(toPixelCometsUniforms(params({ direction: ["left", "right"] })).u_axes).toEqual([0, 1]);
    expect(toPixelCometsUniforms(params({ direction: ["up", "down"] })).u_axes).toEqual([1, 0]);
  });

  it("forces the heading when an axis is given only one of its two ways", () => {
    // +Y is UP and +X is RIGHT — `v_objectUV` keeps clip space's orientation,
    // where the library flips only its image UV. A sign wrong here is a field
    // running backwards, which no test that only counts comets would catch.
    expect(toPixelCometsUniforms(params({ direction: ["up"] })).u_axisHeading).toEqual([1, 0]);
    expect(toPixelCometsUniforms(params({ direction: ["down"] })).u_axisHeading).toEqual([-1, 0]);
    expect(toPixelCometsUniforms(params({ direction: ["right"] })).u_axisHeading).toEqual([0, 1]);
    expect(toPixelCometsUniforms(params({ direction: ["left"] })).u_axisHeading).toEqual([0, -1]);
  });

  it("leaves the toss alone on an axis given both of its ways", () => {
    const uniforms = toPixelCometsUniforms(params({ direction: ["up", "down", "left"] }));

    expect(uniforms.u_axes).toEqual([1, 1]);
    // Up and down between them are the whole axis, so it tosses as it always
    // has; the rows carry only leftward comets.
    expect(uniforms.u_axisHeading).toEqual([0, -1]);
  });

  it("reads one direction named twice as naming it once", () => {
    const uniforms = toPixelCometsUniforms(params({ direction: ["down", "down"] }));

    expect(uniforms.u_axes).toEqual([1, 0]);
    // Not a toss: a repeat is one direction, not the axis's two.
    expect(uniforms.u_axisHeading).toEqual([-1, 0]);
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

  it("falls back to every direction rather than to an empty card", () => {
    // The one guard here whose wrong answer is a BLANK canvas: no directions is
    // a mask of zeroes, every lane switched off, and a caller passing an empty
    // list or a typo would read it as a shader that failed to compile.
    //
    // The panel cannot reach either state — its last pressed direction does not
    // release — but a direct consumer of the component can.
    const unknown = ["diagonal"] as unknown as PixelCometsParams["direction"];

    expect(toPixelCometsUniforms(params({ direction: [] })).u_axes).toEqual([1, 1]);
    expect(toPixelCometsUniforms(params({ direction: unknown })).u_axes).toEqual([1, 1]);
    expect(toPixelCometsUniforms(params({ direction: unknown })).u_axisHeading).toEqual([0, 0]);
  });

  it("survives a direction that is not a list at all", () => {
    // The one input here that could THROW rather than degrade, which every
    // other guard in this module is written not to do. A bare string is what a
    // caller reaches for first — the control was a single-select once, and the
    // component is public — and a TypeError takes the whole page, not just the
    // canvas.
    const single = "down" as unknown as PixelCometsParams["direction"];

    expect(toPixelCometsUniforms(params({ direction: single })).u_axes).toEqual([1, 1]);
    expect(
      toPixelCometsUniforms(params({ direction: undefined as unknown as PixelCometsParams["direction"] }))
        .u_axes,
    ).toEqual([1, 1]);
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
