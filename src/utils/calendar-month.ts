import { Temporal } from "@js-temporal/polyfill";

// Always six weeks (42 cells), so the calendar never reflows between months.

export type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

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

/** Temporal's `dayOfWeek` is Mon=1…Sun=7; this maps it onto the Sunday-first keys. */
export function weekdayOf(date: Temporal.PlainDate): WeekdayKey {
  return WEEKDAY_KEYS[date.dayOfWeek % 7];
}

export interface CalendarCell {
  date: Temporal.PlainDate;
  key: string;
  day: number;
  weekday: WeekdayKey;
  isWeekend: boolean;
  inCurrentMonth: boolean;
}

export interface WeekdayHeaderCell {
  key: WeekdayKey;
  index: number;
  isWeekend: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  key: string;
  start: Temporal.PlainDate;
  weeks: CalendarCell[][];
  weekdays: WeekdayHeaderCell[];
}

export interface BuildCalendarMonthOptions {
  weekStartsOn?: WeekdayKey;
}

export interface BuildCalendarPeriodsOptions extends BuildCalendarMonthOptions {
  months?: number;
}

export function weekdayHeader(
  weekStartsOn: WeekdayKey = "sun",
): WeekdayHeaderCell[] {
  const start = WEEKDAY_KEYS.indexOf(weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => {
    const key = WEEKDAY_KEYS[(start + index) % 7];
    return { key, index, isWeekend: WEEKEND.has(key) };
  });
}

export function buildCalendarMonth(
  view: Temporal.PlainDate,
  { weekStartsOn = "sun" }: BuildCalendarMonthOptions = {},
): CalendarMonth {
  const startCol = WEEKDAY_KEYS.indexOf(weekStartsOn);
  const firstOfMonth = view.with({ day: 1 });
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

export function buildCalendarPeriods(
  view: Temporal.PlainDate,
  { months = 1, ...options }: BuildCalendarPeriodsOptions = {},
): CalendarMonth[] {
  const start = view.with({ day: 1 });
  return Array.from({ length: Math.max(1, months) }, (_, i) =>
    buildCalendarMonth(start.add({ months: i }), options),
  );
}

/** Ignores the day: "how many pages away", not "how long until". */
export function monthsBetween(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}
