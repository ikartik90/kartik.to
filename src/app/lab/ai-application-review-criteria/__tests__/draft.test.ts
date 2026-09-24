import { describe, expect, it } from "vitest";
import { CRITERIA } from "../harness-data";
import { hasChanged, startingDraft, withCustomCriterion } from "../draft";

const NEW_LOGO = CRITERIA.find((c) => c.id === "new-logo")!;

describe("the criteria draft", () => {
  it("starts from the three criteria already running", () => {
    expect(startingDraft().map((row) => row.id)).toEqual([
      "full-cycle",
      "crm",
      "large-deals",
    ]);
  });

  it("adds the custom criterion at the top, blank, for it to be typed in", () => {
    const [added, ...rest] = withCustomCriterion(startingDraft());
    expect(added).toEqual({ id: NEW_LOGO.id, title: "", prompt: "" });
    expect(rest).toEqual(startingDraft());
  });

  it("adds it once", () => {
    const once = withCustomCriterion(startingDraft());
    expect(withCustomCriterion(once)).toBe(once);
  });

  it("has changed once a criterion is added, or any field differs from what is running", () => {
    const draft = startingDraft();
    expect(hasChanged(draft)).toBe(false);
    expect(hasChanged(withCustomCriterion(draft))).toBe(true);

    const retitled = draft.map((row, i) =>
      i === 0 ? { ...row, title: "Something else" } : row,
    );
    expect(hasChanged(retitled)).toBe(true);

    const putBack = retitled.map((row, i) =>
      i === 0 ? { ...row, title: draft[0].title } : row,
    );
    expect(hasChanged(putBack)).toBe(false);
  });

  it("compares with the criteria last tested, when there are some", () => {
    const tested = withCustomCriterion(startingDraft());
    expect(hasChanged(tested, tested)).toBe(false);
    expect(hasChanged(startingDraft(), tested)).toBe(true);
  });
});
