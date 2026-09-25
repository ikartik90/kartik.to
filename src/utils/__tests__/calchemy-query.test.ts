import { beforeAll, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { createCalchemy, type Calchemy } from "@calchemy/date-core";
import { parseQuery, parseQueryDates } from "../calchemy-query";

// A fixed Wednesday, so relative queries have stable answers.
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

/** Every `weekday` (1 = Monday) in `month`, computed independently of the parser. */
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
    expect(parseQueryDates(calchemy, "tomorrow", CONTEXT, "single").map(String)).toEqual([
      REFERENCE.add({ days: 1 }).toString(),
    ]);
    expect(parseQueryDates(calchemy, "mondays next month", CONTEXT, "single")).toEqual([]);
  });

  it("draws a range as its days, and refuses a single date for one", () => {
    expect(
      parseQueryDates(calchemy, "Sep 10, 2026 - Sep 12, 2026", CONTEXT, "range").map(String),
    ).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);

    expect(parseQueryDates(calchemy, "tomorrow", CONTEXT, "range")).toEqual([]);
  });

  it("previews the first reading of an ambiguous phrase, and offers the rest", () => {
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
    expect(candidates).toHaveLength(3);
    expect(activeId).toBe("mdy");
  });

  it("offers only the readings the chosen kind can use", () => {
    const { dates, candidates } = parseQuery(calchemy, "03/04/25", CONTEXT, "range");

    expect(candidates).toEqual([]);
    expect(dates).toEqual([]);
  });

  it("offers nothing to choose when the phrase means one thing", () => {
    const { dates, candidates } = parseQuery(calchemy, "tomorrow", CONTEXT, "single");

    expect(candidates).toEqual([]);
    expect(dates.map(String)).toEqual([REFERENCE.add({ days: 1 }).toString()]);
  });

  it("passes on the phrase the parser would have read instead", () => {
    expect(
      parseQuery(calchemy, "tomorrow until march", CONTEXT).suggestion,
    ).toBe("tomorrow until march 2027");
    expect(parseQuery(calchemy, "2020 03 15", CONTEXT).suggestion).toBe(
      "2020-03-15",
    );
  });

  it("has nothing to suggest for a phrase that already reads", () => {
    expect(parseQuery(calchemy, "tomorrow", CONTEXT).suggestion).toBeNull();
    expect(parseQuery(calchemy, "03/04/25", CONTEXT).suggestion).toBeNull();
  });

  it("has nothing to suggest for a phrase beyond repair, or an empty box", () => {
    expect(parseQuery(calchemy, "qwertyuiop", CONTEXT).suggestion).toBeNull();
    expect(parseQuery(calchemy, "", CONTEXT).suggestion).toBeNull();
  });

  it("does not offer a rewrite for a phrase only the kind refused", () => {
    expect(
      parseQuery(calchemy, "mondays next month", CONTEXT, "single").suggestion,
    ).toBeNull();
  });

  it("hands back this app's PlainDate, not the parser's", () => {
    const [date] = parseQueryDates(calchemy, "today", CONTEXT);

    expect(date).toBeInstanceOf(Temporal.PlainDate);
  });
});
