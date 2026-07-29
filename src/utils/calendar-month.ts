import { Temporal } from "@js-temporal/polyfill";

// ---------------------------------------------------------------------------
// Pure month-grid math for the date picker, on Temporal (never JS `Date`).
// Given the month a `PlainDate` falls in, lay out the canonical 6-week (42-cell)
// grid: leading/trailing days spill from the adjacent months so every row is
// full and the calendar never reflows between months. All weekday identity is
// surfaced as data so the view layer can style weekdays/weekends without redoing
// any date math (see `Calendar.Day` / `Calendar.Date`).
// ---------------------------------------------------------------------------

export type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

/** Canonical Sunday-first order; every rotation derives from this. */
export const WEEKDAY_KEYS: WeekdayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const WEEKEND: ReadonlySet<WeekdayKey> = new Set<WeekdayKey>(["sat", "sun"]);

/**
 * Temporal `dayOfWeek` is Mon=1…Sun=7; map it into our Sunday-first keys.
 * Exported because the `% 7` rotation is the one place ISO's ordering meets
 * ours — anywhere that re-derives it is a second definition waiting to drift.
 */
export function weekdayOf(date: Temporal.PlainDate): WeekdayKey {
  return WEEKDAY_KEYS[date.dayOfWeek % 7];
}

export interface CalendarCell {
  date: Temporal.PlainDate;
  /** ISO string — a stable React key and a natural equality handle. */
  key: string;
  /** Day-of-month number to render. */
  day: number;
  weekday: WeekdayKey;
  isWeekend: boolean;
  /** False for the spill-over days borrowed from the adjacent months. */
  inCurrentMonth: boolean;
}

export interface WeekdayHeaderCell {
  key: WeekdayKey;
  /** Column position under the current week start (0–6). */
  index: number;
  isWeekend: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  /** `YYYY-MM` — a stable React key and a natural identity handle. */
  key: string;
  /** First-of-month, the anchor every consumer needs for labels and compares. */
  start: Temporal.PlainDate;
  weeks: CalendarCell[][];
  weekdays: WeekdayHeaderCell[];
}

export interface BuildCalendarMonthOptions {
  /** Which weekday sits in column 0. Defaults to Sunday (matches the design). */
  weekStartsOn?: WeekdayKey;
}

export interface BuildCalendarPeriodsOptions extends BuildCalendarMonthOptions {
  /** How many consecutive months to lay out, starting at the view. Min 1. */
  months?: number;
}

/** The weekday header row, rotated so `weekStartsOn` lands in column 0. */
export function weekdayHeader(
  weekStartsOn: WeekdayKey = "sun",
): WeekdayHeaderCell[] {
  const start = WEEKDAY_KEYS.indexOf(weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => {
    const key = WEEKDAY_KEYS[(start + index) % 7];
    return { key, index, isWeekend: WEEKEND.has(key) };
  });
}

/** Build the 6×7 grid for the month `view` falls in. */
export function buildCalendarMonth(
  view: Temporal.PlainDate,
  { weekStartsOn = "sun" }: BuildCalendarMonthOptions = {},
): CalendarMonth {
  const startCol = WEEKDAY_KEYS.indexOf(weekStartsOn);
  const firstOfMonth = view.with({ day: 1 });
  // Distance from the week start back to the first-of-month's column.
  const lead = (WEEKDAY_KEYS.indexOf(weekdayOf(firstOfMonth)) - startCol + 7) % 7;
  const gridStart = firstOfMonth.subtract({ days: lead });

  const weeks: CalendarCell[][] = [];
  for (let row = 0; row < 6; row++) {
    const week: CalendarCell[] = [];
    for (let col = 0; col < 7; col++) {
      const date = gridStart.add({ days: row * 7 + col });
      const weekday = weekdayOf(date);
      week.push({
        date,
        key: date.toString(),
        day: date.day,
        weekday,
        isWeekend: WEEKEND.has(weekday),
        inCurrentMonth: date.month === view.month && date.year === view.year,
      });
    }
    weeks.push(week);
  }

  return {
    year: view.year,
    month: view.month,
    key: `${view.year}-${String(view.month).padStart(2, "0")}`,
    start: firstOfMonth,
    weeks,
    weekdays: weekdayHeader(weekStartsOn),
  };
}

/**
 * The `months` consecutive month-grids starting at the one `view` falls in —
 * what a multi-month calendar pages as a unit. `months: 1` is the single-month
 * calendar, so this is the only builder the view layer needs.
 */
export function buildCalendarPeriods(
  view: Temporal.PlainDate,
  { months = 1, ...options }: BuildCalendarPeriodsOptions = {},
): CalendarMonth[] {
  const start = view.with({ day: 1 });
  return Array.from({ length: Math.max(1, months) }, (_, i) =>
    buildCalendarMonth(start.add({ months: i }), options),
  );
}

/**
 * Signed whole months from `from`'s month to `to`'s month — the day is ignored,
 * so it answers "how many pages away is this date" rather than "how long until".
 */
export function monthsBetween(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}
