import { Temporal } from "@js-temporal/polyfill";
import { WEEKDAY_KEYS, weekdayOf, type WeekdayKey } from "./calendar-month";

// ---------------------------------------------------------------------------
// How a range is DRAWN across a month grid — the arithmetic behind the band,
// held apart from the playground so it can be asked questions without a
// viewport.
//
// A range is not a set of selected days. Only its two ends carry the chip; the
// days between them are a wash the ends are read across, which is what tells a
// range apart from thirty separate picks at a glance.
//
// Drawing that wash is a question about RUNS rather than about days. A month
// grid is seven columns wide, so a range crossing it is broken into one
// unbroken stretch per week row, and each stretch is one box: a band that
// stopped and restarted at every cell would be a row of chips again, and the
// gutters between the columns are as wide as the columns themselves once the
// grid is `fluid`. So each run is described once, on the cell that opens it,
// and the view draws a single box from there.
//
// A run ends for one of three reasons, and only one of them is a boundary the
// eye should see:
//
//   • the week runs out, or the range does — a clean stop. The next row picks
//     the band up where it left off, and the range's own ends are marked by the
//     chips already sitting there.
//   • the MONTH runs out. Here the band has somewhere to go that the grid
//     cannot show: the days after it are in the next month's own grid, columns
//     away or a row down. A hard edge there reads as the range ending, which is
//     exactly what it does not do — so the band fades out over the last day of
//     the month and fades back in over the first day of the next, and the pair
//     reads as one band passing behind the boundary.
//
// Spill days are never banded. A boundary date is drawn twice — once by the
// month that owns it, once as its neighbour's spill — and banding both would
// paint the same day in two places while the fade is trying to say it moved.
// ---------------------------------------------------------------------------

/** The two days a range runs between, in order. */
export interface DateRange {
  first: Temporal.PlainDate;
  last: Temporal.PlainDate;
}

/** One unbroken stretch of band, starting at the cell that carries it. */
export interface RangeRun {
  /** How many cells the band covers, this one included. */
  length: number;
  /** The band arrives from the month before — fade it in over the first cell. */
  fadesIn: boolean;
  /** The band carries on into the month after — fade it out over the last. */
  fadesOut: boolean;
}

/** Where one day sits in the range being drawn. */
export interface RangeCell {
  /** `start` and `end` carry the chip; `inside` is band alone. */
  role: "start" | "end" | "inside";
  /** Set only on the cell that OPENS a run — null on every other. */
  run: RangeRun | null;
}

/**
 * The range a selection stands for: its earliest day and its latest. Order is
 * not assumed — a hand-made selection arrives in whatever order it was clicked.
 */
export function rangeOf(
  dates: readonly Temporal.PlainDate[],
): DateRange | null {
  if (dates.length === 0) return null;

  const sorted = [...dates].sort(Temporal.PlainDate.compare);
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

/**
 * Every day the range covers. A range is held as its two ends, so this is what
 * anything wanting the days themselves — a named date defined over one — asks
 * for.
 */
export function rangeDays(range: DateRange): Temporal.PlainDate[] {
  const days: Temporal.PlainDate[] = [];
  for (
    let day = range.first;
    Temporal.PlainDate.compare(day, range.last) <= 0;
    day = day.add({ days: 1 })
  )
    days.push(day);

  return days;
}

/** Which of the seven columns `date` is drawn in, under `weekStartsOn`. */
function columnOf(date: Temporal.PlainDate, weekStartsOn: WeekdayKey): number {
  return (
    (WEEKDAY_KEYS.indexOf(weekdayOf(date)) -
      WEEKDAY_KEYS.indexOf(weekStartsOn) +
      7) %
    7
  );
}

/**
 * How `date` takes part in `range`, as its OWN month's grid draws it — null
 * when the range does not reach it. Spill days are the caller's to withhold;
 * everything here is asked of the month the date belongs to.
 */
export function rangeCell(
  date: Temporal.PlainDate,
  range: DateRange,
  weekStartsOn: WeekdayKey,
): RangeCell | null {
  // Banded, and drawn in this grid. Reaching into the neighbouring month is
  // what the fades are for, so a day outside it is never part of this run —
  // stepping off the 1st or the last of the month fails this test, which is
  // what closes a run at the boundary without a case of its own.
  const banded = (day: Temporal.PlainDate) =>
    Temporal.PlainDate.compare(day, range.first) >= 0 &&
    Temporal.PlainDate.compare(day, range.last) <= 0 &&
    day.year === date.year &&
    day.month === date.month;

  if (!banded(date)) return null;

  const role = date.equals(range.first)
    ? "start"
    : date.equals(range.last)
      ? "end"
      : "inside";

  // A run opens where the band did not already arrive from the left — the head
  // of a week row, the first day of the month, or the range's own first day.
  const opens =
    columnOf(date, weekStartsOn) === 0 || !banded(date.subtract({ days: 1 }));
  if (!opens) return { role, run: null };

  let end = date;
  for (;;) {
    const next = end.add({ days: 1 });
    if (columnOf(next, weekStartsOn) === 0 || !banded(next)) break;
    end = next;
  }

  return {
    role,
    run: {
      length: end.since(date).days + 1,
      // Only where the band has somewhere to go. A run that opens on the 1st
      // because the range does has nothing behind it to fade from.
      fadesIn:
        date.day === 1 && Temporal.PlainDate.compare(range.first, date) < 0,
      fadesOut:
        end.day === end.daysInMonth &&
        Temporal.PlainDate.compare(range.last, end) > 0,
    },
  };
}
