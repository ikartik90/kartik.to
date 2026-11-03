import { describe, expect, it } from "vitest";
import { CUSTOMER, DAY, daysFrom, submitted } from "../data";
import { addDays, weekOf } from "../shifts";
import {
  TIMESHEET_WORKERS,
  billable,
  closed,
  confirm,
  dayTitle,
  dayTotal,
  findWorkers,
  hoursLabel,
  merge,
  openWeek,
  shiftStatus,
  stamp,
  summarize,
  summaryText,
  timeLines,
  timecards,
  totalLabel,
  unconfirm,
  type Timecard,
} from "../timesheet";

// A Wednesday, the afternoon shift an hour in, as the Check-ins page sees it.
const TODAY = "2026-10-14";
const ANCHOR = 15 * 60;
const NOW = 16 * 60;
const DAYS = daysFrom(ANCHOR, NOW);
const WEEK = weekOf(TODAY);

const cardsOf = (worker: string, cards: Timecard[]) => cards.filter((c) => c.worker === worker);
const on = (worker: string, date: string, cards = timecards(TODAY, DAYS, WEEK, {})) =>
  cards.find((c) => c.worker === worker && c.date === date)!;

describe("the timesheet's timecards", () => {
  it("are the Check-ins page's workers'", () => {
    expect(TIMESHEET_WORKERS).toEqual([
      "maria", "aspen", "angel", "rayna", "alejandro",
      "brittany", "gamander", "disha", "jeff", "sikander",
    ]); // prettier-ignore
  });

  it("take yesterday's and today's from the Check-ins page", () => {
    const yesterday = addDays(TODAY, -1);
    expect(on("aspen", yesterday).absent).toBe(true);
    // 3:00 PM to 12:03 AM, less a half-hour break.
    expect(on("maria", yesterday).checked).toEqual({ start: 15 * 60, end: DAY + 3, unpaidBreak: 30 });
    expect(billable(on("maria", yesterday))).toBe(8 * 60 + 33);

    expect(on("maria", TODAY)).toMatchObject({ state: "done", absent: true });
    expect(on("aspen", TODAY).state).toBe("inProgress");
    expect(on("disha", TODAY)).toMatchObject({ state: "done", selected: "checked" });
    expect(on("maria", addDays(TODAY, 1)).state).toBe("upcoming");
  });

  it("hold the hours a worker sent in beside their late check-in, waiting for the customer's approval", () => {
    const card = on("rayna", addDays(TODAY, -1));
    expect(card.checked?.start).toBe(15 * 60 + 13);
    expect(card).toMatchObject({ submitted: card.posted, review: "pending", selected: "checked", confirmed: false });
    expect(card.notes.at(-1)).toMatchObject({ action: "Submitted", by: "Rayna Rhiel Madsen" });
  });

  it("follow a check-in made on the Check-ins page", () => {
    const shift = DAYS.today[0];
    const maria = shift.workers.find((w) => w.id === "maria")!;
    const checkedIn = submitted(maria, shift, { checkIn: 15 * 60, note: "", excused: false, absent: false }, CUSTOMER, NOW);
    const days = { ...DAYS, today: [{ ...shift, workers: shift.workers.map((w) => (w.id === "maria" ? checkedIn : w)) }, ...DAYS.today.slice(1)] };
    expect(on("maria", TODAY, timecards(TODAY, days, WEEK, {})).state).toBe("inProgress");
  });

  // Only a floor manager may check a worker in early.
  it("have no worker check themselves in before their shift starts", () => {
    const weeks = [-21, -14, -7, 0].flatMap((days) => weekOf(addDays(TODAY, days)));
    for (const card of timecards(TODAY, DAYS, weeks, {}).filter((c) => c.checked && !c.notes.some((n) => n.action === "Checked in")))
      expect(card.checked!.start).toBeGreaterThanOrEqual(card.posted.start);
  });

  it("give everyone five shifts in a week away from today, none of them still to confirm", () => {
    const week = weekOf(addDays(TODAY, -14));
    const cards = timecards(TODAY, DAYS, week, {});
    for (const worker of TIMESHEET_WORKERS) expect(cardsOf(worker, cards)).toHaveLength(5);
    expect(cards.every((c) => c.state === "done" && (c.absent || c.confirmed))).toBe(true);
  });

  it("are still to confirm this week, but for the rows confirmed already", () => {
    const cards = timecards(TODAY, DAYS, WEEK, {});
    expect(summarize(cardsOf("rayna", cards)).status).toBe("pending");
    expect(summarize(cardsOf("disha", cards)).status).toBe("confirmed");
    expect(cardsOf("aspen", cards).some((c) => c.state === "upcoming")).toBe(true);
  });
});

describe("the week the Timesheet opens on", () => {
  // A Monday: customers confirm a week's hours on the Tuesday after it.
  const MONDAY = "2026-10-26";
  const LAST_WEEK = weekOf("2026-10-18");

  it("is last week from Sunday to Tuesday, and this week after", () => {
    for (const today of ["2026-10-25", MONDAY, "2026-10-27"]) expect(openWeek(today)).toEqual(LAST_WEEK);
    for (const today of ["2026-10-28", "2026-10-31"]) expect(openWeek(today)).toEqual(weekOf(today));
  });

  it("closes at 5 PM on the Tuesday after it, the weeks before it closed already", () => {
    expect(closed(LAST_WEEK, new Date(2026, 9, 26, 9, 0))).toBe(false);
    expect(closed(LAST_WEEK, new Date(2026, 9, 27, 16, 59))).toBe(false);
    expect(closed(LAST_WEEK, new Date(2026, 9, 27, 17, 0))).toBe(true);
    expect(closed(LAST_WEEK, new Date(2026, 9, 28, 9, 0))).toBe(true);
    expect(closed(weekOf("2026-10-11"), new Date(2026, 9, 26, 9, 0))).toBe(true);
    expect(closed(weekOf(MONDAY), new Date(2026, 9, 31, 23, 59))).toBe(false);
  });

  it("is still to confirm on a Monday, but for the rows confirmed already, the weeks before it confirmed", () => {
    const cards = timecards(MONDAY, DAYS, LAST_WEEK, {});
    expect(cards.every((c) => c.state === "done")).toBe(true);
    expect(cards.filter((c) => !c.confirmed).length).toBeGreaterThan(cards.length / 2);
    expect(summarize(cardsOf("disha", cards)).status).toBe("confirmed");
    expect(timecards(MONDAY, DAYS, weekOf("2026-10-11"), {}).every((c) => c.absent || c.confirmed)).toBe(true);
  });

  it("holds the hours Rayna sent in beside her late check-in on her last shift in it, waiting for approval", () => {
    const cards = timecards(MONDAY, DAYS, LAST_WEEK, {});
    const [card, ...others] = cards.filter((c) => c.review === "pending");
    expect(others).toEqual([]);
    expect(card).toMatchObject({ worker: "rayna", date: cardsOf("rayna", cards).at(-1)!.date, submitted: card.posted });
    expect(card.checked!.start).toBeGreaterThan(card.posted.start);
    expect(timecards(MONDAY, DAYS, weekOf(MONDAY), {}).some((c) => c.review === "pending")).toBe(false);
  });
});

describe("a timecard's status", () => {
  it("is the one its chip shows", () => {
    const yesterday = addDays(TODAY, -1);
    expect(shiftStatus(on("maria", addDays(TODAY, 1)))).toBe("upcoming");
    expect(shiftStatus(on("aspen", TODAY))).toBe("inProgress");
    expect(shiftStatus(on("aspen", yesterday))).toBe("absent");
    expect(shiftStatus(on("maria", yesterday))).toBe("checked");
    expect(shiftStatus(on("rayna", yesterday))).toBe("submitted");
    expect(shiftStatus(on("disha", TODAY))).toBe("confirmed");
  });
});

describe("a row's total", () => {
  const hours = (start: number, end: number) => ({ start, end, unpaidBreak: 30 });
  const card = (patch: Partial<Timecard>): Timecard => ({
    id: Math.random().toString(),
    worker: "rayna",
    date: TODAY,
    shift: "afternoon",
    position: "Picker Packer",
    shiftName: "Weekdays Afternoon Shift",
    posted: hours(900, 1440),
    absent: false,
    state: "done",
    selected: "checked",
    confirmed: false,
    notes: [],
    checked: hours(900, 1425),
    ...patch,
  });

  it("adds up the hours to confirm, and counts the shifts, adjustments and absences", () => {
    const row = [
      card({ selected: "submitted", submitted: hours(900, 1410) }),
      card({}),
      card({ absent: true, selected: null }),
      card({ state: "inProgress", selected: null }),
      card({ state: "upcoming", selected: null }),
    ];
    const total = summarize(row);
    expect(total).toMatchObject({ shifts: 3, adjusted: 1, absent: 1, status: "pending" });
    expect(total.pending).toBe(480 + 495);
    expect(summaryText(total)).toBe("3 Shifts • 1 Adjusted • 1 Absent");
    expect(summaryText({ ...total, shifts: 1, adjusted: 0, absent: 0 })).toBe("1 Shift");
  });

  it("adds up a day's hours as its chips show them: a review's the worker's own, none for a shift absent, under way or to come", () => {
    const day = [
      card({ review: "pending", submitted: hours(900, 1410) }),
      card({}),
      card({ confirmed: true }),
      card({ absent: true, selected: null }),
      card({ state: "inProgress", selected: null }),
      card({ state: "upcoming", selected: null }),
    ];
    expect(dayTotal(day)).toBe(480 + 495 + 495);
    expect(dayTotal([])).toBe(0);
  });

  it("confirms every finished shift, and undoes it", () => {
    const row = [card({}), card({ absent: true, selected: null }), card({ state: "upcoming", selected: null })];
    const edits = confirm(row, {});
    const apply = (cards: Timecard[], e: typeof edits) => cards.map((c) => ({ ...c, ...e[c.id] }));
    expect(summarize(apply(row, edits))).toMatchObject({ status: "confirmed", confirmed: 495 });
    expect(summarize(apply(row, unconfirm(apply(row, edits), edits))).status).toBe("pending");
  });
});

describe("a timecard's edits", () => {
  it("bill adjusted hours once they're picked", () => {
    const card = on("rayna", addDays(TODAY, -1));
    const adjusted = { start: 15 * 60, end: 23 * 60, unpaidBreak: 30 };
    const edited = on("rayna", card.date, timecards(TODAY, DAYS, WEEK, { [card.id]: { adjusted, selected: "adjusted" } }));
    expect(edited.selected).toBe("adjusted");
    expect(billable(edited)).toBe(7 * 60 + 30);
  });

  it("merge per timecard", () => {
    expect(merge({ a: { confirmed: true } }, { a: { selected: "posted" }, b: { absent: true } })).toEqual({
      a: { confirmed: true, selected: "posted" },
      b: { absent: true },
    });
  });
});

describe("the timesheet's words", () => {
  it("writes hours as Figma does", () => {
    expect(hoursLabel(8 * 60 + 15)).toBe("8.25 h");
    expect(totalLabel(24 * 60)).toBe("24 Hours");
    expect(totalLabel(33 * 60 + 15)).toBe("33.25 Hours");
  });

  it("writes times past midnight with the day after under them", () => {
    expect(timeLines({ start: 15 * 60, end: DAY + 15, unpaidBreak: 30 })).toEqual(["3:00 PM", "12:15 AM", "(+1 day)"]);
    expect(timeLines({ start: 9 * 60, end: 17 * 60, unpaidBreak: 30 })).toEqual(["9:00 AM", "5:00 PM", null]);
  });

  it("writes dates and moments", () => {
    expect(dayTitle("2026-10-14")).toBe("Wednesday, October 14, 2026");
    expect(stamp("2025-04-03", DAY + 3)).toBe("Apr 4, 2025, 12:03 AM");
  });
});

describe("finding a worker for an off-app shift", () => {
  it("looks them up by name or phone number", () => {
    expect(findWorkers("tash").map((p) => p.name)).toEqual(["Tashonda Williams"]);
    expect(findWorkers("647555").length).toBeGreaterThan(1);
    expect(findWorkers("")).toEqual([]);
  });

  it("finds someone from the first digit typed, anywhere in their number", () => {
    for (const typed of "0123456789") expect(findWorkers(typed).length, typed).toBeGreaterThan(0);
    expect(findWorkers("64").length).toBeGreaterThan(0);
    expect(findWorkers("(647) 5").length).toBeGreaterThan(0);
  });
});
