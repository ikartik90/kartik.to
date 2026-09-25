import { describe, expect, it } from "vitest";

import { nearerInsertSide } from "../grid-insert-side";

const cell = { left: 100, width: 200 }; // midpoint 200

describe("nearerInsertSide", () => {
  it("picks the leading gutter for a cursor in the card's leading half", () => {
    expect(nearerInsertSide(120, cell)).toBe("before");
  });

  it("picks the trailing gutter for a cursor in the card's trailing half", () => {
    expect(nearerInsertSide(280, cell)).toBe("after");
  });

  it("keeps its answer past the card's edges", () => {
    expect(nearerInsertSide(80, cell)).toBe("before");
    expect(nearerInsertSide(330, cell)).toBe("after");
  });

  it("settles the midpoint on the trailing side", () => {
    expect(nearerInsertSide(200, cell)).toBe("after");
  });
});
