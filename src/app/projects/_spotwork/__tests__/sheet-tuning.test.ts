import { describe, expect, it } from "vitest";
import { SHEET_TUNING, mergeTuning, rampMask, sheetRoom, sheetVars, turnedMask } from "../sheet-tuning";

const CURVE: [number, number, number, number] = [0.24, 0.32, 0.36, 1];

describe("the About sheet's tuning", () => {
  it("starts from the tuned look: three short ramps behind the cards' column, glass cards", () => {
    const layer = { saturation: 100, brightness: 100, easing: 100, curve: CURVE };
    expect(SHEET_TUNING).toEqual({
      outer: { ...layer, blur: 8, width: 420, fade: 16, opacity: 72, tint: 0 },
      middle: { ...layer, blur: 16, width: 400, fade: 12, opacity: 80, tint: 4 },
      inner: { ...layer, blur: 24, width: 380, fade: 24, opacity: 100, tint: 8 },
      cards: {
        opacity: 75,
        blur: 8,
        saturation: 100,
        brightness: 100,
        radius: 12,
        padding: 20,
        gap: 12,
        shadow: 0,
        shadowBlur: 16,
        shadowY: 4,
      },
      column: { width: 400, inset: 32 },
      motion: { duration: 300 },
    });
  });

  it("takes whatever valid values it's given over the current ones, section by section", () => {
    expect(mergeTuning(SHEET_TUNING, { cards: { opacity: 90 }, inner: { width: 320, curve: [0, 0, 1, 1] } })).toEqual({
      ...SHEET_TUNING,
      cards: { ...SHEET_TUNING.cards, opacity: 90 },
      inner: { ...SHEET_TUNING.inner, width: 320, curve: [0, 0, 1, 1] },
    });
  });

  it("keeps a value within its control's range, and a curve's handles across it", () => {
    const merged = mergeTuning(SHEET_TUNING, { cards: { opacity: 140 }, outer: { width: -20, curve: [1.5, 2, -1, 0] } });
    expect(merged?.cards.opacity).toBe(100);
    expect(merged?.outer.width).toBe(0);
    expect(merged?.outer.curve).toEqual([1, 2, 0, 0]);
  });

  it("ignores what isn't one of its values, and holds nothing for values with none", () => {
    expect(mergeTuning(SHEET_TUNING, { cards: { blur: "12", gap: Number.NaN }, middle: { blur: 20, curve: [1, 2] } })).toEqual({
      ...SHEET_TUNING,
      middle: { ...SHEET_TUNING.middle, blur: 20 },
    });
    for (const values of [null, "x", 4, [], { fade: 200 }, { outerBlur: 8 }, { cards: 3 }])
      expect(mergeTuning(SHEET_TUNING, values)).toBeNull();
  });

  it("ramps a layer from whole, where its fade starts, to clear at its left edge", () => {
    const mask = rampMask({ fade: 40, easing: 0, curve: CURVE });
    expect(mask.startsWith("linear-gradient(to left, rgb(0 0 0 / 1) 60%,")).toBe(true);
    expect(mask).toContain("rgb(0 0 0 / 0.52) 79.2%");
    expect(mask.endsWith("rgb(0 0 0 / 0) 100%)")).toBe(true);
  });

  it("turned a quarter clockwise, ramps a layer from clear at its top edge over the length its fade takes of its width, whole below however tall it is", () => {
    const mask = turnedMask({ width: 400, fade: 40, easing: 0, curve: CURVE });
    expect(mask.startsWith("linear-gradient(to bottom, rgb(0 0 0 / 0) 0px,")).toBe(true);
    expect(mask).toContain("rgb(0 0 0 / 0.52) 83.2px");
    expect(mask.endsWith("rgb(0 0 0 / 1) 160px)")).toBe(true);
  });

  it("hands the sheet its values as CSS variables", () => {
    const vars = sheetVars(
      mergeTuning(SHEET_TUNING, {
        outer: { blur: 4, saturation: 180, brightness: 90, width: 900, opacity: 50, tint: 10 },
        cards: { opacity: 60, blur: 20, saturation: 150, radius: 16, padding: 24, gap: 8, shadow: 20, shadowBlur: 24, shadowY: 6 },
        column: { width: 360, inset: 24 },
        motion: { duration: 450 },
      })!,
    );
    expect(vars).toMatchObject({
      "--sheet-outer-width": "900px",
      "--sheet-outer-filter": "blur(4px) saturate(180%) brightness(90%)",
      "--sheet-outer-mask": rampMask(SHEET_TUNING.outer),
      "--sheet-outer-turned-mask": turnedMask({ ...SHEET_TUNING.outer, width: 900 }),
      "--sheet-outer-opacity": "0.5",
      "--sheet-outer-tint": "10%",
      "--sheet-card-opacity": "60%",
      "--sheet-card-filter": "blur(20px) saturate(150%) brightness(100%)",
      "--sheet-card-radius": "16px",
      "--sheet-card-padding": "24px",
      "--sheet-card-gap": "8px",
      "--sheet-card-shadow": "0 6px 24px color-mix(in srgb, var(--colors-neutral-900) 20%, transparent)",
      "--sheet-column-width": "360px",
      "--sheet-column-inset": "24px",
      "--sheet-duration": "450ms",
    });
  });

  it("takes the room from its cards' left edge to the right edge, whatever its layers' widths", () => {
    expect(sheetRoom(SHEET_TUNING)).toBe(368);
    expect(sheetRoom(mergeTuning(SHEET_TUNING, { column: { width: 480, inset: 20 } })!)).toBe(460);
    expect(sheetRoom(mergeTuning(SHEET_TUNING, { inner: { width: 900 } })!)).toBe(368);
  });
});
