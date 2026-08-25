import { describe, expect, it } from "vitest";
import {
  DISMISS_FRACTION,
  FLICK_SPEED,
  dragOffset,
  shouldDismiss,
} from "../sheet-drag";

/** Half a phone: the sheet's own height, which the threshold is a fraction of. */
const HEIGHT = 400;

/** A slow drag — released with the finger all but stopped. */
const settled = (offset: number) => ({ offset, height: HEIGHT, speed: 0 });

describe("dragOffset", () => {
  it("follows the finger down", () => {
    expect(dragOffset(120)).toBe(120);
  });

  it("holds at the top rather than growing the sheet upwards", () => {
    // 50% is the sheet's height, not a starting point to drag past: pulling up
    // would promise a taller sheet that snaps back on release.
    expect(dragOffset(-80)).toBe(0);
  });

  it("is nothing at all before the finger has moved", () => {
    expect(dragOffset(0)).toBe(0);
  });
});

describe("shouldDismiss", () => {
  it("keeps a sheet nudged a little way down", () => {
    expect(shouldDismiss(settled(HEIGHT * DISMISS_FRACTION - 1))).toBe(false);
  });

  it("lets go of one dragged past a quarter of its height", () => {
    expect(shouldDismiss(settled(HEIGHT * DISMISS_FRACTION + 1))).toBe(true);
  });

  it("takes a flick, however short, as the same instruction", () => {
    // The gesture people actually make: a fast flick down that travels barely
    // any distance before the finger leaves the glass.
    expect(
      shouldDismiss({ offset: 40, height: HEIGHT, speed: FLICK_SPEED }),
    ).toBe(true);
  });

  it("ignores a fast twitch that went nowhere", () => {
    expect(
      shouldDismiss({ offset: 4, height: HEIGHT, speed: FLICK_SPEED }),
    ).toBe(false);
  });

  it("ignores speed that is not downwards", () => {
    expect(
      shouldDismiss({ offset: 40, height: HEIGHT, speed: -FLICK_SPEED }),
    ).toBe(false);
  });

  it("keeps a sheet the finger never really moved", () => {
    expect(shouldDismiss(settled(0))).toBe(false);
  });
});
