import { describe, expect, it } from "vitest";
import {
  clampOpacity,
  formatColor,
  hexToRgb,
  hsbToRgb,
  parseColor,
  rgbToHex,
  rgbToHsb,
  sanitizeHex,
} from "../color-value";

describe("sanitizeHex", () => {
  it("drops a leading # so the field never has to be typed with one", () => {
    expect(sanitizeHex("#FFAB6F")).toBe("FFAB6F");
  });

  it("drops a # typed anywhere, not just in front", () => {
    expect(sanitizeHex("FF#AB6F")).toBe("FFAB6F");
  });

  it("uppercases, so the stored value and the readout agree", () => {
    expect(sanitizeHex("ffab6f")).toBe("FFAB6F");
  });

  it("discards characters that are not hex digits", () => {
    expect(sanitizeHex("ZZff!!ab6f")).toBe("FFAB6F");
  });

  it("truncates past six digits rather than letting the field grow", () => {
    expect(sanitizeHex("FFAB6F00")).toBe("FFAB6F");
  });

  it("passes a partial value through so the field can be typed into", () => {
    expect(sanitizeHex("FF")).toBe("FF");
    expect(sanitizeHex("")).toBe("");
  });
});

describe("clampOpacity", () => {
  it("holds the value inside 0-100", () => {
    expect(clampOpacity(-20)).toBe(0);
    expect(clampOpacity(140)).toBe(100);
    expect(clampOpacity(55)).toBe(55);
  });

  it("rounds to a whole percent", () => {
    expect(clampOpacity(55.6)).toBe(56);
  });

  it("falls back to fully opaque for a value that is not a number", () => {
    expect(clampOpacity(Number.NaN)).toBe(100);
  });
});

describe("formatColor", () => {
  it("combines the hex and the opacity into one 8-digit value", () => {
    expect(formatColor("FFAB6F", 100)).toBe("#FFAB6FFF");
    expect(formatColor("FFAB6F", 0)).toBe("#FFAB6F00");
  });

  it("scales the percentage across the full alpha byte", () => {
    expect(formatColor("FF4D97", 50)).toBe("#FF4D9780");
  });

  it("accepts a hex that still carries its #", () => {
    expect(formatColor("#FF4D97", 100)).toBe("#FF4D97FF");
  });

  it("pads an incomplete hex with zeros so the shader always gets a valid colour", () => {
    expect(formatColor("FFF", 100)).toBe("#FFF000FF");
  });
});

describe("parseColor", () => {
  it("splits an 8-digit value back into hex and percentage", () => {
    expect(parseColor("#FFAB6FFF")).toEqual({ hex: "FFAB6F", opacity: 100 });
    expect(parseColor("#FF4D9780")).toEqual({ hex: "FF4D97", opacity: 50 });
  });

  it("reads a 6-digit value as fully opaque", () => {
    expect(parseColor("#FFAB6F")).toEqual({ hex: "FFAB6F", opacity: 100 });
  });

  it("round-trips every whole percentage", () => {
    for (let opacity = 0; opacity <= 100; opacity++) {
      expect(parseColor(formatColor("FFAB6F", opacity))).toEqual({
        hex: "FFAB6F",
        opacity,
      });
    }
  });

  it("falls back to opaque black for an unparseable value", () => {
    expect(parseColor("nonsense")).toEqual({ hex: "000000", opacity: 100 });
  });
});

// ---------------------------------------------------------------------------
// Colour spaces — the three the picker's format menu offers. Hex and RGB are
// the same numbers written differently; HSB is the one with real geometry
// behind it, and the one the saturation/brightness map and the hue slider are
// coordinates in.
// ---------------------------------------------------------------------------

describe("hexToRgb", () => {
  it("reads each pair of digits as a channel", () => {
    expect(hexToRgb("FFAB6F")).toEqual({ r: 255, g: 171, b: 111 });
  });

  it("accepts a value written with a #, wherever it lands", () => {
    expect(hexToRgb("#00FF80")).toEqual({ r: 0, g: 255, b: 128 });
  });

  it("zero-pads a half-typed value rather than rejecting it, so a colour is readable on every keystroke", () => {
    expect(hexToRgb("FF")).toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("rgbToHex", () => {
  it("writes six uppercase digits with no #", () => {
    expect(rgbToHex({ r: 255, g: 171, b: 111 })).toBe("FFAB6F");
  });

  it("pads a single-digit channel, so 0 is 00 and not 0", () => {
    expect(rgbToHex({ r: 0, g: 8, b: 16 })).toBe("000810");
  });

  it("clamps and rounds, because a channel arrives from arithmetic as often as from a field", () => {
    expect(rgbToHex({ r: -10, g: 300, b: 127.6 })).toBe("00FF80");
  });
});

describe("rgbToHsb", () => {
  it("puts each primary and secondary on its own sixth of the wheel", () => {
    expect(rgbToHsb({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, b: 100 });
    expect(rgbToHsb({ r: 255, g: 255, b: 0 })).toEqual({ h: 60, s: 100, b: 100 });
    expect(rgbToHsb({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, b: 100 });
    expect(rgbToHsb({ r: 0, g: 255, b: 255 })).toEqual({ h: 180, s: 100, b: 100 });
    expect(rgbToHsb({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, b: 100 });
    expect(rgbToHsb({ r: 255, g: 0, b: 255 })).toEqual({ h: 300, s: 100, b: 100 });
  });

  it("reads a grey as no saturation, and its brightness as how light it is", () => {
    expect(rgbToHsb({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, b: 0 });
    expect(rgbToHsb({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, b: 100 });
    expect(rgbToHsb({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, b: 50 });
  });
});

describe("hsbToRgb", () => {
  it("is exactly the inverse of rgbToHsb wherever integer HSB can name the colour", () => {
    for (const rgb of [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 128, b: 128 },
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 },
      { r: 51, g: 51, b: 51 },
    ]) {
      expect(hsbToRgb(rgbToHsb(rgb))).toEqual(rgb);
    }
  });

  it("returns every other colour to within one channel step, which is all integer HSB can promise", () => {
    // 360 x 101 x 101 nameable triples against 256^3 colours: the round trip
    // CANNOT be exact everywhere, and a picker that emitted on open would
    // shift the colour by a digit just for being looked at. Hence the rule
    // this tolerance stands in for — the picker holds its own HSB and emits
    // only on an edit (see `color-picker.tsx`).
    for (const rgb of [
      { r: 255, g: 171, b: 111 },
      { r: 12, g: 200, b: 90 },
      { r: 90, g: 12, b: 200 },
      { r: 200, g: 90, b: 12 },
      { r: 7, g: 7, b: 8 },
    ]) {
      const round = hsbToRgb(rgbToHsb(rgb));
      expect(Math.abs(round.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(round.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(round.b - rgb.b)).toBeLessThanOrEqual(1);
    }
  });

  it("wraps the hue, so a full turn is the same colour as none", () => {
    expect(hsbToRgb({ h: 360, s: 100, b: 100 })).toEqual(
      hsbToRgb({ h: 0, s: 100, b: 100 }),
    );
  });

  it("clamps saturation and brightness rather than producing an out-of-gamut channel", () => {
    expect(hsbToRgb({ h: 0, s: 140, b: -20 })).toEqual({ r: 0, g: 0, b: 0 });
  });
});
