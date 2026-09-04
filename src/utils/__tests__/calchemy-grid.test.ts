import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { MONTHS_IN_RUN, monthGrid } from "../calchemy-grid";

const WIDTHS = [1, 2, 3];

/** The months a row holds, in reading order. */
function monthsOn(
  grid: ReturnType<typeof monthGrid>,
  row: number,
): Temporal.PlainDate[] {
  const first = grid.monthForRow(row);
  return Array.from({ length: grid.columns }, (_, at) =>
    first.add({ months: at }),
  );
}

describe("monthGrid", () => {
  it("puts today on the origin row at every width", () => {
    // The whole point of the anchor: however many columns survive the
    // viewport, the row the page opens against is the row today is on.
    for (const today of ["2026-01-01", "2026-09-04", "2026-12-31"]) {
      const date = Temporal.PlainDate.from(today);
      for (const columns of WIDTHS) {
        const grid = monthGrid(columns, date);
        const months = monthsOn(grid, grid.originRow).map(
          (month) => `${month.year}-${month.month}`,
        );
        expect(months).toContain(`${date.year}-${date.month}`);
      }
    }
  });

  it("aligns rows to the calendar, not to today", () => {
    // October is the third month of its pair (Sep–Oct) and the first of its
    // quarter — so the two widths open on different months, and neither of
    // them opens on October just because that is where today is.
    const today = Temporal.PlainDate.from("2026-10-15");

    expect(
      monthGrid(3, today).monthForRow(monthGrid(3, today).originRow).month,
    ).toBe(10); // Oct–Dec
    expect(
      monthGrid(2, today).monthForRow(monthGrid(2, today).originRow).month,
    ).toBe(9); // Sep–Oct
    expect(
      monthGrid(1, today).monthForRow(monthGrid(1, today).originRow).month,
    ).toBe(10);
  });

  it("starts every row on the same boundary as the origin", () => {
    const today = Temporal.PlainDate.from("2026-09-04");

    for (const columns of WIDTHS) {
      const grid = monthGrid(columns, today);
      const origin = grid.monthForRow(grid.originRow);

      for (const row of [0, 1, grid.originRow - 7, grid.originRow + 40]) {
        const month = grid.monthForRow(row);
        const distance =
          (month.year - origin.year) * 12 + (month.month - origin.month);
        // `Math.abs`, because a row above the origin gives a signed zero.
        expect(Math.abs(distance % columns)).toBe(0);
        expect(month.day).toBe(1);
      }
    }
  });

  it("reads a date back to the row it is drawn on", () => {
    const today = Temporal.PlainDate.from("2026-09-04");

    for (const columns of WIDTHS) {
      const grid = monthGrid(columns, today);

      for (const row of [0, 12, grid.originRow, grid.totalRows - 1]) {
        for (const month of monthsOn(grid, row)) {
          expect(grid.rowForDate(month)).toBe(row);
          // Any day of the month, not just its first.
          expect(grid.rowForDate(month.with({ day: 28 }))).toBe(row);
        }
      }
    }
  });

  it("runs the same span of months at every width", () => {
    const today = Temporal.PlainDate.from("2026-09-04");

    for (const columns of WIDTHS) {
      const grid = monthGrid(columns, today);
      expect(grid.totalRows * columns).toBe(MONTHS_IN_RUN);
      // A century either side of today, which is what makes the scroll feel
      // endless without ever moving the rows already on screen.
      expect(grid.rowForDate(today.add({ years: 99 }))).toBeLessThan(
        grid.totalRows,
      );
      expect(grid.rowForDate(today.subtract({ years: 99 }))).toBeGreaterThan(0);
    }
  });

  it("opens a row above today's where two rows read clear", () => {
    const grid = monthGrid(3, Temporal.PlainDate.from("2026-09-04"));

    expect(grid.openingRow(2)).toBe(grid.originRow - 1);
    expect(grid.openingRow(5)).toBe(grid.originRow - 1);
  });

  it("opens on today's row where only one does", () => {
    // A short viewport: one row above would push today off the bottom, and
    // arriving with today off screen is the one thing the opening may not do.
    const grid = monthGrid(1, Temporal.PlainDate.from("2026-09-04"));

    expect(grid.openingRow(1)).toBe(grid.originRow);
    expect(grid.openingRow(0)).toBe(grid.originRow);
  });

  it("builds a window around the scroll, clamped to the run", () => {
    const grid = monthGrid(3, Temporal.PlainDate.from("2026-09-04"));

    const middle = grid.windowFor(grid.originRow, 4);
    expect(middle.start).toBeLessThan(grid.originRow);
    expect(middle.start + middle.rows).toBeGreaterThan(grid.originRow + 4);

    // Neither end of the run can be overrun, however hard it is scrolled at.
    const top = grid.windowFor(0, 4);
    expect(top.start).toBe(0);

    const foot = grid.windowFor(grid.totalRows - 1, 4);
    expect(foot.start + foot.rows).toBe(grid.totalRows);
  });
});
