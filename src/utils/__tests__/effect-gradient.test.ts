import { describe, expect, it } from "vitest";
import { BackgroundEffectSchema } from "@/domain/nodes";
import { effectSpots, effectStyle } from "../effect-gradient";

const effect = (patch: Record<string, unknown> = {}) =>
  BackgroundEffectSchema.parse(patch);

describe("effectSpots", () => {
  it("puts one spot of colour down per colour, in the order they were authored", () => {
    const spots = effectSpots(
      effect({ colors: ["#1954DCFF", "#C3DEEBFF", "#DAEBFFFF"] }),
    );
    expect(spots).toHaveLength(3);
    expect(spots.map((spot) => spot.color)).toEqual([
      "rgba(25, 84, 220, 1)",
      "rgba(195, 222, 235, 1)",
      "rgba(218, 235, 255, 1)",
    ]);
  });

  it("keeps a colour's own opacity, which is part of the colour here", () => {
    const [spot] = effectSpots(effect({ colors: ["#1954DC80"] }));
    expect(spot.color).toBe("rgba(25, 84, 220, 0.5)");
  });

  it("lays the colours out along the effect's own turn", () => {
    // A three-quarter turn points the ramp UP the card, so the first colour is
    // at the foot and the last at the head.
    const up = effectSpots(effect({ rotation: -90, colors: ["#000000FF", "#FFFFFFFF"] }));
    expect(up[0].y).toBeGreaterThan(up[1].y);

    // And the other way round when the turn is.
    const down = effectSpots(effect({ rotation: 90, colors: ["#000000FF", "#FFFFFFFF"] }));
    expect(down[0].y).toBeLessThan(down[1].y);
  });

  it("keeps a single colour in the middle — there is no ramp to lay out", () => {
    const [spot] = effectSpots(effect({ colors: ["#1954DCFF"], rotation: -90 }));
    expect(spot.x).toBeCloseTo(50);
    expect(spot.y).toBeCloseTo(50);
  });

  it("moves the whole field with the effect's offset", () => {
    const still = effectSpots(effect({ colors: ["#1954DCFF"] }));
    const moved = effectSpots(
      effect({ colors: ["#1954DCFF"], offsetX: 0.5, offsetY: -0.25 }),
    );
    expect(moved[0].x).toBeGreaterThan(still[0].x);
    expect(moved[0].y).toBeLessThan(still[0].y);
  });
});

describe("effectStyle", () => {
  it("is a flat fill and a stack of soft spots over it", () => {
    const style = effectStyle(
      effect({ colors: ["#1954DCFF", "#DAEBFFFF"], rotation: -90 }),
    );
    expect(style.backgroundColor).toMatch(/^rgba\(/);
    expect(style.backgroundImage.match(/radial-gradient/g)).toHaveLength(2);
  });

  it("draws no spots at all for one flat colour", () => {
    const style = effectStyle(effect({ colors: ["#1954DCFF"] }));
    expect(style.backgroundColor).toBe("rgba(25, 84, 220, 1)");
    expect(style.backgroundImage).toBe("");
  });

  it("fades each spot to its OWN colour rather than to `transparent`", () => {
    // `transparent` is transparent BLACK, and a gradient to it is interpolated
    // through progressively darker, greyer pixels — which turned a pale blue
    // ground into a grey one. Fading to the same colour at zero alpha is the
    // same fade with nothing else mixed into it.
    const style = effectStyle(
      effect({ colors: ["#1954DCFF", "#DAEBFFFF"], rotation: -90 }),
    );
    expect(style.backgroundImage).not.toContain("transparent");
    expect(style.backgroundImage).toContain("rgba(25, 84, 220, 0) 100%");
    expect(style.backgroundImage).toContain("rgba(218, 235, 255, 0) 100%");
  });

  it("never hands out an eight-digit hex, which Satori cannot read", () => {
    const style = effectStyle(
      effect({ colors: ["#1954DCFF", "#C3DEEBAA", "#DAEBFF00"] }),
    );
    expect(`${style.backgroundColor}${style.backgroundImage}`).not.toMatch(
      /#[0-9a-fA-F]{8}/,
    );
  });
});
