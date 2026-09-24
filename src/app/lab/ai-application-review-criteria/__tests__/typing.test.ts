import { describe, expect, it } from "vitest";
import { keystrokeDelays } from "../typing";

describe("keystroke delays", () => {
  it("gives every character a positive delay", () => {
    const text = "New logo acquisition experience in B2B SaaS environment.";
    const delays = keystrokeDelays(text);
    expect(delays).toHaveLength(text.length);
    expect(delays.every((ms) => ms > 0)).toBe(true);
  });

  it("types the same text the same way every time", () => {
    expect(keystrokeDelays("New Logo Acquisition")).toEqual(
      keystrokeDelays("New Logo Acquisition"),
    );
  });

  it("is not a metronome", () => {
    expect(new Set(keystrokeDelays("aaaaaaaaaaaa")).size).toBeGreaterThan(1);
  });

  it("hesitates after punctuation more than between letters", () => {
    const delays = keystrokeDelays("ab, cd");
    // The keystroke after the comma waits longer than any mid-word one.
    expect(delays[3]).toBeGreaterThan(Math.max(delays[1], delays[5]));
  });

  it("types a short title in about a second", () => {
    const total = keystrokeDelays("New Logo Acquisition").reduce(
      (sum, ms) => sum + ms,
      0,
    );
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(1500);
  });
});
