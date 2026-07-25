import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import {
  WEEKDAY_KEYS,
  buildCalendarMonth,
  weekdayHeader,
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
