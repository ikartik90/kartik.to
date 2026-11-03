// The Shifts page's model (SW Curie's Shifts dashboard 22112:100370) and the New Shift overlay's date logic. Dates are
// ISO days, `YYYY-MM-DD`; times are minutes after midnight.

import { COMPANY_PLACE, entranceAt } from "./geo";
import type { Geofence, LatLng, Place } from "./geofence";
import { bookedOn, offersOn, type Offers } from "./planner";

export type Iso = string;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Noon UTC, so no offset or clock change moves the day.
const dateOf = (iso: Iso) => new Date(`${iso}T12:00:00Z`);
const isoOfUtc = (date: Date) => date.toISOString().slice(0, 10);

/** The visitor's own day for `date`. */
export function isoOf(date: Date): Iso {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: Iso, days: number): Iso {
  const date = dateOf(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoOfUtc(date);
}

/** 0 is Sunday. */
export const weekdayOf = (iso: Iso) => dateOf(iso).getUTCDay();

/** Sunday to Saturday, as the Shifts page's columns run. */
export function weekOf(iso: Iso): Iso[] {
  const sunday = addDays(iso, -weekdayOf(iso));
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}

const DAY = 24 * 60 * 60 * 1000;

/** `iso`'s week's number in the year its Saturday falls in, week 1 holding 1 January. */
export function weekNumber(iso: Iso) {
  const week = weekOf(iso);
  const first = weekOf(`${week[6].slice(0, 4)}-01-01`)[0];
  return Math.round((dateOf(week[0]).getTime() - dateOf(first).getTime()) / (7 * DAY)) + 1;
}

const short = (iso: Iso) => MONTHS[dateOf(iso).getUTCMonth()].slice(0, 3);
const day = (iso: Iso) => dateOf(iso).getUTCDate();

export const monthName = (iso: Iso) => `${MONTHS[dateOf(iso).getUTCMonth()]} ${dateOf(iso).getUTCFullYear()}`;

/** A week's months, each with how many of its days it heads. */
export function monthSpans(week: Iso[]): { name: string; span: number }[] {
  return week.reduce<{ name: string; span: number }[]>((all, date) => {
    const name = monthName(date);
    if (all.at(-1)?.name === name) all.at(-1)!.span += 1;
    else all.push({ name, span: 1 });
    return all;
  }, []);
}

/** "Nov 30–Dec 6", or "Dec 7–13" within a month. */
export function weekLabel(week: Iso[]): string {
  const [first, last] = [week[0], week[week.length - 1]];
  return short(first) === short(last)
    ? `${short(first)} ${day(first)}–${day(last)}`
    : `${short(first)} ${day(first)}–${short(last)} ${day(last)}`;
}

/** The month holding `iso`: its name, the blank cells before its 1st and its days. */
export function monthOf(iso: Iso) {
  const first = `${iso.slice(0, 8)}01`;
  const date = dateOf(first);
  const length = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    label: monthName(first),
    lead: weekdayOf(first),
    days: Array.from({ length }, (_, i) => addDays(first, i)),
  };
}

export const addMonths = (iso: Iso, months: number): Iso => {
  const date = dateOf(`${iso.slice(0, 8)}01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return isoOfUtc(date);
};

/** "10 November, 2025". */
export const fullDate = (iso: Iso) => `${day(iso)} ${MONTHS[dateOf(iso).getUTCMonth()]}, ${dateOf(iso).getUTCFullYear()}`;

/** "Monday, 10 November, 2025", as Figma's repeat description writes a date. */
export const longDate = (iso: Iso) => `${WEEKDAYS[weekdayOf(iso)]}, ${fullDate(iso)}`;

/** mm/dd/yyyy, the date fields' format. */
export const fieldDate = (iso: Iso) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

// The shifts

export interface Template {
  id: string;
  name: string;
  tags: string[];
  address: string;
  unit: string;
  directions: string;
  wage: string;
  /**
   * Where the address is, for its card's map, the building's geofence on it until the map draws its default, and its
   * entrance until the pin stands on the wall nearest the address.
   */
  place: Place | null;
  geofence: Geofence | null;
  entrance: LatLng | null;
}

// Forklift Operator's card is Figma's (22385:115349); the others' units, wages and directions are mine.
export const TEMPLATES: Template[] = [
  {
    id: "forklift",
    name: "Forklift Operator",
    tags: ["Licensed", "Warehouse", "Reach Truck", "Night Shift"],
    address: "250 First Gulf Boulevard, Brampton, ON",
    unit: "Unit 308",
    directions:
      "Take the 502 Southbound from Brampton Innovation District till Brampton Gateway Terminal, and change to 511 Eastbound until the First Gulf stop",
    wage: "CAD 23.00",
    place: COMPANY_PLACE,
    geofence: null,
    entrance: entranceAt(COMPANY_PLACE),
  },
  {
    id: "general",
    name: "General Labour",
    tags: ["Dockyard", "Warehouse"],
    address: "250 First Gulf Boulevard, Brampton, ON",
    unit: "Pier 37",
    directions: "Please walk in through door C and ask for Akash Saini’s midnight shift supervisor",
    wage: "CAD 16.50",
    place: COMPANY_PLACE,
    geofence: null,
    entrance: entranceAt(COMPANY_PLACE),
  },
  {
    id: "picker",
    name: "Picker Packer",
    tags: ["Assembly Line", "Packing", "Warehouse"],
    address: "250 First Gulf Boulevard, Brampton, ON",
    unit: "Unit 112",
    directions:
      "Take the 502 Southbound from Brampton Innovation District till Brampton Gateway Terminal, and change to 511 Eastbound until the First Gulf stop",
    wage: "CAD 18.00",
    place: COMPANY_PLACE,
    geofence: null,
    entrance: entranceAt(COMPANY_PLACE),
  },
  {
    id: "manager",
    name: "Warehouse Manager",
    tags: ["Warehouse", "Loading", "Inventory"],
    address: "250 First Gulf Boulevard, Brampton, ON",
    unit: "Unit 308",
    directions:
      "Take the 502 Southbound from Brampton Innovation District till Brampton Gateway Terminal, and change to 511 Eastbound until the First Gulf stop",
    wage: "CAD 27.50",
    place: COMPANY_PLACE,
    geofence: null,
    entrance: entranceAt(COMPANY_PLACE),
  },
];

/** What the shift was posted with, which its summary shows; Figma's shifts take the form's defaults. */
interface Terms {
  breakMinutes?: number;
  paidBreak?: boolean;
  reportTo?: string;
  /** Whether SpotFill sends offers for the places still open. */
  spotFill?: boolean;
}

export interface Series extends Terms {
  id: string;
  template: string;
  title: string;
  start: number;
  end: number;
  workers: number;
  /** Every day it runs, in order. */
  dates: Iso[];
  /** The places filled on a day; a day without an entry has had nobody booked. */
  filled?: Partial<Record<Iso, number>>;
  /** The booked workers absent on a day, once it's run. */
  absent?: Partial<Record<Iso, number>>;
  /** The minutes those who came fell short of the shift on a day, all told, checking in late or out early. */
  short?: Partial<Record<Iso, number>>;
  /** What the Shift Planner's Send offers and Withdraw offers have changed. */
  offers?: Offers;
}

// Figma's week, filled the same every week, with a worker or two absent. Warehouse Manager's is cut off at the frame's
// foot, so its numbers are mine, as are the absences. Three start later or earlier than Figma's, named for it, so each
// Shift Start Time window holds one.
type Weekly = Partial<Record<number, number>>;
const FIGMA_WEEK: (Omit<Series, "dates" | "filled" | "absent"> & { weekly: Weekly; absent?: Weekly })[] = [
  { id: "morning", template: "forklift", title: "Morning Shift (M/W/F)", start: 540, end: 1020, workers: 3, weekly: { 1: 3, 3: 3, 5: 2 } },
  { id: "holiday", template: "forklift", title: "Overnight Shift", start: 1320, end: 1800, workers: 4, weekly: { 0: 4, 1: 4, 3: 4, 5: 1, 6: 4 }, absent: { 3: 1 } },
  { id: "weekdays", template: "general", title: "Weekdays AM", start: 540, end: 1020, workers: 6, weekly: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 5 }, absent: { 1: 1 } },
  { id: "weekend-picker", template: "picker", title: "Weekend PM", start: 840, end: 1320, workers: 13, weekly: { 0: 13, 6: 9 }, absent: { 0: 1 } },
  { id: "weekend-manager", template: "manager", title: "Weekend AM", start: 300, end: 780, workers: 2, weekly: { 0: 2, 6: 2 } },
];

/** A number from 0 up to 1, the same for `key` on every visit. */
function chance(key: string) {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 2 ** 32;
}

/** The workers who came to `shift` on `date`. */
const cameTo = (shift: Series, date: Iso) => (shift.filled?.[date] ?? 0) - (shift.absent?.[date] ?? 0);

/** What `shift` paid on `date`, in cents: its hours, but the minutes those who came fell `short`, at its template's wage. */
function payOf(shift: Series, date: Iso, short = shift.short?.[date] ?? 0) {
  const wage = Number(TEMPLATES.find(({ id }) => id === shift.template)!.wage.replace(/^CAD /, ""));
  return Math.round(((cameTo(shift, date) * (shift.end - shift.start) - short) / 60) * wage * 100);
}

/**
 * Figma's shifts on each of `days` they run. Before `today`'s week, each day leaves a few of Figma's places open and has
 * a few of those booked absent, more often none. Up to `today`, those who came fell a few minutes short, a minute more
 * wherever their week's pay, or all `days`' pay, counted as each shift ends, would come to whole dollars.
 */
function figmaShifts(days: Iso[], today: Iso): Series[] {
  const shifts = FIGMA_WEEK.map(({ weekly, absent = {}, ...series }) => {
    const dates = days.filter((date) => weekly[weekdayOf(date)] !== undefined);
    const counts = dates.map((date) => {
      const [booked, away] = [weekly[weekdayOf(date)]!, absent[weekdayOf(date)] ?? 0];
      if (date >= weekOf(today)[0]) return [booked, away];
      const filled = booked - Math.floor(chance(`${date} ${series.id} open`) ** 2 * (booked * 0.3 + 1));
      return [filled, Math.floor(chance(`${date} ${series.id} absent`) ** 2 * (filled * 0.2 + 1))];
    });
    const each = (part: 0 | 1) =>
      Object.fromEntries(dates.map((date, i) => [date, counts[i][part]]).filter(([, count]) => count));
    return { ...series, dates, filled: each(0), absent: each(1), short: {} as Partial<Record<Iso, number>> };
  });
  const ends = ({ shift, date }: { shift: Series; date: Iso }) => dateOf(date).getTime() / 60000 + shift.end;
  const runs = shifts.flatMap((shift) => shift.dates.filter((date) => date <= today).map((date) => ({ shift, date })));
  const spent = new Map<Iso, number>();
  let total = 0;
  for (const { shift, date } of runs.sort((a, b) => ends(a) - ends(b))) {
    const sunday = weekOf(date)[0];
    const before = spent.get(sunday) ?? 0;
    const whole = (pay: number) => (before + pay) % 100 === 0 || (total + pay) % 100 === 0;
    let short = Math.round(chance(`${date} ${shift.id} short`) * cameTo(shift, date) * 6);
    while (cameTo(shift, date) && whole(payOf(shift, date, short))) short++;
    spent.set(sunday, before + payOf(shift, date, short));
    total += payOf(shift, date, short);
    if (short) shift.short[date] = short;
  }
  return shifts;
}

/** Figma's shifts, each run from two weeks before `today`'s week to three weeks after it. */
export function seedSeries(today: Iso): Series[] {
  const first = addDays(weekOf(today)[0], -14);
  return figmaShifts(
    Array.from({ length: 6 * 7 }, (_, i) => addDays(first, i)),
    today,
  );
}

/** Whether `shift` on `date` is over by `now`, in minutes into `today`. */
const over = (shift: Series, date: Iso, today: Iso, now: number) =>
  ((dateOf(today).getTime() - dateOf(date).getTime()) / DAY) * 24 * 60 + now >= shift.end;

/**
 * `today`'s week's spots: on the shifts over by `now` (minutes into `today`), the workers checked in and absent; on the
 * rest, the places filled and vacant.
 */
export function weekSpots(series: Series[], today: Iso, now: number) {
  const spots = { checkedIn: 0, absent: 0, filled: 0, vacant: 0 };
  for (const shift of series)
    for (const date of weekOf(today).filter((day) => shift.dates.includes(day))) {
      const booked = bookedOn(shift, date);
      if (over(shift, date, today, now)) {
        const absent = Math.min(shift.absent?.[date] ?? 0, booked);
        spots.checkedIn += booked - absent;
        spots.absent += absent;
      } else {
        spots.filled += booked;
        spots.vacant += shift.workers - booked;
      }
    }
  return spots;
}

/**
 * The spending over `today`'s week and the five before it, by `now`: Figma's shifts' hours worked on those over by then,
 * at each template's wage, in all and by week.
 */
export function recentSpend(today: Iso, now: number) {
  const sundays = Array.from({ length: 6 }, (_, i) => addDays(weekOf(today)[0], (i - 5) * 7));
  const days = sundays.flatMap(weekOf);
  const worked = figmaShifts(days, today).flatMap((shift) =>
    shift.dates
      .filter((date) => over(shift, date, today, now))
      .map((date) => ({ sunday: weekOf(date)[0], cents: payOf(shift, date) })),
  );
  const sum = (parts: typeof worked) => parts.reduce((total, part) => total + part.cents, 0) / 100;
  return {
    first: days[0],
    last: days.at(-1)!,
    weeks: sundays.map((sunday) => ({ week: weekNumber(sunday), amount: sum(worked.filter((part) => part.sunday === sunday)) })),
    total: sum(worked),
  };
}

export function entryOn(series: Series, iso: Iso): { filled: number; total: number } | null {
  return series.dates.includes(iso) ? { filled: bookedOn(series, iso), total: series.workers } : null;
}

/** Figma's progress bar colours: full, at least three quarters, at least half, less. */
export function fillTone(filled: number, total: number): "full" | "high" | "mid" | "low" {
  const share = filled / total;
  return share >= 1 ? "full" : share >= 0.75 ? "high" : share >= 0.5 ? "mid" : "low";
}

const clockParts = (minutes: number) => {
  const hours = Math.floor(minutes / 60) % 24;
  return {
    hours: String(hours % 12 || 12).padStart(2, "0"),
    minutes: String(minutes % 60).padStart(2, "0"),
    half: hours < 12 ? "AM" : "PM",
  };
};

/** "09:00AM–05:00 PM", spaced as Figma's cells are. */
export function cellTime(start: number, end: number) {
  const [a, b] = [clockParts(start), clockParts(end)];
  return `${a.hours}:${a.minutes}${a.half}–${b.hours}:${b.minutes} ${b.half}`;
}

/** "9:00 AM". */
export function clockTime(minutes: number) {
  const { hours, minutes: mm, half } = clockParts(minutes);
  return `${Number(hours)}:${mm} ${half}`;
}

/** Where `fillTone`'s bands meet, the Fill % filter's stops. */
export const FILL_STEPS = [0, 50, 75, 100];

/** The six-hour windows a shift can start in, by the minute each opens. */
export const START_WINDOWS = [0, 6 * 60, 12 * 60, 18 * 60];

const windowOf = (start: number) => Math.floor((start % (24 * 60)) / (6 * 60)) * 6 * 60;

/** "12:00 AM–6:00 AM". */
export const windowLabel = (opens: number) => `${clockTime(opens)}–${clockTime(opens + 6 * 60)}`;

/** The Shifts page's search, its Fill % range, the windows its shifts start in and its templates' tags; none is all. */
export interface ShiftsFilter {
  search: string;
  fill: [number, number];
  starts: number[];
  tags: string[];
}

export const NO_FILTER: ShiftsFilter = { search: "", fill: [0, 100], starts: [], tags: [] };

/**
 * A shift's places on a day, if it runs then and its progress bar's band lies in `fill`: a range of `FILL_STEPS` holds
 * the bands between its ends, and 100 the full one.
 */
export function entryIn(series: Series, iso: Iso, [low, high]: [number, number]) {
  const entry = entryOn(series, iso);
  if (!entry) return null;
  const share = (entry.filled / entry.total) * 100;
  return share >= low && (share < high || (share === 100 && high === 100)) ? entry : null;
}

/**
 * The templates the Shifts page lists for `week`, each with its shifts that have a day in the filter's range and start
 * in one of its windows. A template without such a shift goes once either narrows them.
 */
export function shiftRows(templates: Template[], series: Series[], week: Iso[], filter: ShiftsFilter) {
  const typed = filter.search.trim().toLowerCase();
  const narrowed = filter.fill[0] > 0 || filter.fill[1] < 100 || filter.starts.length > 0;
  return templates
    .filter(({ tags }) => !filter.tags.length || tags.some((tag) => filter.tags.includes(tag)))
    .map((template) => ({
      template,
      lines: series.filter(
        (s) =>
          s.template === template.id &&
          (!filter.starts.length || filter.starts.includes(windowOf(s.start))) &&
          week.some((date) => entryIn(s, date, filter.fill)),
      ),
    }))
    .filter(
      ({ template, lines }) =>
        (!narrowed || lines.length > 0) &&
        (!typed ||
          template.name.toLowerCase().includes(typed) ||
          lines.some((line) => line.title.toLowerCase().includes(typed))),
    );
}

export interface Posting extends Terms {
  template: string;
  title: string;
  dates: Iso[];
  start: number;
  end: number;
  workers: number;
}

export function post(series: Series[], posting: Posting): Series[] {
  return [...series, { ...posting, id: `posted-${series.length}`, dates: [...posting.dates].sort() }];
}

/** Edit Schedule's save: the shift now runs on `dates`, a day added unfilled. */
export function reschedule(series: Series[], id: string, dates: Iso[], spotFill: boolean): Series[] {
  return series.map((s) =>
    s.id !== id
      ? s
      : {
          ...s,
          dates: [...dates].sort(),
          filled: Object.fromEntries(Object.entries(s.filled ?? {}).filter(([date]) => dates.includes(date))),
          offers: offersOn(s, dates),
          spotFill,
        },
  );
}

export type Tone = "regular" | "cancelled" | "added";

/** What an edit from `base` to `next` does to a day. */
export function dayTone(base: Iso[], next: Iso[], iso: Iso): Tone | undefined {
  const [was, is] = [base.includes(iso), next.includes(iso)];
  return was ? (is ? "regular" : "cancelled") : is ? "added" : undefined;
}

/** Edit Schedule's tally of the shifts ahead. A day's times can't be edited here, so none are. */
export function scheduleCounts(base: Iso[], next: Iso[], today: Iso) {
  const ahead = (dates: Iso[]) => dates.filter((date) => date >= today);
  return {
    regular: ahead(base).filter((date) => next.includes(date)).length,
    edited: 0,
    added: ahead(next).filter((date) => !base.includes(date)).length,
    cancelled: ahead(base).filter((date) => !next.includes(date)).length,
  };
}

/** Figma's snackbar. */
export const postedMessage = (count: number) => `${count} ${count === 1 ? "shift" : "shifts"} posted`;

// Picking dates

/** Each of `dates` flips in or out of `selected`. */
export function toggle(selected: Iso[], dates: Iso[]): Iso[] {
  const next = new Set(selected);
  for (const date of dates) if (!next.delete(date)) next.add(date);
  return [...next].sort();
}

export interface History<T = Iso[]> {
  past: T[];
  present: T;
  future: T[];
}

export const historyOf = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export const record = <T>(history: History<T>, next: T): History<T> => ({
  past: [...history.past, history.present],
  present: next,
  future: [],
});

export const undo = <T>(history: History<T>): History<T> =>
  history.past.length
    ? { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] }
    : history;

export const redo = <T>(history: History<T>): History<T> =>
  history.future.length
    ? { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) }
    : history;

// The recurrence concept

export interface Repeat {
  first: Iso;
  /** 0 is Sunday. */
  weekdays: number[];
  until: Iso | null;
}

/** The first shift, then each picked weekday after it, up to and including `until`. */
export function repeatDates({ first, weekdays, until }: Repeat): Iso[] {
  const dates = [first];
  if (!until || !weekdays.length) return dates;
  for (let date = addDays(first, 1); date <= until; date = addDays(date, 1))
    if (weekdays.includes(weekdayOf(date))) dates.push(date);
  return dates;
}

/** Picked dates as a repeat: the first, then each of their weekdays until the last. */
export function repeatOf(dates: Iso[]): Repeat | null {
  const sorted = [...dates].sort();
  if (!sorted.length) return null;
  if (sorted.length === 1) return { first: sorted[0], weekdays: [], until: null };
  const weekdays = [...new Set(sorted.map(weekdayOf))].sort();
  return { first: sorted[0], weekdays, until: sorted.at(-1)! };
}

/** Figma's repeat description, its days and dates marked `strong`. */
export function repeatSummary({ first, weekdays, until }: Repeat): { text: string; strong?: boolean }[] {
  const names = [...weekdays].sort().map((weekday) => WEEKDAYS[weekday]);
  const days =
    names.length > 2
      ? [{ text: `${names.slice(0, -1).join(", ")},`, strong: true }, { text: " and " }, { text: names.at(-1)!, strong: true }]
      : names.length === 2
        ? [{ text: names[0], strong: true }, { text: " and " }, { text: names[1], strong: true }]
        : [{ text: names[0] ?? "", strong: true }];
  return [
    { text: "This shift will repeat every " },
    ...days,
    { text: " between " },
    { text: longDate(first), strong: true },
    { text: " and " },
    { text: until ? longDate(until) : "", strong: true },
  ];
}
