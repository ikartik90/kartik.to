import { describe, expect, it } from "vitest";
import {
  clampOpacity,
  formatColor,
  parseColor,
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
