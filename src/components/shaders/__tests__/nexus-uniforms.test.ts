import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEXUS,
  NEXUS_MAX_COLORS,
  NEXUS_MAX_GLOW_REACH,
  toNexusUniforms,
  type NexusParams,
} from "../nexus-uniforms";

/** The defaults with one thing changed — the shape every case below wants. */
const params = (overrides: Partial<NexusParams> = {}): NexusParams => ({
  ...DEFAULT_NEXUS,
  ...overrides,
});

describe("toNexusUniforms colours", () => {
  it("reports the real count and pads the rest of the slot", () => {
    const uniforms = toNexusUniforms(params({ colors: ["#FF0000", "#00FF00"] }));

    expect(uniforms.u_colorsCount).toBe(2);
    expect(uniforms.u_colors).toHaveLength(NEXUS_MAX_COLORS);
    // The padding is the LAST real colour repeated, so a mover whose hash lands
    // past the count still draws something rather than an unset slot.
    expect(uniforms.u_colors[2]).toEqual(uniforms.u_colors[1]);
    expect(uniforms.u_colors[NEXUS_MAX_COLORS - 1]).toEqual(
      uniforms.u_colors[1],
    );
  });

  it("drops colours past the shader's ceiling rather than overflowing it", () => {
    const tooMany = Array.from(
      { length: NEXUS_MAX_COLORS + 3 },
      () => "#123456",
    );
    const uniforms = toNexusUniforms(params({ colors: tooMany }));

    expect(uniforms.u_colors).toHaveLength(NEXUS_MAX_COLORS);
    expect(uniforms.u_colorsCount).toBe(NEXUS_MAX_COLORS);
  });

  it("degrades an empty palette to one colour rather than to a void", () => {
    const uniforms = toNexusUniforms(params({ colors: [] }));

    expect(uniforms.u_colorsCount).toBe(1);
    expect(uniforms.u_colors).toHaveLength(NEXUS_MAX_COLORS);
    expect(uniforms.u_colors[0]).toEqual(uniforms.u_colorGrid);
  });

  it("converts the ground and the lattice to RGBA the shader can read", () => {
    const uniforms = toNexusUniforms(
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

describe("toNexusUniforms guards", () => {
  // Each of these is a value the panel cannot produce but a direct consumer of
  // the component can. Clamping in the UI would leave the component unsafe for
  // every caller that is not the playground.

  it("keeps a cell at a device pixel or larger", () => {
    expect(toNexusUniforms(params({ pixelSize: 0 })).u_pixelSize).toBe(1);
    expect(toNexusUniforms(params({ pixelSize: -4 })).u_pixelSize).toBe(1);
    // No ceiling here: the panel's 10 is a choice, not a limit of the shader.
    expect(toNexusUniforms(params({ pixelSize: 40 })).u_pixelSize).toBe(40);
  });

  it("floors the count at an empty field rather than at negative odds", () => {
    expect(toNexusUniforms(params({ count: -5 })).u_count).toBe(0);
  });

  it("gives every mover at least one cell to run", () => {
    // The run's length divides the mover's progress, so a zero would take the
    // whole field with it rather than parking one mover.
    expect(toNexusUniforms(params({ travel: 0 })).u_travel).toBe(1);
    expect(toNexusUniforms(params({ travel: -20 })).u_travel).toBe(1);
  });

  it("allows a bare head but not a negative tail", () => {
    expect(toNexusUniforms(params({ tail: 0 })).u_tail).toBe(0);
    expect(toNexusUniforms(params({ tail: -3 })).u_tail).toBe(0);
  });

  it("clamps the tail's blend to the two fades it mixes between", () => {
    // `mix` extrapolates: past either end the fade is dragged beyond both the
    // stepped and the smooth reading rather than reaching a stronger one.
    expect(toNexusUniforms(params({ tailBlend: 1.8 })).u_tailBlend).toBe(1);
    expect(toNexusUniforms(params({ tailBlend: -0.5 })).u_tailBlend).toBe(0);
  });

  it("clamps the falloff to the two decays it blends between", () => {
    // The shader `mix`es the per-cell decay between two constants with it, and
    // `mix` extrapolates: past 1 the decay drops under the hard end and past 0
    // it climbs over 1, where the curve it feeds stops being a fade at all.
    expect(toNexusUniforms(params({ falloff: 2.5 })).u_falloff).toBe(1);
    expect(toNexusUniforms(params({ falloff: -0.4 })).u_falloff).toBe(0);
  });

  it("stops both glow radii at the shader's lane reach", () => {
    // Past it the halo is not wider, only clipped square at the lane boundary.
    const wide = toNexusUniforms(
      params({ headRadius: 99, tailRadius: 99 }),
    );
    expect(wide.u_headRadius).toBe(NEXUS_MAX_GLOW_REACH);
    expect(wide.u_tailRadius).toBe(NEXUS_MAX_GLOW_REACH);

    const negative = toNexusUniforms(
      params({ headRadius: -1, tailRadius: -1 }),
    );
    expect(negative.u_headRadius).toBe(0);
    expect(negative.u_tailRadius).toBe(0);
  });

  it("floors the glows and the grid line at off", () => {
    const off = toNexusUniforms(
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
    const tight = toNexusUniforms(params({ pixelSize: 8, gridWidth: 0 }));
    const wide = toNexusUniforms(params({ pixelSize: 8, gridWidth: 6 }));

    expect(tight.u_pixelSize).toBe(8);
    expect(wide.u_pixelSize).toBe(8);
    expect(wide.u_gridWidth).toBe(6);
  });

  it("counts the major grid in whole lines, and floors it at off", () => {
    // The shader counts boundaries with it, so a fractional "every 3.5th" has
    // nothing to point at — and a negative one would send mod() looking for a
    // remainder in a range that runs backwards.
    expect(toNexusUniforms(params({ majorGrid: 3.4 })).u_majorGrid).toBe(3);
    expect(toNexusUniforms(params({ majorGrid: 3.6 })).u_majorGrid).toBe(4);
    expect(toNexusUniforms(params({ majorGrid: -5 })).u_majorGrid).toBe(0);
    expect(toNexusUniforms(params({ majorGrid: 0 })).u_majorGrid).toBe(0);
  });

  it("converts the major lines' ink to RGBA of its own", () => {
    const uniforms = toNexusUniforms(
      params({ colorGrid: "#FFFFFF20", colorGridMajor: "#FF0000FF" }),
    );
    expect(uniforms.u_colorGridMajor).toEqual([1, 0, 0, 1]);
    // Two inks, not one read twice.
    expect(uniforms.u_colorGrid).not.toEqual(uniforms.u_colorGridMajor);
  });

  it("clamps both easing controls to the curves they blend between", () => {
    expect(toNexusUniforms(params({ easing: 3 })).u_easing).toBe(1);
    expect(toNexusUniforms(params({ easing: -3 })).u_easing).toBe(-1);
    expect(toNexusUniforms(params({ easingBias: 3 })).u_easingBias).toBe(1);
    expect(toNexusUniforms(params({ easingBias: -3 })).u_easingBias).toBe(-1);
  });

  it("passes the seed through untouched, sign included", () => {
    // A hash INPUT, not a measurement — there is no value it can take that
    // means anything but a different field.
    expect(toNexusUniforms(params({ seed: -7.5 })).u_seed).toBe(-7.5);
  });
});
