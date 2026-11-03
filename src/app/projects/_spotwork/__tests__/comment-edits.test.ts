import { describe, expect, it } from "vitest";
import { TOUR } from "../copy";
import { NO_EDITS, advance, fromValues, shownStep, toValues, type Edits, type Spot } from "../comment-edits";

const spot: Spot = {
  path: '[data-worker="Maria Franci"] > div:nth-child(3) > button',
  what: "button “Check In…” in Maria Franci's row",
  x: 0.5,
  y: 0.25,
  viewport: { width: 1440, height: 900 },
};

const edits: Edits = {
  steps: {
    "open-check-in": { text: "Check her in here.", spot },
    "excuse-late": { deleted: true },
  },
  added: [{ id: "a1", step: "excuse-late", text: "Try typing 3:07.", spot }],
};

describe("toValues", () => {
  it("copies nothing when nothing changed", () => {
    expect(toValues(NO_EDITS)).toEqual({ comments: [], added: [] });
  });

  it("copies each changed comment beside its step, with the old text next to the new", () => {
    const { comments } = toValues(edits);
    expect(comments).toEqual([
      {
        step: "open-check-in",
        number: 1,
        title: TOUR.steps[0].title,
        was: TOUR.steps[0].body,
        now: "Check her in here.",
        pointsAt: spot,
      },
      { step: "excuse-late", number: 2, title: TOUR.steps[1].title, deleted: true },
    ]);
  });

  it("copies added comments with the step they show with and where they point", () => {
    expect(toValues(edits).added).toEqual([{ id: "a1", withStep: "excuse-late", text: "Try typing 3:07.", pointsAt: spot }]);
  });
});

describe("fromValues", () => {
  it("reads back what toValues copied", () => {
    expect(fromValues(toValues(edits))).toEqual(edits);
  });

  it("refuses what isn't copied comments", () => {
    expect(fromValues({ hello: 1 })).toBeNull();
    expect(fromValues({ comments: [{ step: "nope" }], added: [] })).toBeNull();
    expect(fromValues("text")).toBeNull();
  });
});

describe("shownStep", () => {
  const deleted = (...indices: number[]) => (index: number) => indices.includes(index);

  it("shows the current step's comment", () => {
    expect(shownStep(2, 9, deleted())).toBe(2);
  });

  it("skips deleted steps to the next comment", () => {
    expect(shownStep(2, 9, deleted(2, 3))).toBe(4);
  });

  it("shows none when every step left is deleted", () => {
    expect(shownStep(7, 9, deleted(7, 8))).toBeNull();
  });
});

describe("advance", () => {
  const COUNT = 9;
  const none = () => false;

  it("moves on from the current step once it's done", () => {
    expect(advance(2, 2, COUNT, none)).toBe(3);
  });

  it("stays put when a step other than the current one is done", () => {
    expect(advance(2, 4, COUNT, none)).toBe(2);
  });

  it("moves past deleted steps when the step after them is done", () => {
    expect(advance(2, 4, COUNT, (index) => index === 2 || index === 3)).toBe(5);
  });

  it("stays on the last step", () => {
    expect(advance(8, 8, COUNT, none)).toBe(8);
  });
});
