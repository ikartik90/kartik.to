import { describe, expect, it } from "vitest";
import { SHIFT } from "../shift-content";
import { fewest } from "../shift-sheet";

describe("fewest", () => {
  it("marks the lowest count in a row, every one that ties", () => {
    expect(fewest(["8", "4", "4"])).toEqual([false, true, true]);
  });

  it("never marks a result there is none of", () => {
    expect(fewest(["92", "Not possible", "3"])).toEqual([false, false, true]);
  });
});

describe("the scheduler comparison", () => {
  it("gives every prompt a result for each scheduler", () => {
    const { head, rows } = SHIFT.comparison;
    for (const row of rows) expect(row).toHaveLength(head.length);
  });

  it("totals the 81% fewer clicks its outcome claims, drag to select against the old calendar", () => {
    const total = (column: number) => SHIFT.comparison.rows.reduce((sum, row) => sum + Number(row[column]), 0);
    expect(Math.round((1 - total(3) / total(1)) * 100)).toBe(81);
    expect(SHIFT.outcome.value).toBe("81%");
  });
});
