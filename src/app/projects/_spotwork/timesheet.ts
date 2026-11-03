import { CUSTOMER, DAY, PEOPLE, clock, profile, type Day, type Person, type Shift, type Worker } from "./data";
import { TASHONDA } from "./dashboard";
import { MONTHS, WEEKDAYS, addDays, weekOf, weekdayOf, type Iso } from "./shifts";
import miguelFernandoMarquez from "./assets/faces/miguel-fernando-marquez.jpg";
import shreyaseePangaonkar from "./assets/faces/shreyasee-pangaonkar.jpg";

// The Timesheet's model (SW Curie 21543:52696; the timecard 20796:19496 and its cards 3703:6753): a timecard for each
// shift of the Check-ins page's workers. Yesterday's, today's and tomorrow's are that page's, as they stand; the other
// days are mine, worked out from each worker and day so they hold still. Figma's "Spotter" is "worker" here.

export type Source = "checked" | "submitted" | "adjusted" | "posted";

export const SOURCES: Record<Source, { letter: string; label: string }> = {
  checked: { letter: "C", label: "Checked In/Out" },
  submitted: { letter: "S", label: "Worker Submitted" },
  adjusted: { letter: "A", label: "Adjusted Hours" },
  posted: { letter: "P", label: "Posted Hours" },
};

/** Minutes after the timecard's day's midnight; past 24 × 60 is the next day. */
export interface Hours {
  start: number;
  end: number;
  unpaidBreak: number;
}

/** A line of a timecard's Notes & History. */
export interface Note {
  text?: string;
  action: string;
  by: string;
  at: string;
}

export interface Timecard {
  id: string;
  worker: string;
  date: Iso;
  shift: string;
  position: string;
  shiftName: string;
  posted: Hours;
  checked?: Hours;
  submitted?: Hours;
  /**
   * The customer's answer to `submitted` hours sent in beside a check-in: still to give, given (approved, or adjusted
   * from), or rejected, which takes them off the timecard.
   */
  review?: "pending" | "reviewed" | "rejected";
  adjusted?: Hours;
  absent: boolean;
  /** Done once the worker has left or been marked absent; under way while checked in. */
  state: "done" | "inProgress" | "upcoming";
  /** Which hours are billed; none while absent or not done. */
  selected: Source | null;
  confirmed: boolean;
  notes: Note[];
}

export type Edit = Partial<Pick<Timecard, "selected" | "adjusted" | "review" | "absent" | "confirmed" | "notes">>;
export type Edits = Record<string, Edit>;

export const SYSTEM = "Spotwork System";
const PHONE_NOTE = "Worker was on site, but could not check-in as their mobile device ran out of charge.";
const NO_TIMES = "Check-in: --:-- / Check-out: --:--";

// Who, checked in late on their last shift in the week the Timesheet opens on, sent in that shift's own hours, and why
// (SW Curie 3892:7116).
const SUBMITTED: Record<string, string> = {
  rayna: "Couldn't find the floor manager in time to get the check-in code.",
};

// Two days off a week, as days from today modulo 7; never yesterday, today or tomorrow, which the Check-ins page shows.
const OFF: Record<string, number[]> = {
  maria: [3, 4],
  aspen: [2, 5],
  angel: [4, 5],
  rayna: [2, 3],
  alejandro: [3, 5],
  brittany: [2, 4],
  gamander: [4, 5],
  disha: [2, 3],
  jeff: [3, 4],
  sikander: [2, 5],
};

// The rows the customer has confirmed this week already.
const CONFIRMED = new Set(["disha", "sikander"]);

export const TIMESHEET_WORKERS = Object.keys(OFF);

const mod = (n: number, m: number) => ((n % m) + m) % m;

const daysBetween = (from: Iso, to: Iso) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / (DAY * 60 * 1000));

/** The week the Timesheet opens on: last week until Wednesday, as customers confirm a week's hours on the Tuesday after. */
export const openWeek = (today: Iso) => weekOf(weekdayOf(today) <= 2 ? addDays(today, -7) : today);

/** Whether `week`'s hours are past confirming at `now`: they close at 5 PM on the Tuesday after it. */
export function closed(week: Iso[], now: Date) {
  const [year, month, day] = addDays(week[0], 9).split("-").map(Number);
  return now >= new Date(year, month - 1, day, 17);
}

/** 0–1, the same for the same text. */
function hash(text: string) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

const hours = (start: number, end: number, unpaidBreak = 30): Hours => ({ start, end, unpaidBreak });

/** "Apr 4, 2025, 12:03 AM": `minutes` after `date`'s midnight, which may run into the next day. */
export function stamp(date: Iso, minutes: number) {
  const day = addDays(date, Math.floor(minutes / DAY));
  const month = MONTHS[Number(day.slice(5, 7)) - 1].slice(0, 3);
  return `${month} ${Number(day.slice(8))}, ${day.slice(0, 4)}, ${clock(minutes)}`;
}

/** "Wednesday, April 3, 2025". */
export function dayTitle(date: Iso) {
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  return `${weekday}, ${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8))}, ${date.slice(0, 4)}`;
}

/** The start, the end, and "(+1 day)" under it when it runs past midnight. */
export function timeLines({ start, end }: Hours): [string, string, string | null] {
  return [clock(start), clock(end), Math.floor(end / DAY) > Math.floor(start / DAY) ? "(+1 day)" : null];
}

/** "3:00 PM–12:00 AM (+1 day)", on one line. */
export const timeRange = (h: Hours) => {
  const [start, end, next] = timeLines(h);
  return `${start}–${end}${next ? ` ${next}` : ""}`;
};

/** The minutes billed for `h`. */
export const worked = (h: Hours) => h.end - h.start - h.unpaidBreak;

export const billable = (card: Timecard) => (card.absent || !card.selected ? 0 : worked(card[card.selected]!));

export const hoursOf = (minutes: number) => (minutes / 60).toFixed(2);

export const hoursLabel = (minutes: number) => `${hoursOf(minutes)} h`;

/** The minutes a timecard's chip shows: none to come, under way or absent; under review, the worker's own. */
export const shownHours = (card: Timecard) =>
  card.state !== "done" || card.absent
    ? 0
    : !card.confirmed && card.review === "pending"
      ? worked(card.submitted!)
      : billable(card);

/** A day's minutes across the timecards in it, as their chips show them. */
export const dayTotal = (cards: Timecard[]) => cards.reduce((total, card) => total + shownHours(card), 0);

export const totalLabel = (minutes: number) =>
  `${minutes % 60 ? (minutes / 60).toFixed(2) : minutes / 60} Hours`;

// The hours a finished shift came to, as the timesheet found them.
function authored(worker: string, offset: number, posted: Hours, date: Iso): Partial<Timecard> {
  const [r, a, b] = [0, 1, 2].map((i) => hash(`${worker}:${offset}:${i}`));
  if (r < 0.03)
    return { absent: true, notes: [{ text: NO_TIMES, action: "Defaulted to absent", by: SYSTEM, at: stamp(date, posted.end) }] };
  if (r < 0.11) {
    const submitted = hours(posted.start, posted.end + 15 * Math.round(a * 2 - 1));
    const name = PEOPLE[worker].name;
    return { submitted, notes: [{ action: "Submitted", by: name, at: stamp(date, submitted.end + 40) }] };
  }
  if (r < 0.22)
    return {
      adjusted: hours(posted.start, posted.end),
      notes: [
        { text: NO_TIMES, action: "Defaulted to absent", by: SYSTEM, at: stamp(date, posted.end) },
        { text: PHONE_NOTE, action: "Adjusted", by: CUSTOMER, at: stamp(date, posted.end + 3) },
      ],
    };
  return { checked: hours(posted.start + Math.max(0, Math.round(a * 15) - 7), posted.end + Math.round(b * 21) - 3) };
}

// Today's, yesterday's or tomorrow's, as the Check-ins page has it.
function live(w: Worker, date: Iso, at: (minutes: number) => number): Partial<Timecard> {
  const notes: Note[] =
    w.by && !w.untracked
      ? [{ text: w.note || undefined, action: w.status === "absent" ? "Marked absent" : "Checked in", by: w.by, at: stamp(date, at(w.at!)) }]
      : [];
  if (w.status === "upcoming") return { state: "upcoming" };
  if (w.status === "absent") return { absent: true, notes };
  if (w.checkOut === undefined) return { state: "inProgress", notes };
  return { checked: hours(at(w.checkIn!), at(w.checkOut), w.unpaidBreak ?? 30), notes };
}

/** Every timecard dated within `dates`, a worker's in time order, with `edits` applied. */
export function timecards(today: Iso, days: Record<Day, Shift[]>, dates: Iso[], edits: Edits): Timecard[] {
  const week = openWeek(today);
  const [from, to] = [daysBetween(today, dates[0]) - 1, daysBetween(today, dates.at(-1)!) + 1];
  const shifts = new Map(days.today.flatMap((shift) => shift.workers.map((w) => [w.id, shift] as const)));
  const cards: Timecard[] = [];

  for (const worker of TIMESHEET_WORKERS) {
    const own = shifts.get(worker)!;
    const dated: { offset: number; day: Day | null; shift: Shift; shiftDays: number; date: Iso }[] = [];
    for (let offset = from; offset <= to; offset++) {
      const day: Day | null = offset === -1 ? "yesterday" : offset === 0 ? "today" : offset === 1 ? "tomorrow" : null;
      if (!day && OFF[worker].includes(mod(offset, 7))) continue;
      const shift = day ? days[day].find((s) => s.id === own.id)! : { ...own, start: own.start + offset * DAY, end: own.end + offset * DAY };
      // A shift is dated by the day it starts on.
      const shiftDays = Math.floor(shift.start / DAY);
      const date = addDays(today, shiftDays);
      if (dates.includes(date)) dated.push({ offset, day, shift, shiftDays, date });
    }
    const sentIn = SUBMITTED[worker] && dated.filter(({ date }) => date < today && week.includes(date)).at(-1)?.date;
    for (const { offset, day, shift, shiftDays, date } of dated) {
      const at = (minutes: number) => minutes - shiftDays * DAY;
      const posted = hours(at(shift.start), at(shift.end));
      const id = `${worker}:${date}:${shift.id}`;
      const found: Partial<Timecard> = day
        ? live(shift.workers.find((w) => w.id === worker)!, date, at)
        : offset > 0
          ? { state: "upcoming" as const }
          : date === sentIn
            ? { checked: hours(posted.start + 25, posted.end) }
            : authored(worker, offset, posted, date);
      if (date === sentIn && found.checked) {
        const note = { text: SUBMITTED[worker], action: "Submitted", by: PEOPLE[worker].name, at: stamp(date, posted.end + 40) };
        Object.assign(found, { submitted: posted, review: "pending", notes: [...(found.notes ?? []), note] });
      }
      const base = { absent: false, state: "done" as const, notes: [], ...found };
      const edit = edits[id] ?? {};
      const card = { ...base, ...edit, notes: [...base.notes, ...(edit.notes ?? [])] };
      const selected =
        edit.selected !== undefined
          ? edit.selected
          : card.state !== "done" || card.absent
            ? null
            : card.adjusted
              ? "adjusted"
              : card.submitted && !card.review
                ? "submitted"
                : "checked";
      const billed = card.state === "done" && !card.absent && selected !== null;
      cards.push({
        id,
        worker,
        date,
        shift: shift.id,
        position: shift.position,
        shiftName: shift.name,
        posted,
        ...card,
        selected,
        confirmed: billed && (edit.confirmed ?? (card.review !== "pending" && (date < week[0] || CONFIRMED.has(worker)))),
      });
    }
  }
  return cards;
}

export interface Summary {
  /** Finished, absences included. */
  shifts: number;
  adjusted: number;
  absent: number;
  /** Minutes still to confirm, and confirmed. */
  pending: number;
  confirmed: number;
  status: "pending" | "confirmed" | "none";
}

const billed = (cards: Timecard[]) => cards.filter((c) => c.state === "done" && !c.absent && c.selected);
const sum = (cards: Timecard[]) => cards.reduce((total, c) => total + billable(c), 0);

/** A row's total: what's left to confirm, or what's confirmed. */
export function summarize(cards: Timecard[]): Summary {
  const done = cards.filter((c) => c.state === "done");
  const worked = billed(cards);
  const pending = worked.filter((c) => !c.confirmed);
  const confirmed = worked.filter((c) => c.confirmed);
  return {
    shifts: done.length,
    adjusted: worked.filter((c) => c.selected === "submitted" || c.selected === "adjusted").length,
    absent: done.filter((c) => c.absent).length,
    pending: sum(pending),
    confirmed: sum(confirmed),
    status: pending.length ? "pending" : confirmed.length ? "confirmed" : "none",
  };
}

/** What a timecard's chip shows it as: to come, under way, absent, confirmed, or the hours it bills. */
export function shiftStatus(card: Timecard): "upcoming" | "inProgress" | "absent" | "confirmed" | Source {
  if (card.state !== "done") return card.state;
  if (card.absent) return "absent";
  if (card.confirmed) return "confirmed";
  return card.review === "pending" ? "submitted" : card.selected!;
}

/** "4 Shifts • 1 Adjusted • 1 Absent". */
export function summaryText({ shifts, adjusted, absent }: Summary) {
  return [
    `${shifts} ${shifts === 1 ? "Shift" : "Shifts"}`,
    adjusted && `${adjusted} Adjusted`,
    absent && `${absent} Absent`,
  ]
    .filter(Boolean)
    .join(" • ");
}

/** `next`'s edits laid over `edits`, timecard by timecard. */
export function merge(edits: Edits, next: Edits): Edits {
  const all = { ...edits };
  for (const [id, edit] of Object.entries(next)) all[id] = { ...all[id], ...edit };
  return all;
}

const each = (cards: Timecard[], edit: Edit): Edits => Object.fromEntries(cards.map((c) => [c.id, edit]));

/** Confirms every finished shift in `cards` that isn't yet. */
export const confirm = (cards: Timecard[], edits: Edits) =>
  merge(edits, each(billed(cards).filter((c) => !c.confirmed), { confirmed: true }));

export const unconfirm = (cards: Timecard[], edits: Edits) =>
  merge(edits, each(billed(cards).filter((c) => c.confirmed), { confirmed: false }));

// Off-app shifts: hours worked for the company outside the app, added by hand.

export interface OffAppShift {
  id: string;
  worker: string;
  template: string;
  date: Iso;
  hours: Hours;
  note: string;
}

const MIGUEL: Person = {
  id: "miguel",
  name: "Miguel Fernando Marquez",
  face: miguelFernandoMarquez,
  profile: profile("Pro", 86, "(647) 555-0170", "Toronto", 27, 214),
};

const SHREYASEE: Person = {
  id: "shreyasee",
  name: "Shreyasee Pangaonkar",
  face: shreyaseePangaonkar,
  profile: profile("Super", 81, "(647) 555-0175", "Brampton", 7, 55),
};

/** Who an off-app shift can be added for. */
export const DIRECTORY: Record<string, Person> = { ...PEOPLE, tashonda: TASHONDA, miguel: MIGUEL, shreyasee: SHREYASEE };

/** Whether `person`'s name or phone number holds `query`. */
export function holds(person: Pick<Person, "name" | "profile">, query: string) {
  const text = query.trim().toLowerCase();
  const digits = text.replace(/\D/g, "");
  return !!text && (person.name.toLowerCase().includes(text) || (!!digits && person.profile.phone.replace(/\D/g, "").includes(digits)));
}

/** Workers whose name or phone number holds `query`. */
export const findWorkers = (query: string): Person[] => Object.values(DIRECTORY).filter((person) => holds(person, query));
