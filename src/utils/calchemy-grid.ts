import { Temporal } from "@js-temporal/polyfill";

// ---------------------------------------------------------------------------
// Where each month sits in the Calchemy playground's endless run — the whole of
// the arithmetic the scroll is built on, held apart from the page so it can be
// asked questions without a viewport.
//
// The run is virtualised against a FIXED height: every row sits at its own
// absolute offset and nothing is ever loaded, so the row that was at 1,200px is
// still at 1,200px whether or not it happens to be built at the moment. That
// only works while the row a month falls on is a SUM rather than a lookup, and
// this is that sum.
//
// How many months fit across is the viewport's business and it changes — three
// on a desktop, two beside a docked rail, one on a phone. Which makes the sum a
// function of the column count, and raises the question this module exists to
// answer: at every width, WHICH months share a row?
//
// The answer is the calendar's own, not today's. Rows are blocks of `columns`
// months counted from the start of the era, so three across gives the quarters
// (Jan–Mar, Apr–Jun, …), two across gives the pairs (Jan–Feb, Mar–Apr, …), and
// one across gives the months themselves. Today then always falls INSIDE a row
// rather than opening one, which is what lets the page open on a row that has
// today on it at every width — and it means a row means the same months however
// the window is dragged, so a resize moves the grid without renaming it.
// ---------------------------------------------------------------------------

/** Two centuries of months, which is what the scroll is long enough to be. */
export const MONTHS_IN_RUN = 2400;

/**
 * Rows built beyond each edge of the viewport, so a fast scroll never outruns
 * them — deep enough to cover a hard flick, which is roughly a screen.
 */
const OVERSCAN_ROWS = 6;

/** The whole geometry of one column count. */
export interface MonthGrid {
  /** Months across a row. */
  columns: number;
  /** Rows in the run, end to end. */
  totalRows: number;
  /** The row today falls on. */
  originRow: number;
  /** The month opening `row`, the first of the `columns` it holds. */
  monthForRow(row: number): Temporal.PlainDate;
  /** The row `date` is drawn on — the inverse of {@link monthForRow}. */
  rowForDate(date: Temporal.PlainDate): number;
  /**
   * The row to park at the top on arrival, given how many rows read clear of
   * the page's own chrome.
   */
  openingRow(readableRows: number): number;
  /** Which rows to build for a scroll resting on `topRow`. */
  windowFor(
    topRow: number,
    visibleRows: number,
  ): { start: number; rows: number };
}

/** Months since year zero — the one number this arithmetic is easy in. */
function monthIndex(date: Temporal.PlainDate): number {
  return date.year * 12 + (date.month - 1);
}

function monthAt(index: number): Temporal.PlainDate {
  return new Temporal.PlainDate(Math.floor(index / 12), (index % 12) + 1, 1);
}

/**
 * The geometry of a run `columns` months across, with `today` on its origin
 * row. Everything else about the scroll — its height, which rows are built,
 * where it opens — is read off this.
 */
export function monthGrid(
  columns: number,
  today: Temporal.PlainDate,
): MonthGrid {
  const totalRows = Math.floor(MONTHS_IN_RUN / columns);
  const originRow = Math.floor(totalRows / 2);
  // The block today falls in. Counted from the era rather than from today, so
  // the boundaries are the calendar's — see the header.
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
    // One row above today's, so the months you are in read SECOND rather than
    // jammed against the top — but only where there is room for both. On a
    // short viewport that row of context would push today off the bottom, and
    // arriving with today off screen is the one thing an opening may not do.
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
