import { Temporal } from "@js-temporal/polyfill";

// Rows are blocks of `columns` months counted from year zero, so a row holds the
// same months at any width and every row sits at a fixed offset.

export const MONTHS_IN_RUN = 2400;

const OVERSCAN_ROWS = 6;

export interface MonthGrid {
  columns: number;
  totalRows: number;
  originRow: number;
  /** The first of the `columns` months on `row`. */
  monthForRow(row: number): Temporal.PlainDate;
  rowForDate(date: Temporal.PlainDate): number;
  /** The row to park at the top on arrival. */
  openingRow(readableRows: number): number;
  /** The rows to build for a scroll resting on `topRow`. */
  windowFor(
    topRow: number,
    visibleRows: number,
  ): { start: number; rows: number };
}

function monthIndex(date: Temporal.PlainDate): number {
  return date.year * 12 + (date.month - 1);
}

function monthAt(index: number): Temporal.PlainDate {
  return new Temporal.PlainDate(Math.floor(index / 12), (index % 12) + 1, 1);
}

export function monthGrid(
  columns: number,
  today: Temporal.PlainDate,
): MonthGrid {
  const totalRows = Math.floor(MONTHS_IN_RUN / columns);
  const originRow = Math.floor(totalRows / 2);
  const anchor = monthIndex(today) - (monthIndex(today) % columns);

  const monthForRow = (row: number) =>
    monthAt(anchor + (row - originRow) * columns);

  const rowForDate = (date: Temporal.PlainDate) =>
    originRow + Math.floor((monthIndex(date) - anchor) / columns);

  return {
    columns,
    totalRows,
    originRow,
    monthForRow,
    rowForDate,
    // A row of context above today, unless that would push today off a short viewport.
    openingRow: (readableRows) =>
      Math.max(0, readableRows >= 2 ? originRow - 1 : originRow),
    windowFor: (topRow, visibleRows) => {
      const rows = Math.min(visibleRows + OVERSCAN_ROWS * 2, totalRows);
      return {
        start: Math.min(Math.max(0, topRow - OVERSCAN_ROWS), totalRows - rows),
        rows,
      };
    },
  };
}
