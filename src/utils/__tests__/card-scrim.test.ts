import { describe, expect, it } from "vitest";
import {
  CARD_SCRIM_MIN_SHARE,
  CARD_WASH_PEAK,
  CARD_WASH_STOPS,
  cardWashGradient,
  cardWashStops,
} from "../card-scrim";

describe("cardWashStops", () => {
  const stops = cardWashStops();

  it("describes the curve with enough stops that its corners cannot be found", () => {
    expect(stops).toHaveLength(CARD_WASH_STOPS);
  });

  it("starts at nothing and ends at the peak", () => {
    expect(stops[0]).toEqual({ offset: 0, alpha: 0 });
    expect(stops[stops.length - 1]).toEqual({ offset: 1, alpha: CARD_WASH_PEAK });
  });

  it("only ever thickens", () => {
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].alpha).toBeGreaterThan(stops[i - 1].alpha);
      expect(stops[i].offset).toBeGreaterThan(stops[i - 1].offset);
    }
  });

  it("leaves the top of the ramp flat, which is the whole point of the curve", () => {
    expect(stops[1].alpha).toBeLessThan(0.02 * CARD_WASH_PEAK);
  });

  it("settles flat into the foot as well", () => {
    const last = stops[stops.length - 1].alpha;
    const penultimate = stops[stops.length - 2].alpha;
    expect(last - penultimate).toBeLessThan(0.02 * CARD_WASH_PEAK);
  });
});

describe("cardWashGradient", () => {
  it("paints the curve in whatever colour the surface can express", () => {
    const gradient = cardWashGradient(
      (alpha) => `rgba(216, 221, 227, ${alpha.toFixed(3)})`,
    );
    expect(gradient.startsWith("linear-gradient(to bottom, ")).toBe(true);
    expect(gradient.match(/rgba\(/g)).toHaveLength(CARD_WASH_STOPS);
    expect(gradient).toContain("rgba(216, 221, 227, 0.000) 0.0%");
    expect(gradient).toContain("rgba(216, 221, 227, 0.950) 100.0%");
  });
});

describe("CARD_SCRIM_MIN_SHARE", () => {
  it("is the quarter of the card the band is at least", () => {
    expect(CARD_SCRIM_MIN_SHARE).toBe(0.25);
  });
});
