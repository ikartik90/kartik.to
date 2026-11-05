import { describe, expect, it } from "vitest";
import { SIDE_SHEET_MOTION, mergeMotion, motionVars } from "../side-sheet-motion";

describe("a side sheet's motion", () => {
  it("slides 120px in from the right as it fades, over 250ms each way, and leaves the way it came", () => {
    expect(SIDE_SHEET_MOTION).toEqual({
      unit: "px",
      origin: "end",
      enter: { x: 120, y: 0, opacity: 0, scale: 1, duration: 250, delay: 0, easing: [0.08, 0.59, 0.4, 1] },
      exit: { mirror: true, x: 24, y: 0, opacity: 0, scale: 1, duration: 250, delay: 0, easing: [0.6, 0, 0.92, 0.4] },
      scrim: { enter: 250, exit: 250, delay: 0 },
    });
  });

  it("writes its values as the CSS variables the side sheet and its scrim read", () => {
    expect(motionVars(SIDE_SHEET_MOTION)).toEqual({
      "--side-sheet-origin": "100% 50%",
      "--side-sheet-in-from": "120px 0px",
      "--side-sheet-in-opacity": "0",
      "--side-sheet-in-scale": "1",
      "--side-sheet-in-duration": "250ms",
      "--side-sheet-in-delay": "0ms",
      "--side-sheet-in-easing": "cubic-bezier(0.08, 0.59, 0.4, 1)",
      "--side-sheet-out-to": "120px 0px",
      "--side-sheet-out-opacity": "0",
      "--side-sheet-out-scale": "1",
      "--side-sheet-out-duration": "250ms",
      "--side-sheet-out-delay": "0ms",
      "--side-sheet-out-easing": "cubic-bezier(0.6, 0, 0.92, 0.4)",
      "--side-sheet-scrim-in": "250ms",
      "--side-sheet-scrim-out": "250ms",
      "--side-sheet-scrim-delay": "0ms",
    });
  });

  it("measures its offsets in the sheet's own size in %, so 100% starts it off the edge", () => {
    const vars = motionVars({ ...SIDE_SHEET_MOTION, unit: "%", enter: { ...SIDE_SHEET_MOTION.enter, x: 100 } });
    expect(vars["--side-sheet-in-from"]).toBe("100% 0%");
    expect(vars["--side-sheet-out-to"]).toBe("100% 0%");
  });

  it("leaves the way it came while the exit mirrors the entrance, and by its own values once it doesn't", () => {
    const enter = { ...SIDE_SHEET_MOTION.enter, x: 40, opacity: 0.2, scale: 0.98 };
    const exit = { ...SIDE_SHEET_MOTION.exit, x: 0, y: 16, opacity: 0.5, scale: 1.02 };
    const mirrored = motionVars({ ...SIDE_SHEET_MOTION, enter, exit });
    expect([mirrored["--side-sheet-out-to"], mirrored["--side-sheet-out-opacity"], mirrored["--side-sheet-out-scale"]]).toEqual([
      "40px 0px",
      "0.2",
      "0.98",
    ]);
    const own = motionVars({ ...SIDE_SHEET_MOTION, enter, exit: { ...exit, mirror: false } });
    expect([own["--side-sheet-out-to"], own["--side-sheet-out-opacity"], own["--side-sheet-out-scale"]]).toEqual([
      "0px 16px",
      "0.5",
      "1.02",
    ]);
  });

  it("scales from its centre when asked", () => {
    expect(motionVars({ ...SIDE_SHEET_MOTION, origin: "center" })["--side-sheet-origin"]).toBe("center");
  });

  it("takes whatever valid values it's given over the current ones, and keeps each within its range", () => {
    expect(
      mergeMotion(SIDE_SHEET_MOTION, {
        unit: "%",
        enter: { x: 100, duration: 9000, easing: [0.4, 0, 0.2, 1] },
        exit: { mirror: false, opacity: -1 },
        scrim: { delay: 40 },
      }),
    ).toEqual({
      ...SIDE_SHEET_MOTION,
      unit: "%",
      enter: { ...SIDE_SHEET_MOTION.enter, x: 100, duration: 2000, easing: [0.4, 0, 0.2, 1] },
      exit: { ...SIDE_SHEET_MOTION.exit, mirror: false, opacity: 0 },
      scrim: { ...SIDE_SHEET_MOTION.scrim, delay: 40 },
    });
  });

  it("ignores what isn't one of its values, and holds nothing for values with none", () => {
    expect(mergeMotion(SIDE_SHEET_MOTION, { unit: "em", origin: "center", enter: { x: "12", easing: [2, 0, 0, 1] } })).toEqual({
      ...SIDE_SHEET_MOTION,
      origin: "center",
    });
    for (const values of [null, "x", 4, [], { unit: "em" }, { enter: 3 }, { enter: { x: Number.NaN } }])
      expect(mergeMotion(SIDE_SHEET_MOTION, values)).toBeNull();
  });
});
