import { describe, it, expect } from "vitest";
import { gridItemVars } from "@/utils/grid-item-vars";
import { ASPECT_RATIOS } from "@/utils/demo-frame-sizing";

describe("gridItemVars", () => {
  it("splits a ratio into the width and height the grid arithmetic multiplies by", () => {
    expect(gridItemVars("16/9")).toMatchObject({
      "--aspect-w": 16,
      "--aspect-h": 9,
    });
  });

  it("keeps a portrait ratio the right way up", () => {
    expect(gridItemVars("9/16")).toMatchObject({
      "--aspect-w": 9,
      "--aspect-h": 16,
    });
  });

  it("spans one column unless asked for more", () => {
    expect(gridItemVars("1/1")).toMatchObject({ "--span": 1 });
    expect(gridItemVars("1/1", 2)).toMatchObject({ "--span": 2 });
  });

  // The pair, not a single decimal: the recipe multiplies by `--aspect-h` and
  // divides by `--aspect-w`, so 3:2 stays exact where 1.5 would not. This
  // asserts the SHAPE of that contract — a version returning `--aspect: 1.5`
  // would fail here, which is the point.
  it("carries integers, never a pre-divided decimal", () => {
    const vars = gridItemVars("3/2");
    expect(vars).not.toHaveProperty("--aspect");
    expect(Number.isInteger(vars["--aspect-w"])).toBe(true);
    expect(Number.isInteger(vars["--aspect-h"])).toBe(true);
  });

  // Derived from the map rather than restated, so a twelfth ratio is covered
  // the moment it is added and a forked list of ratios goes red.
  it.each(Object.entries(ASPECT_RATIOS))(
    "reads %s straight off the shared ratio map",
    (ratio, [w, h]) => {
      const vars = gridItemVars(ratio as keyof typeof ASPECT_RATIOS);
      expect(vars["--aspect-w"]).toBe(w);
      expect(vars["--aspect-h"]).toBe(h);
    },
  );
});
