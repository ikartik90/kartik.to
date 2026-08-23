import { describe, expect, it } from "vitest";

import { nearerInsertSide } from "../grid-insert-side";

// ---------------------------------------------------------------------------
// A card in edit mode has a gutter either side, and only the one the cursor is
// already next to should offer its [+]. Which one that is, is decided against
// the card's own midpoint.
// ---------------------------------------------------------------------------

const cell = { left: 100, width: 200 }; // midpoint 200

describe("nearerInsertSide", () => {
  it("picks the leading gutter for a cursor in the card's leading half", () => {
    expect(nearerInsertSide(120, cell)).toBe("before");
  });

  it("picks the trailing gutter for a cursor in the card's trailing half", () => {
    expect(nearerInsertSide(280, cell)).toBe("after");
  });

  // The rails sit OUTSIDE the card, in the gutters, and hovering one still
  // counts as hovering the cell — so the cursor is regularly past either edge
  // and the answer has to keep pointing at the gutter it is standing in.
  it("keeps its answer past the card's edges", () => {
    expect(nearerInsertSide(80, cell)).toBe("before");
    expect(nearerInsertSide(330, cell)).toBe("after");
  });

  // Exactly on the midpoint has to go one way or the other; the tie is only
  // worth stating so it cannot flicker between the two as the cursor rests.
  it("settles the midpoint on the trailing side", () => {
    expect(nearerInsertSide(200, cell)).toBe("after");
  });
});
