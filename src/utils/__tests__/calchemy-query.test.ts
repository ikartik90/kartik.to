import { beforeAll, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { createCalchemy, type Calchemy } from "@calchemy/date-core";
import { parseQuery, parseQueryDates } from "../calchemy-query";

// A Wednesday, so "tomorrow" and the weekday queries below have an unambiguous
// answer that does not move with the wall clock.
const REFERENCE = Temporal.PlainDate.from("2026-09-02");
const CONTEXT = {
  locale: "en-US",
  weekStartsOn: 0,
  referenceDate: REFERENCE,
} as const;

let calchemy: Calchemy;

beforeAll(async () => {
  calchemy = await createCalchemy({ defaultContext: CONTEXT });
});

/** Every date in `month` falling on `weekday` (1 = Monday), computed here so
 *  the expectation is the calendar's answer rather than the parser's. */
function weekdaysIn(month: Temporal.PlainYearMonth, weekday: number) {
  const dates: Temporal.PlainDate[] = [];
  for (let day = 1; day <= month.daysInMonth; day += 1) {
    const date = month.toPlainDate({ day });
    if (date.dayOfWeek === weekday) dates.push(date);
  }
  return dates.map((date) => date.toString());
}

describe("parseQueryDates", () => {
  it("returns nothing for an empty query", () => {
    expect(parseQueryDates(calchemy, "", CONTEXT)).toEqual([]);
  });

  it("returns nothing for a query it cannot parse", () => {
    expect(parseQueryDates(calchemy, "qwertyuiop", CONTEXT)).toEqual([]);
  });

  it("resolves a single date to a one-date selection", () => {
    const dates = parseQueryDates(calchemy, "tomorrow", CONTEXT);

    expect(dates.map(String)).toEqual([REFERENCE.add({ days: 1 }).toString()]);
  });

  it("expands a range into every day it covers", () => {
    const dates = parseQueryDates(calchemy, "Sep 10, 2026 - Sep 12, 2026", CONTEXT);

    expect(dates.map(String)).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("expands a recurring weekday phrase across the month it names", () => {
    const dates = parseQueryDates(calchemy, "mondays next month", CONTEXT);

    expect(dates.map(String)).toEqual(
      weekdaysIn(Temporal.PlainYearMonth.from("2026-10"), 1),
    );
  });

  it("returns the dates in chronological order", () => {
    const dates = parseQueryDates(
      calchemy,
      "mondays and fridays next month",
      CONTEXT,
    );

    const sorted = [...dates].sort(Temporal.PlainDate.compare);
    expect(dates.map(String)).toEqual(sorted.map(String));
    expect(dates.length).toBeGreaterThan(weekdaysIn(Temporal.PlainYearMonth.from("2026-10"), 1).length);
  });

  it("holds a phrase to the kind it was asked for", () => {
    // `single` takes a phrase that means one day...
    expect(parseQueryDates(calchemy, "tomorrow", CONTEXT, "single").map(String)).toEqual([
      REFERENCE.add({ days: 1 }).toString(),
    ]);
    // ...and a recurrence is not one, so it resolves to nothing rather than to
    // some arbitrary day out of the set.
    expect(parseQueryDates(calchemy, "mondays next month", CONTEXT, "single")).toEqual([]);
  });

  it("draws a range as its days, and refuses a single date for one", () => {
    expect(
      parseQueryDates(calchemy, "Sep 10, 2026 - Sep 12, 2026", CONTEXT, "range").map(String),
    ).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);

    expect(parseQueryDates(calchemy, "tomorrow", CONTEXT, "range")).toEqual([]);
  });

  it("previews the first reading of an ambiguous phrase, and offers the rest", () => {
    // A slashed date nobody has said the order of: the parser knows it means
    // three different days.
    const { dates, candidates, activeId } = parseQuery(
      calchemy,
      "03/04/25",
      CONTEXT,
      "single",
    );

    expect(candidates.map((c) => c.label)).toEqual([
      "April 3, 2025",
      "March 4, 2025",
      "April 25, 2003",
    ]);
    // The highlighted reading is PREVIEWED on the grid, so moving through the
    // list shows what each one would select. Committing it is a separate act.
    expect(dates.map(String)).toEqual(["2025-04-03"]);
    expect(activeId).toBe(candidates[0].id);
  });

  it("previews whichever reading is active", () => {
    const { dates, candidates, activeId } = parseQuery(
      calchemy,
      "03/04/25",
      CONTEXT,
      "single",
      "mdy",
    );

    expect(dates.map(String)).toEqual(["2025-03-04"]);
    // Still offered, so the choice can be changed without retyping.
    expect(candidates).toHaveLength(3);
    expect(activeId).toBe("mdy");
  });

  it("offers only the readings the chosen kind can use", () => {
    // Every reading of this phrase is a single date, so under `range` there is
    // nothing to choose BETWEEN — and nothing to draw.
    const { dates, candidates } = parseQuery(calchemy, "03/04/25", CONTEXT, "range");

    expect(candidates).toEqual([]);
    expect(dates).toEqual([]);
  });

  it("offers nothing to choose when the phrase means one thing", () => {
    const { dates, candidates } = parseQuery(calchemy, "tomorrow", CONTEXT, "single");

    expect(candidates).toEqual([]);
    expect(dates.map(String)).toEqual([REFERENCE.add({ days: 1 }).toString()]);
  });

  it("hands back this app's PlainDate, not the parser's", () => {
    const [date] = parseQueryDates(calchemy, "today", CONTEXT);

    // The calendar it feeds compares with `Temporal.PlainDate.compare` from
    // THIS polyfill copy; a date carried over from another one would still
    // stringify correctly and silently fail to match.
    expect(date).toBeInstanceOf(Temporal.PlainDate);
  });
});
