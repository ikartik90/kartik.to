import { describe, expect, it } from "vitest";
import { DAY, daysFrom, minutesNow, parseClock, shiftHours, shiftStart, shiftsFrom, timeRange } from "../data";

const at = (h: number, m: number) => new Date(2026, 9, 16, h, m);
const worker = (shifts: ReturnType<typeof shiftsFrom>, id: string) =>
  shifts.flatMap((s) => s.workers).find((w) => w.id === id)!;

describe("shiftStart", () => {
  it("is the last :00 or :30 at least half an hour before now", () => {
    expect(shiftStart(at(15, 43))).toBe(15 * 60);
    expect(shiftStart(at(17, 15))).toBe(16 * 60 + 30);
    expect(shiftStart(at(15, 29))).toBe(14 * 60 + 30);
    expect(shiftStart(at(15, 30))).toBe(15 * 60);
  });

  it("falls on the day before just after midnight", () => {
    expect(shiftStart(at(0, 10))).toBe(-30);
  });
});

describe("shiftsFrom", () => {
  const shifts = shiftsFrom(15 * 60, 15 * 60 + 43);

  it("starts the first shift at the anchor and moves the schedule with it", () => {
    expect(shifts).toHaveLength(2);
    expect(shifts[0].start).toBe(15 * 60);
    expect(shifts[0].end).toBe(24 * 60);
    expect(shifts[1].start).toBe(6 * 60);
    expect(shifts[1].end).toBe(14 * 60);
  });

  it("keeps times up to the shift's start where they were", () => {
    expect(worker(shifts, "angel").checkIn).toBe(15 * 60);
    expect(worker(shifts, "rayna").checkIn).toBe(15 * 60);
  });

  it("has no one checked out of the shift under way", () => {
    for (const w of shifts[0].workers) {
      expect(w.status).not.toBe("checkedOut");
      expect(w.checkOut).toBeUndefined();
    }
    expect(worker(shifts, "rayna").status).toBe("checkedIn");
    expect(worker(shifts, "alejandro").status).toBe("checkedIn");
  });

  it("spreads the started shift's later times evenly, in order, between its start and now", () => {
    // Aspen's late check-in, the one time after the start: halfway through 43 minutes.
    expect(worker(shifts, "aspen").checkIn).toBe(15 * 60 + 22);
  });

  it("ends the AM shift before the afternoon one starts, all five workers checked out", () => {
    expect(shifts[1].end).toBeLessThan(shifts[0].start);
    expect(shifts[1].workers).toHaveLength(5);
    for (const w of shifts[1].workers) {
      expect(w.status).toBe("checkedOut");
      expect(w.checkIn).toBeDefined();
      expect(w.checkOut).toBeDefined();
    }
  });

  it("keeps a finished shift's times as authored, moved with the schedule", () => {
    const later = shiftsFrom(16 * 60 + 30, 17 * 60 + 15);
    expect(worker(later, "brittany").checkIn).toBe(7 * 60 + 30);
    expect(worker(later, "brittany").checkOut).toBe(15 * 60 + 33);
  });

  it("keeps workers with no times without them", () => {
    expect(worker(shifts, "maria").checkIn).toBeUndefined();
  });

  it("puts nothing after now", () => {
    const now = 15 * 60 + 30;
    const times = shiftsFrom(15 * 60, now).flatMap((s) => s.workers.flatMap((w) => [w.checkIn, w.checkOut]));
    expect(times.filter((t) => t !== undefined && t > now)).toEqual([]);
  });
});

describe("daysFrom", () => {
  const now = 15 * 60 + 43;
  const days = daysFrom(15 * 60, now);
  const ids = (shifts: ReturnType<typeof shiftsFrom>) => shifts.map((s) => s.workers.map((w) => w.id));

  it("has today's shifts as they stand now", () => {
    expect(days.today).toEqual(shiftsFrom(15 * 60, now));
  });

  it("has the same shifts, workers and hours yesterday and tomorrow, a day either side, in time order", () => {
    // Today leads with the shift under way; the other days run AM first.
    const inOrder = [...days.today].reverse();
    for (const [day, by] of [[days.yesterday, -DAY], [days.tomorrow, DAY]] as const) {
      expect(day.map((s) => s.name)).toEqual(inOrder.map((s) => s.name));
      expect(day.map((s) => s.start)).toEqual(inOrder.map((s) => s.start + by));
      expect(day.map(shiftHours)).toEqual(inOrder.map(shiftHours));
      expect(ids(day)).toEqual(ids(inOrder));
    }
  });

  it("shows everyone tomorrow as upcoming, with no times", () => {
    for (const w of days.tomorrow.flatMap((s) => s.workers)) {
      expect(w.status).toBe("upcoming");
      expect(w.checkIn).toBeUndefined();
      expect(w.checkOut).toBeUndefined();
    }
  });

  it("shows each of yesterday's shifts with some workers checked out and some absent", () => {
    for (const shift of days.yesterday) {
      expect(new Set(shift.workers.map((w) => w.status))).toEqual(new Set(["checkedOut", "absent"]));
      for (const w of shift.workers) {
        if (w.status === "absent") expect([w.checkIn, w.checkOut]).toEqual([undefined, undefined]);
        else expect(w.checkIn).toBeLessThan(w.checkOut!);
      }
    }
  });

  // Only a floor manager may check a worker in early.
  it("has no worker check themselves in before their shift starts", () => {
    for (const shift of [...days.yesterday, ...days.today])
      for (const w of shift.workers.filter((w) => w.checkIn !== undefined && !w.by)) expect(w.checkIn).toBeGreaterThanOrEqual(shift.start);
  });

  it("puts all of yesterday before now", () => {
    const times = days.yesterday.flatMap((s) => s.workers.flatMap((w) => [w.checkIn, w.checkOut]));
    expect(times.filter((t) => t !== undefined && t > now)).toEqual([]);
  });
});

describe("shiftHours", () => {
  it("marks an end on a later day than the start", () => {
    const [afternoon] = shiftsFrom(17 * 60, 17 * 60 + 45);
    expect(shiftHours(afternoon)).toBe("5:00 PM–2:00 AM (+1 day)");
  });

  it("leaves a shift that starts and ends on one day unmarked", () => {
    const [, am] = shiftsFrom(15 * 60, 15 * 60 + 45);
    expect(shiftHours(am)).toBe("6:00 AM–2:00 PM");
  });
});

describe("timeRange", () => {
  it("marks a check-out on a later day than the check-in", () => {
    // Started at 5:00 AM, the third shift ran overnight.
    expect(timeRange(worker(shiftsFrom(5 * 60, 5 * 60 + 45), "brittany"))).toBe("8:00 PM–4:03 AM (+1 Day)");
    expect(timeRange(worker(shiftsFrom(15 * 60, 15 * 60 + 45), "brittany"))).toBe("6:00 AM–2:03 PM");
  });

  it("shows a check-in with no check-out as in progress", () => {
    expect(timeRange(worker(shiftsFrom(15 * 60, 15 * 60 + 45), "rayna"))).toBe("3:00 PM–In progress");
  });
});

describe("minutesNow", () => {
  it("reads the clock in the anchor's day, past midnight when the shift has crossed it", () => {
    expect(minutesNow(15 * 60, at(15, 43))).toBe(15 * 60 + 43);
    expect(minutesNow(23 * 60 + 30, at(0, 5))).toBe(24 * 60 + 5);
    expect(minutesNow(-30, at(0, 10))).toBe(10);
  });
});

describe("parseClock", () => {
  const PM3 = 15 * 60;

  it("reads a typed time with AM or PM, however it's spaced or punctuated", () => {
    expect(parseClock("3:07 PM", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("3:07pm", PM3)).toBe(15 * 60 + 7);
    expect(parseClock(" 3:07 p ", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("3.07 p.m.", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("307pm", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("3 pm", PM3)).toBe(15 * 60);
    expect(parseClock("12:30 am", PM3)).toBe(30);
    expect(parseClock("12 pm", PM3)).toBe(12 * 60);
  });

  it("reads 24-hour times", () => {
    expect(parseClock("15:07", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("1507", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("0:15", PM3)).toBe(15);
  });

  it("takes a bare 12-hour time as whichever of AM and PM is nearer the shift", () => {
    expect(parseClock("3:07", PM3)).toBe(15 * 60 + 7);
    expect(parseClock("3:07", 3 * 60)).toBe(3 * 60 + 7);
    expect(parseClock("11:50", 30)).toBe(23 * 60 + 50);
  });

  it("refuses what isn't a time", () => {
    for (const text of ["", "abc", "25:00", "3:75", "13 pm", "0 am", "3:7"]) expect(parseClock(text, PM3)).toBeNull();
  });
});
