import { describe, expect, it } from "vitest";
import { STEPS, channelsOf, hexOf, oklchFrom, oklchOf, rampOf, scaleOf } from "../oklch";

const SCALE = { 50: 97, 100: 93, 200: 89, 300: 82, 400: 73, 500: 64, 600: 55, 700: 50, 800: 44, 900: 39, 950: 29 };

describe("oklchOf", () => {
  it("writes a hex colour as SW Curie does", () => {
    expect(oklchOf("#1763ee")).toBe("oklch(54.57% 0.2213 261.51)");
    expect(oklchOf("#ffad02")).toBe("oklch(80.7% 0.1701 74.77)");
  });

  it("writes a grey with no chroma or hue", () => {
    expect(oklchOf("#6d6d6d")).toBe("oklch(53.48% 0 0)");
    expect(oklchOf("#ffffff")).toBe("oklch(100% 0 0)");
  });

  it("takes a colour input's uppercase #RRGGBBAA", () => {
    expect(oklchOf("#1763EEFF")).toBe("oklch(54.57% 0.2213 261.51)");
  });
});

// Every colour of Figma's palette, before the palette generator remade its ramps.
const FIGMA = `
  eff7ff daebff bedeff 91c9ff 5dabfd 3789fa 1763ee 1954dc 1b45b2 1c3e8c 162755
  ffffff f6f6f6 e7e7e7 d1d1d1 b0b0b0 888888 6d6d6d 5d5d5d 4f4f4f 454545 3d3d3d 171717
  fef3f2 fee4e2 fecdca fcaba5 f77b72 ed4337 db3327 b8271d 98241c 7f231d 450e0a
  fffdea fff7c5 ffef85 ffe046 ffce1b ffad02 e28300 bb5b02 984608 7c390b 481c00
  fff6ed ffe9d4 ffd0a8 ffae71 ff7e33 fe5e11 ef4407 c62f08 9d270f 7e2310 440e06
  eefff3 d6ffe4 b0ffcb 72ffa4 2efa74 03e451 00bd3f 01a33a 07742e 085f29 003614
`.trim().split(/\s+/);

describe("hexOf", () => {
  it("turns every colour from Figma, written in OKLCH, back into its hex", () => {
    expect(FIGMA).toHaveLength(67);
    for (const hex of FIGMA) expect(hexOf(oklchOf(`#${hex}`))).toBe(`#${hex}`);
  });
});

describe("oklchFrom", () => {
  it("writes lightness, chroma and hue as SW Curie does", () => {
    expect(oklchFrom([54.5678, 0.22134, 261.514])).toBe("oklch(54.57% 0.2213 261.51)");
    expect(oklchFrom([53.48, 0, 120])).toBe("oklch(53.48% 0 0)");
  });

  it("is undone by channelsOf", () => {
    expect(channelsOf("oklch(54.57% 0.2213 261.51)")).toEqual([54.57, 0.2213, 261.51]);
  });
});

describe("scaleOf", () => {
  const scale = scaleOf(29, 97);

  it("runs from the max lightness at 50 to the min at 950", () => {
    expect(scale[50]).toBe(97);
    expect(scale[950]).toBe(29);
  });

  it("fills the steps between in proportion to their number, 500 halfway", () => {
    expect(scale[500]).toBe(63);
    expect(scale[100]).toBe(93.22);
    expect(scale[900]).toBe(32.78);
    expect(Object.keys(scale)).toEqual([...STEPS]);
  });
});

describe("rampOf", () => {
  const ramp = rampOf("oklch(54.57% 0.2213 261.51)", "600", SCALE, 0.2213);
  const at = Object.fromEntries(ramp);

  it("holds every step from 50 to 950, in order", () => {
    expect(ramp.map(([step]) => step)).toEqual([...STEPS]);
  });

  it("gives the base's step its own lightness, not the base's, at the base's chroma and hue", () => {
    expect(at[600]).toBe("oklch(55% 0.2213 261.51)");
  });

  it("gives every other step its own lightness and the base's hue, and with no lower chroma, the base's chroma", () => {
    expect(at[50]).toBe("oklch(97% 0.2213 261.51)");
    expect(at[700]).toBe("oklch(50% 0.2213 261.51)");
    expect(at[950]).toBe("oklch(29% 0.2213 261.51)");
  });

  describe("with a lower chroma", () => {
    const even = { 50: 90, 100: 85, 200: 80, 300: 75, 400: 70, 500: 60, 600: 50, 700: 40, 800: 30, 900: 25, 950: 20 };
    const tapered = Object.fromEntries(rampOf("oklch(66% 0.2 250)", "500", even, 0.04));

    it("falls to it at 50 and 950", () => {
      expect(tapered[50]).toBe("oklch(90% 0.04 250)");
      expect(tapered[950]).toBe("oklch(20% 0.04 250)");
    });

    it("falls from the base's chroma in step with lightness, either way", () => {
      expect(tapered[500]).toBe("oklch(60% 0.2 250)");
      expect(tapered[300]).toBe("oklch(75% 0.12 250)");
      expect(tapered[700]).toBe("oklch(40% 0.12 250)");
    });

    it("never rises above the base's chroma", () => {
      expect(rampOf("oklch(60% 0.2 250)", "500", even, 0.3)).toEqual(rampOf("oklch(60% 0.2 250)", "500", even, 0.2));
    });
  });

  it("keeps a grey grey", () => {
    for (const [, color] of rampOf("oklch(53.48% 0 0)", "500", SCALE, 0)) expect(color).toMatch(/ 0 0\)$/);
  });
});
