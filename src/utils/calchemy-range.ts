import { Temporal } from "@js-temporal/polyfill";
import { WEEKDAY_KEYS, weekdayOf, type WeekdayKey } from "./calendar-month";

export interface DateRange {
  first: Temporal.PlainDate;
  last: Temporal.PlainDate;
}

export interface RangeRun {
  length: number;
  fadesIn: boolean;
  fadesOut: boolean;
}

export interface RangeCell {
  /** `start` and `end` carry the chip; `inside` is band alone. */
  role: "start" | "end" | "inside";
  /** Only on the cell that opens a run. */
  run: RangeRun | null;
}

export function rangeOf(
  dates: readonly Temporal.PlainDate[],
): DateRange | null {
  if (dates.length === 0) return null;

  const sorted = [...dates].sort(Temporal.PlainDate.compare);
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}

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

function columnOf(date: Temporal.PlainDate, weekStartsOn: WeekdayKey): number {
  return (
    (WEEKDAY_KEYS.indexOf(weekdayOf(date)) -
      WEEKDAY_KEYS.indexOf(weekStartsOn) +
      7) %
    7
  );
}

/** How `date` takes part in `range` in its own month's grid; the caller withholds spill days. */
export function rangeCell(
  date: Temporal.PlainDate,
  range: DateRange,
  weekStartsOn: WeekdayKey,
): RangeCell | null {
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
      fadesIn:
        date.day === 1 && Temporal.PlainDate.compare(range.first, date) < 0,
      fadesOut:
        end.day === end.daysInMonth &&
        Temporal.PlainDate.compare(range.last, end) > 0,
    },
  };
}
