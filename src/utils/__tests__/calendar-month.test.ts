import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  WEEKDAY_KEYS,
  buildCalendarMonth,
  buildCalendarPeriods,
  monthsBetween,
  weekdayHeader,
  weekdayOf,
} from "../calendar-month";

const dec2026 = Temporal.PlainDate.from("2026-12-11");

describe("buildCalendarMonth", () => {
  it("always yields a 6×7 grid", () => {
    const { weeks } = buildCalendarMonth(dec2026);
    expect(weeks).toHaveLength(6);
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("pads the leading days from the previous month (Sunday start)", () => {
    // Dec 1 2026 is a Tuesday, so a Sunday-started grid backfills Nov 29–30.
    const { weeks } = buildCalendarMonth(dec2026);
    const first = weeks[0][0];
    expect(first.date.toString()).toBe("2026-11-29");
    expect(first.weekday).toBe("sun");
    expect(first.inCurrentMonth).toBe(false);

    const dec1 = weeks[0][2];
    expect(dec1.date.toString()).toBe("2026-12-01");
    expect(dec1.weekday).toBe("tue");
    expect(dec1.inCurrentMonth).toBe(true);
  });

  it("honours a Monday week start", () => {
    const { weeks } = buildCalendarMonth(dec2026, { weekStartsOn: "mon" });
    expect(weeks[0][0].date.toString()).toBe("2026-11-30");
    expect(weeks[0][0].weekday).toBe("mon");
  });

  it("flags weekends (Sat + Sun) regardless of week start", () => {
    const { weeks } = buildCalendarMonth(dec2026);
    for (const cell of weeks.flat()) {
      const weekend = cell.weekday === "sat" || cell.weekday === "sun";
      expect(cell.isWeekend).toBe(weekend);
    }
  });

  it("assigns a stable, unique ISO key per cell", () => {
    const cells = buildCalendarMonth(dec2026).weeks.flat();
    const keys = new Set(cells.map((c) => c.key));
    expect(keys.size).toBe(42);
    expect(cells[0].key).toBe(cells[0].date.toString());
  });
});

describe("buildCalendarPeriods", () => {
  it("yields a single month by default", () => {
    const periods = buildCalendarPeriods(dec2026);
    expect(periods).toHaveLength(1);
    expect(periods[0].year).toBe(2026);
    expect(periods[0].month).toBe(12);
  });

  it("yields consecutive months starting at the view", () => {
    const jul2026 = Temporal.PlainDate.from("2026-07-15");
    const periods = buildCalendarPeriods(jul2026, { months: 3 });
    expect(periods.map((p) => p.month)).toEqual([7, 8, 9]);
    expect(periods.every((p) => p.year === 2026)).toBe(true);
  });

  it("rolls the year over mid-range", () => {
    const nov2026 = Temporal.PlainDate.from("2026-11-01");
    const periods = buildCalendarPeriods(nov2026, { months: 3 });
    expect(periods.map((p) => `${p.year}-${p.month}`)).toEqual([
      "2026-11",
      "2026-12",
      "2027-1",
    ]);
  });

  it("builds each month as its own 6×7 grid", () => {
    const periods = buildCalendarPeriods(dec2026, { months: 2 });
    for (const period of periods) {
      expect(period.weeks).toHaveLength(6);
      expect(period.weeks.flat()).toHaveLength(42);
    }
    // Each period is anchored on its OWN month, not the view's.
    expect(periods[1].weeks.flat().some((c) => c.inCurrentMonth)).toBe(true);
    expect(
      periods[1].weeks.flat().filter((c) => c.inCurrentMonth)[0].date.toString(),
    ).toBe("2027-01-01");
  });

  it("gives every period a stable, unique key", () => {
    const periods = buildCalendarPeriods(dec2026, { months: 3 });
    expect(periods.map((p) => p.key)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("threads the week start through to every period", () => {
    const periods = buildCalendarPeriods(dec2026, {
      months: 2,
      weekStartsOn: "mon",
    });
    for (const period of periods) {
      expect(period.weekdays[0].key).toBe("mon");
      expect(period.weeks[0][0].weekday).toBe("mon");
    }
  });

  it("treats a months count below 1 as 1", () => {
    expect(buildCalendarPeriods(dec2026, { months: 0 })).toHaveLength(1);
  });
});

describe("monthsBetween", () => {
  it("counts whole months, ignoring the day", () => {
    const from = Temporal.PlainDate.from("2026-07-31");
    expect(monthsBetween(from, Temporal.PlainDate.from("2026-09-01"))).toBe(2);
    expect(monthsBetween(from, Temporal.PlainDate.from("2026-07-01"))).toBe(0);
  });

  it("is signed — a date before the anchor is negative", () => {
    const from = Temporal.PlainDate.from("2026-07-15");
    expect(monthsBetween(from, Temporal.PlainDate.from("2026-06-30"))).toBe(-1);
  });

  it("crosses year boundaries", () => {
    const from = Temporal.PlainDate.from("2026-11-01");
    expect(monthsBetween(from, Temporal.PlainDate.from("2027-01-20"))).toBe(2);
    expect(monthsBetween(from, Temporal.PlainDate.from("2025-11-01"))).toBe(-12);
  });
});

describe("weekdayHeader", () => {
  it("rotates the header to the configured week start", () => {
    expect(weekdayHeader("sun").map((w) => w.key)).toEqual(WEEKDAY_KEYS);
    expect(weekdayHeader("mon").map((w) => w.key)).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ]);
  });

  it("marks weekend columns in the header", () => {
    const header = weekdayHeader("sun");
    expect(header[0].isWeekend).toBe(true); // sun
    expect(header[6].isWeekend).toBe(true); // sat
    expect(header[1].isWeekend).toBe(false); // mon
  });
});

// ISO runs Mon=1…Sun=7; our keys run Sunday-first. The `% 7` rotation between
// them is the whole function, so the boundary (Sunday) is the case that matters.
describe("weekdayOf", () => {
  it("maps every day of a known week to its Sunday-first key", () => {
    // 2026-12-06 is a Sunday.
    const sunday = Temporal.PlainDate.from("2026-12-06");
    const week = Array.from({ length: 7 }, (_, i) =>
      weekdayOf(sunday.add({ days: i })),
    );
    expect(week).toEqual(WEEKDAY_KEYS);
  });

  it("wraps ISO's Sunday=7 back round to index 0", () => {
    const sunday = Temporal.PlainDate.from("2026-12-06");
    expect(sunday.dayOfWeek).toBe(7);
    expect(weekdayOf(sunday)).toBe("sun");
  });

  it("agrees with the grid cells built from the same date", () => {
    const cells = buildCalendarMonth(dec2026).weeks.flat();
    for (const cell of cells) expect(cell.weekday).toBe(weekdayOf(cell.date));
  });
});
