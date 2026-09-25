import { describe, expect, it } from "vitest";
import {
  DEFAULT_PIXEL_COMETS,
  PIXEL_COMETS_MAX_COLORS,
  PIXEL_COMETS_MAX_GLOW_REACH,
  toPixelCometsUniforms,
  type PixelCometsParams,
} from "../pixel-comets-uniforms";

const params = (overrides: Partial<PixelCometsParams> = {}): PixelCometsParams => ({
  ...DEFAULT_PIXEL_COMETS,
  ...overrides,
});

describe("toPixelCometsUniforms colours", () => {
  it("reports the real count and pads the rest of the slot", () => {
    const uniforms = toPixelCometsUniforms(params({ colors: ["#FF0000", "#00FF00"] }));

    expect(uniforms.u_colorsCount).toBe(2);
    expect(uniforms.u_colors).toHaveLength(PIXEL_COMETS_MAX_COLORS);
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
    expect(a).toBeGreaterThan(0.4);
    expect(a).toBeLessThan(0.6);
  });
});

describe("toPixelCometsUniforms direction", () => {
  it("runs every direction unless asked otherwise", () => {
    const uniforms = toPixelCometsUniforms(params());

    expect(uniforms.u_axes).toEqual([1, 1]);
    expect(uniforms.u_axisHeading).toEqual([0, 0]);
  });

  it("keeps only the axis the chosen directions use", () => {
    expect(toPixelCometsUniforms(params({ direction: ["left", "right"] })).u_axes).toEqual([0, 1]);
    expect(toPixelCometsUniforms(params({ direction: ["up", "down"] })).u_axes).toEqual([1, 0]);
  });

  it("forces the heading when an axis is given only one of its two ways", () => {
    expect(toPixelCometsUniforms(params({ direction: ["up"] })).u_axisHeading).toEqual([1, 0]);
    expect(toPixelCometsUniforms(params({ direction: ["down"] })).u_axisHeading).toEqual([-1, 0]);
    expect(toPixelCometsUniforms(params({ direction: ["right"] })).u_axisHeading).toEqual([0, 1]);
    expect(toPixelCometsUniforms(params({ direction: ["left"] })).u_axisHeading).toEqual([0, -1]);
  });

  it("leaves the toss alone on an axis given both of its ways", () => {
    const uniforms = toPixelCometsUniforms(params({ direction: ["up", "down", "left"] }));

    expect(uniforms.u_axes).toEqual([1, 1]);
    expect(uniforms.u_axisHeading).toEqual([0, -1]);
  });

  it("reads one direction named twice as naming it once", () => {
    const uniforms = toPixelCometsUniforms(params({ direction: ["down", "down"] }));

    expect(uniforms.u_axes).toEqual([1, 0]);
    expect(uniforms.u_axisHeading).toEqual([-1, 0]);
  });
});

describe("toPixelCometsUniforms guards", () => {
  it("keeps a cell at a device pixel or larger", () => {
    expect(toPixelCometsUniforms(params({ pixelSize: 0 })).u_pixelSize).toBe(1);
    expect(toPixelCometsUniforms(params({ pixelSize: -4 })).u_pixelSize).toBe(1);
    expect(toPixelCometsUniforms(params({ pixelSize: 40 })).u_pixelSize).toBe(40);
  });

  it("floors the count at an empty field rather than at negative odds", () => {
    expect(toPixelCometsUniforms(params({ count: -5 })).u_count).toBe(0);
  });

  it("falls back to every direction rather than to an empty card", () => {
    const unknown = ["diagonal"] as unknown as PixelCometsParams["direction"];

    expect(toPixelCometsUniforms(params({ direction: [] })).u_axes).toEqual([1, 1]);
    expect(toPixelCometsUniforms(params({ direction: unknown })).u_axes).toEqual([1, 1]);
    expect(toPixelCometsUniforms(params({ direction: unknown })).u_axisHeading).toEqual([0, 0]);
  });

  it("survives a direction that is not a list at all", () => {
    const single = "down" as unknown as PixelCometsParams["direction"];

    expect(toPixelCometsUniforms(params({ direction: single })).u_axes).toEqual([1, 1]);
    expect(
      toPixelCometsUniforms(params({ direction: undefined as unknown as PixelCometsParams["direction"] }))
        .u_axes,
    ).toEqual([1, 1]);
  });

  it("floors the run at nothing, leaving the cell floor to the shader", () => {
    expect(toPixelCometsUniforms(params({ travelSpans: -2 })).u_travelSpans).toBe(0);
    expect(toPixelCometsUniforms(params({ travelSpans: 40 })).u_travelSpans).toBe(40);
  });

  it("floors both ends of the spawn band at the centre", () => {
    expect(toPixelCometsUniforms(params({ originMin: -1 })).u_originMin).toBe(0);
    expect(toPixelCometsUniforms(params({ originMax: -1 })).u_originMax).toBe(0);
  });

  it("allows a bare head but not a negative tail", () => {
    expect(toPixelCometsUniforms(params({ tail: 0 })).u_tail).toBe(0);
    expect(toPixelCometsUniforms(params({ tail: -3 })).u_tail).toBe(0);
  });

  it("clamps the tail's blend to the two fades it mixes between", () => {
    expect(toPixelCometsUniforms(params({ tailBlend: 1.8 })).u_tailBlend).toBe(1);
    expect(toPixelCometsUniforms(params({ tailBlend: -0.5 })).u_tailBlend).toBe(0);
  });

  it("clamps the falloff to the two decays it blends between", () => {
    expect(toPixelCometsUniforms(params({ falloff: 2.5 })).u_falloff).toBe(1);
    expect(toPixelCometsUniforms(params({ falloff: -0.4 })).u_falloff).toBe(0);
  });

  it("stops both glow radii at the shader's lane reach", () => {
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
    expect(off.u_gridWidth).toBe(0);
  });

  it("leaves the pixel alone as the grid line widens", () => {
    const tight = toPixelCometsUniforms(params({ pixelSize: 8, gridWidth: 0 }));
    const wide = toPixelCometsUniforms(params({ pixelSize: 8, gridWidth: 6 }));

    expect(tight.u_pixelSize).toBe(8);
    expect(wide.u_pixelSize).toBe(8);
    expect(wide.u_gridWidth).toBe(6);
  });

  it("counts the major grid in whole lines, and floors it at off", () => {
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
    expect(uniforms.u_colorGrid).not.toEqual(uniforms.u_colorGridMajor);
  });

  it("clamps both easing controls to the curves they blend between", () => {
    expect(toPixelCometsUniforms(params({ easing: 3 })).u_easing).toBe(1);
    expect(toPixelCometsUniforms(params({ easing: -3 })).u_easing).toBe(-1);
    expect(toPixelCometsUniforms(params({ easingBias: 3 })).u_easingBias).toBe(1);
    expect(toPixelCometsUniforms(params({ easingBias: -3 })).u_easingBias).toBe(-1);
  });

  it("floors the head's smear at none, which is the bare radial glow", () => {
    expect(toPixelCometsUniforms(params({ headStretch: 0 })).u_headStretch).toBe(0);
    expect(toPixelCometsUniforms(params({ headStretch: -3 })).u_headStretch).toBe(0);
    expect(toPixelCometsUniforms(params({ headStretch: 20 })).u_headStretch).toBe(20);
  });

  it("floors the depth spread at a flat field", () => {
    expect(toPixelCometsUniforms(params({ parallax: -0.5 })).u_parallax).toBe(0);
    expect(toPixelCometsUniforms(params({ parallax: 3 })).u_parallax).toBe(3);
  });

  it("takes the band's two ends in either order", () => {
    const swapped = toPixelCometsUniforms(params({ originMin: 2, originMax: 0.5 }));
    expect([swapped.u_originMin, swapped.u_originMax]).toEqual([2, 0.5]);
  });
});
