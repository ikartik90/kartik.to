import { describe, expect, it } from "vitest";
import {
  addDays,
  cellTime,
  dayTone,
  entryIn,
  entryOn,
  fillTone,
  fullDate,
  historyOf,
  isoOf,
  recentSpend,
  monthOf,
  monthSpans,
  post,
  postedMessage,
  redo,
  record,
  repeatDates,
  repeatOf,
  repeatSummary,
  reschedule,
  scheduleCounts,
  NO_FILTER,
  seedSeries,
  shiftRows,
  TEMPLATES,
  toggle,
  undo,
  weekLabel,
  weekOf,
  weekNumber,
  weekSpots,
  windowLabel,
} from "../shifts";

// A Wednesday; its week runs from Sunday 30 November.
const TODAY = "2025-12-03";

describe("dates", () => {
  it("reads a day as it falls where the visitor is", () => {
    expect(isoOf(new Date(2025, 11, 3, 23, 30))).toBe("2025-12-03");
  });

  it("steps across months and years", () => {
    expect(addDays("2025-12-30", 3)).toBe("2026-01-02");
    expect(addDays("2025-12-01", -1)).toBe("2025-11-30");
  });

  it("puts a day in its Sunday-to-Saturday week", () => {
    expect(weekOf("2025-12-03")).toEqual([
      "2025-11-30",
      "2025-12-01",
      "2025-12-02",
      "2025-12-03",
      "2025-12-04",
      "2025-12-05",
      "2025-12-06",
    ]);
  });

  it("names a week as Figma's date selector does", () => {
    expect(weekLabel(weekOf("2025-12-03"))).toBe("Nov 30–Dec 6");
    expect(weekLabel(weekOf("2025-12-10"))).toBe("Dec 7–13");
  });

  it("spans each month over its days of a week", () => {
    expect(monthSpans(weekOf("2026-09-30"))).toEqual([
      { name: "September 2026", span: 4 },
      { name: "October 2026", span: 3 },
    ]);
    expect(monthSpans(weekOf("2026-10-14"))).toEqual([{ name: "October 2026", span: 7 }]);
  });

  it("lays out a month from the weekday of its 1st", () => {
    const december = monthOf("2025-12-15");
    expect(december.label).toBe("December 2025");
    // 1 December 2025 is a Monday.
    expect(december.lead).toBe(1);
    expect(december.days).toHaveLength(31);
    expect(december.days[0]).toBe("2025-12-01");
  });

  it("writes a date out in full", () => {
    expect(fullDate("2026-10-31")).toBe("31 October, 2026");
  });
});

describe("the Check-ins page's cards", () => {
  it("counts this week's spots: checked in and absent on the shifts that have ended, filled and vacant on the rest", () => {
    // Wednesday noon: Monday's and Tuesday's shifts are over, and the overnight ones started Sunday and Monday.
    expect(weekSpots(seedSeries(TODAY), TODAY, 12 * 60)).toEqual({ checkedIn: 36, absent: 2, filled: 42, vacant: 9 });
    // Wednesday 5:00 PM: its day shifts are over too.
    expect(weekSpots(seedSeries(TODAY), TODAY, 17 * 60)).toEqual({ checkedIn: 45, absent: 2, filled: 33, vacant: 9 });
  });

  it("spends, over this week and the five before it, the hours worked on shifts that have ended, at each template's wage", () => {
    // Friday noon: none of Friday's shifts is over, and this week's are Figma's, Sunday to Thursday, worked in full but
    // for a few minutes short.
    const noon = recentSpend("2026-10-30", 12 * 60);
    expect(noon).toMatchObject({ first: "2026-09-20", last: "2026-10-31" });
    expect(noon.weeks.map(({ week }) => week)).toEqual([39, 40, 41, 42, 43, 44]);
    expect(noon.weeks.at(-1)!.week).toBe(44);
    expect(noon.weeks.at(-1)!.amount).toBeLessThan(8332);
    expect(noon.weeks.at(-1)!.amount).toBeGreaterThan(0.97 * 8332);
    expect(noon.weeks.reduce((total, { amount }) => total + amount, 0)).toBeCloseTo(noon.total);
    // Friday 6:00 PM: its day shifts, worth 1,028 in full, are over too.
    const evening = recentSpend("2026-10-30", 18 * 60);
    expect(evening.total - noon.total).toBeLessThan(1028);
    expect(evening.total - noon.total).toBeGreaterThan(0.97 * 1028);
  });

  it("varies the weeks before this one, a few places left open, a few workers absent and a few minutes short, the same on every visit", () => {
    const past = recentSpend("2026-10-30", 12 * 60).weeks.slice(0, 5).map(({ amount }) => amount);
    expect(new Set(past).size).toBe(5);
    // Figma's week, every place it fills filled and nobody absent, comes to 12,476.
    for (const amount of past) {
      expect(amount).toBeGreaterThan(0.6 * 12476);
      expect(amount).toBeLessThanOrEqual(12476);
    }
    expect(recentSpend("2026-10-30", 12 * 60)).toEqual(recentSpend("2026-10-30", 12 * 60));
    const weekOn = (sunday: string) =>
      seedSeries("2026-10-30").flatMap((series) =>
        weekOf(sunday).map((date) => [series.filled?.[date] ?? 0, series.absent?.[date] ?? 0]),
      );
    expect(weekOn("2026-10-11")).not.toEqual(weekOn("2026-10-18"));
    expect(weekOn("2026-10-25")).toEqual(weekOn("2026-11-01"));
    // Late check-ins and early check-outs, this week's too, leave every week spent in, and so their sum, short of whole
    // dollars; days still to come have nobody short.
    const cents = (amount: number) => Math.round(amount * 100) % 100;
    for (const now of [12 * 60, 18 * 60]) {
      const { weeks, total } = recentSpend("2026-10-30", now);
      expect(weeks.map(({ amount }) => cents(amount)).filter((cent) => cent === 0)).toEqual([]);
      expect(cents(total)).not.toBe(0);
    }
    const shortOn = seedSeries("2026-10-30").flatMap((series) => Object.keys(series.short ?? {}));
    expect(shortOn.some((date) => date < "2026-10-25")).toBe(true);
    expect(shortOn.some((date) => date >= "2026-10-25" && date <= "2026-10-30")).toBe(true);
    expect(shortOn.some((date) => date > "2026-10-30")).toBe(false);
  });

  it("never spends whole dollars in a week, or in all six, whenever it's counted", () => {
    // Week 5 of 2026, short by chance, came to whole dollars, as did the six weeks to 5 April and to 13 July.
    const days = (first: string, length: number) => Array.from({ length }, (_, i) => addDays(first, i));
    const whole = [...days("2026-01-25", 21), ...days("2026-04-04", 3), ...days("2026-07-12", 3)].flatMap((today) =>
      [0, 6 * 60 + 30, 12 * 60, 17 * 60 + 30, 23 * 60 + 59].flatMap((now) => {
        const { weeks, total } = recentSpend(today, now);
        return [...weeks.map(({ week, amount }) => [`week ${week}`, amount] as const), ["in all", total] as const]
          .filter(([, amount]) => amount > 0 && Math.round(amount * 100) % 100 === 0)
          .map(([what, amount]) => `${today} ${now}: ${what}, ${amount}`);
      }),
    );
    expect(whole).toEqual([]);
  });

  it("numbers the weeks Sunday to Saturday, week 1 holding 1 January", () => {
    expect(["2026-09-27", "2026-10-03", "2026-12-26", "2026-12-27", "2027-01-02", "2027-01-03"].map(weekNumber)).toEqual([40, 40, 52, 1, 1, 2]);
    expect(recentSpend("2027-01-15", 0).weeks.map(({ week }) => week)).toEqual([50, 51, 52, 1, 2, 3]);
  });
});

describe("the Shifts page", () => {
  it("colours a shift's fill as Figma's progress bars do", () => {
    expect(fillTone(3, 3)).toBe("full");
    expect(fillTone(5, 6)).toBe("high");
    expect(fillTone(2, 3)).toBe("mid");
    expect(fillTone(9, 13)).toBe("mid");
    expect(fillTone(1, 4)).toBe("low");
    expect(fillTone(0, 1)).toBe("low");
  });

  it("writes a shift's hours as Figma's cells do", () => {
    expect(cellTime(9 * 60, 17 * 60)).toBe("09:00AM–05:00 PM");
    expect(cellTime(11 * 60, 19 * 60)).toBe("11:00AM–07:00 PM");
  });

  it("repeats Figma's shifts on their weekdays", () => {
    const morning = seedSeries(TODAY).find((series) => series.title === "Morning Shift (M/W/F)")!;
    // 1 December 2025 is a Monday.
    expect(entryOn(morning, "2025-12-01")).toEqual({ filled: 3, total: 3 });
    expect(entryOn(morning, "2025-12-02")).toBeNull();
    expect(entryOn(morning, "2025-12-05")).toEqual({ filled: 2, total: 3 });
  });

  it("runs Figma's shifts from two weeks before this one to three weeks after", () => {
    const morning = seedSeries(TODAY).find((series) => series.title === "Morning Shift (M/W/F)")!;
    expect(morning.dates[0]).toBe("2025-11-17");
    expect(morning.dates.at(-1)).toBe("2025-12-26");
    expect(entryOn(morning, "2025-11-14")).toBeNull();
    expect(entryOn(morning, "2025-12-29")).toBeNull();
  });

  it("adds a posted shift on its dates, unfilled, and says how many were posted", () => {
    const seeded = seedSeries(TODAY);
    const posted = post(seeded, {
      template: "forklift",
      title: "Day Shift M/W/F",
      dates: ["2025-12-05", "2025-12-01", "2025-12-03"],
      start: 9 * 60,
      end: 17 * 60,
      workers: 2,
    });
    const added = posted.at(-1)!;
    expect(posted).toHaveLength(seeded.length + 1);
    expect(added.dates).toEqual(["2025-12-01", "2025-12-03", "2025-12-05"]);
    expect(entryOn(added, "2025-12-03")).toEqual({ filled: 0, total: 2 });
    expect(entryOn(added, "2025-12-04")).toBeNull();
    expect(postedMessage(3)).toBe("3 shifts posted");
    expect(postedMessage(1)).toBe("1 shift posted");
  });

  it("holds a day's shift in a Fill % range when its progress bar's band lies in it, and 100 the full band", () => {
    const [morning, holiday] = seedSeries(TODAY);
    // Friday 5 December: Morning Shift's 2/3 is a half-full band, Holiday Special's 1/4 the band under half.
    expect(entryIn(morning, "2025-12-05", [50, 75])).toEqual({ filled: 2, total: 3 });
    expect(entryIn(morning, "2025-12-05", [0, 50])).toBeNull();
    expect(entryIn(holiday, "2025-12-05", [0, 50])).toEqual({ filled: 1, total: 4 });
    expect(entryIn(morning, "2025-12-01", [75, 100])).toEqual({ filled: 3, total: 3 });
    expect(entryIn(morning, "2025-12-01", [100, 100])).toEqual({ filled: 3, total: 3 });
    expect(entryIn(morning, "2025-12-01", [0, 75])).toBeNull();
    expect(entryIn(morning, "2025-12-02", [0, 100])).toBeNull();
  });

  it("names the six-hour windows a shift starts in by their hours", () => {
    expect(windowLabel(0)).toBe("12:00 AM–6:00 AM");
    expect(windowLabel(18 * 60)).toBe("6:00 PM–12:00 AM");
  });

  it("lists the templates with a shift in its filters, each with only those shifts", () => {
    const week = weekOf(TODAY);
    const seeded = seedSeries(TODAY);
    const rows = (filter: Partial<typeof NO_FILTER>, series = seeded) =>
      shiftRows(TEMPLATES, series, week, { ...NO_FILTER, ...filter }).map(({ template, lines }) => [
        template.id,
        lines.map((line) => line.id),
      ]);
    expect(rows({})).toEqual([
      ["forklift", ["morning", "holiday"]],
      ["general", ["weekdays"]],
      ["picker", ["weekend-picker"]],
      ["manager", ["weekend-manager"]],
    ]);
    expect(rows({ fill: [0, 75] })).toEqual([
      ["forklift", ["morning", "holiday"]],
      ["picker", ["weekend-picker"]],
    ]);
    // A seeded shift starts in each window.
    expect(rows({ starts: [0] })).toEqual([["manager", ["weekend-manager"]]]);
    expect(rows({ starts: [6 * 60] })).toEqual([
      ["forklift", ["morning"]],
      ["general", ["weekdays"]],
    ]);
    expect(rows({ starts: [12 * 60, 18 * 60] })).toEqual([
      ["forklift", ["holiday"]],
      ["picker", ["weekend-picker"]],
    ]);
    const posted = post(seeded, {
      template: "general",
      title: "Afternoon Shift",
      dates: ["2025-12-02"],
      start: 13 * 60,
      end: 21 * 60,
      workers: 2,
    });
    expect(rows({ starts: [12 * 60] }, posted)).toEqual([
      ["general", [posted.at(-1)!.id]],
      ["picker", ["weekend-picker"]],
    ]);
    expect(rows({ tags: ["Loading", "Licensed"] }).map(([id]) => id)).toEqual(["forklift", "manager"]);
    expect(rows({ search: "morning" }).map(([id]) => id)).toEqual(["forklift"]);
  });

  it("keeps what a shift was posted with for its summary", () => {
    const [added] = post([], {
      template: "general",
      title: "Day Shift M/W/F",
      dates: ["2025-12-05"],
      start: 9 * 60,
      end: 17 * 60,
      workers: 2,
      breakMinutes: 45,
      paidBreak: true,
      reportTo: "Yousuf Hamedani",
      spotFill: false,
    });
    expect(added).toMatchObject({ breakMinutes: 45, paidBreak: true, reportTo: "Yousuf Hamedani", spotFill: false });
  });
});

describe("editing a schedule", () => {
  const weekdays = () => seedSeries(TODAY).find((series) => series.id === "weekdays")!;

  it("adds dates unfilled and drops the ones cancelled, leaving the others as they were", () => {
    const before = weekdays();
    const dates = [...before.dates.filter((date) => date !== "2025-12-05"), "2025-12-06"];
    const after = reschedule(seedSeries(TODAY), "weekdays", dates, false).find((series) => series.id === "weekdays")!;
    expect(entryOn(after, "2025-12-05")).toBeNull();
    expect(entryOn(after, "2025-12-06")).toEqual({ filled: 0, total: 6 });
    expect(entryOn(after, "2025-12-04")).toEqual({ filled: 6, total: 6 });
    expect(after.dates).toEqual([...after.dates].sort());
    expect(after.spotFill).toBe(false);
  });

  it("leaves the other shifts alone", () => {
    const seeded = seedSeries(TODAY);
    const after = reschedule(seeded, "weekdays", [], true);
    expect(after.filter((series) => series.id !== "weekdays")).toEqual(seeded.filter((series) => series.id !== "weekdays"));
  });

  // Figma's Edit schedule (22092:98905): 22 December cancelled, 26–30 December added, on 30 November.
  const BASE = ["2025-12-01", "2025-12-02", "2025-12-05", "2025-12-06", "2025-12-07", "2025-12-08", "2025-12-09"]
    .concat(["2025-12-12", "2025-12-13", "2025-12-14", "2025-12-15", "2025-12-16"])
    .concat(["2025-12-19", "2025-12-20", "2025-12-21", "2025-12-22", "2025-12-23"]);
  const NEXT = BASE.filter((date) => date !== "2025-12-22").concat([
    "2025-12-26",
    "2025-12-27",
    "2025-12-28",
    "2025-12-29",
    "2025-12-30",
  ]);

  it("counts the regular, added and cancelled shifts ahead", () => {
    expect(scheduleCounts(BASE, BASE, "2025-11-30")).toEqual({ regular: 17, edited: 0, added: 0, cancelled: 0 });
    expect(scheduleCounts(BASE, NEXT, "2025-11-30")).toEqual({ regular: 16, edited: 0, added: 5, cancelled: 1 });
    // Shifts already worked aren't counted.
    expect(scheduleCounts(BASE, BASE, "2025-12-10").regular).toBe(10);
  });

  it("colours each day by what the edit does to it", () => {
    expect(dayTone(BASE, NEXT, "2025-12-01")).toBe("regular");
    expect(dayTone(BASE, NEXT, "2025-12-22")).toBe("cancelled");
    expect(dayTone(BASE, NEXT, "2025-12-26")).toBe("added");
    expect(dayTone(BASE, NEXT, "2025-12-24")).toBeUndefined();
  });
});

describe("picking dates", () => {
  it("toggles dates in and out, in calendar order", () => {
    expect(toggle(["2025-12-03", "2025-12-01"], ["2025-12-01", "2025-12-02"])).toEqual(["2025-12-02", "2025-12-03"]);
  });

  it("undoes and redoes each change", () => {
    let history = historyOf<string[]>([]);
    history = record(history, ["2025-12-01"]);
    history = record(history, ["2025-12-01", "2025-12-02"]);
    history = undo(history);
    expect(history.present).toEqual(["2025-12-01"]);
    history = redo(history);
    expect(history.present).toEqual(["2025-12-01", "2025-12-02"]);
    history = undo(undo(history));
    expect(history.present).toEqual([]);
    expect(undo(history)).toBe(history);
    // A new change drops what was undone.
    history = record(history, ["2025-12-05"]);
    expect(redo(history)).toBe(history);
  });
});

describe("repeating a shift (the recurrence concept)", () => {
  // 10 November 2025 is a Monday.
  it("repeats on the picked weekdays from the first shift until the last", () => {
    expect(repeatDates({ first: "2025-11-10", weekdays: [1, 3, 5], until: "2025-11-23" })).toEqual([
      "2025-11-10",
      "2025-11-12",
      "2025-11-14",
      "2025-11-17",
      "2025-11-19",
      "2025-11-21",
    ]);
  });

  it("keeps the first shift when its weekday isn't one of them", () => {
    expect(repeatDates({ first: "2025-11-09", weekdays: [1], until: "2025-11-17" })).toEqual([
      "2025-11-09",
      "2025-11-10",
      "2025-11-17",
    ]);
  });

  it("posts only the first shift without weekdays or an end", () => {
    expect(repeatDates({ first: "2025-11-10", weekdays: [], until: "2025-11-23" })).toEqual(["2025-11-10"]);
    expect(repeatDates({ first: "2025-11-10", weekdays: [3], until: null })).toEqual(["2025-11-10"]);
  });

  it("reads picked dates as their first, repeated on their weekdays until the last", () => {
    const picked = ["2025-11-17", "2025-11-10", "2025-11-12", "2025-11-14", "2025-11-19", "2025-11-21"];
    expect(repeatOf(picked)).toEqual({ first: "2025-11-10", weekdays: [1, 3, 5], until: "2025-11-21" });
    expect(repeatDates(repeatOf(picked)!)).toEqual([...picked].sort());
    expect(repeatOf(["2025-11-14"])).toEqual({ first: "2025-11-14", weekdays: [], until: null });
    expect(repeatOf([])).toBeNull();
  });

  it("says what it will do in Figma's words, the days and dates in bold", () => {
    const text = (weekdays: number[]) =>
      repeatSummary({ first: "2025-11-10", weekdays, until: "2025-11-21" })
        .map((part) => part.text)
        .join("");
    expect(text([1, 3, 5])).toBe(
      "This shift will repeat every Monday, Wednesday, and Friday between Monday, 10 November, 2025 and Friday, 21 November, 2025",
    );
    expect(text([1, 3])).toBe(
      "This shift will repeat every Monday and Wednesday between Monday, 10 November, 2025 and Friday, 21 November, 2025",
    );
    const strong = repeatSummary({ first: "2025-11-10", weekdays: [1], until: "2025-11-21" })
      .filter((part) => part.strong)
      .map((part) => part.text.trim());
    expect(strong).toEqual(["Monday", "Monday, 10 November, 2025", "Friday, 21 November, 2025"]);
  });
});
