import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { rangeCell, rangeDays, rangeOf } from "../calchemy-range";

const on = (iso: string) => Temporal.PlainDate.from(iso);

const range = (first: string, last: string) => ({
  first: on(first),
  last: on(last),
});

/** The band as one cell sees it, on a Sunday-first grid unless told otherwise. */
const at = (iso: string, span: { first: string; last: string }, week = "sun") =>
  rangeCell(
    on(iso),
    range(span.first, span.last),
    week as Parameters<typeof rangeCell>[2],
  );

// January 2026 opens on a Thursday, so a Sunday-first grid rows it
// Dec 28–Jan 3 · Jan 4–10 · Jan 11–17 · Jan 18–24 · Jan 25–31, and both
// February and March open on a Sunday. That is what these fixtures lean on.
const JAN_TO_FEB = { first: "2026-01-20", last: "2026-02-10" };

describe("rangeOf", () => {
  it("reads the ends off a selection whatever order it arrives in", () => {
    expect(rangeOf([on("2026-02-10"), on("2026-01-20"), on("2026-01-25")]))
      .toEqual({ first: on("2026-01-20"), last: on("2026-02-10") });
  });

  it("is a range of one day when one day is selected", () => {
    expect(rangeOf([on("2026-01-20")])).toEqual({
      first: on("2026-01-20"),
      last: on("2026-01-20"),
    });
  });

  it("is nothing at all when nothing is selected", () => {
    expect(rangeOf([])).toBeNull();
  });
});

describe("rangeDays", () => {
  it("fills in every day between the ends", () => {
    expect(rangeDays(range("2026-01-30", "2026-02-02")).map(String)).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  it("gives the one day of a one-day range", () => {
    expect(rangeDays(range("2026-01-20", "2026-01-20")).map(String)).toEqual([
      "2026-01-20",
    ]);
  });
});

describe("rangeCell", () => {
  it("says nothing about a day outside the range", () => {
    expect(at("2026-01-19", JAN_TO_FEB)).toBeNull();
    expect(at("2026-02-11", JAN_TO_FEB)).toBeNull();
  });

  it("names the two ends, and everything between them as inside", () => {
    expect(at("2026-01-20", JAN_TO_FEB)?.role).toBe("start");
    expect(at("2026-02-10", JAN_TO_FEB)?.role).toBe("end");
    expect(at("2026-01-21", JAN_TO_FEB)?.role).toBe("inside");
    expect(at("2026-02-01", JAN_TO_FEB)?.role).toBe("inside");
  });

  it("opens a run at the first day and carries it to the end of the week", () => {
    // Jan 20 is a Tuesday, so its row runs out at Jan 24 — five cells.
    expect(at("2026-01-20", JAN_TO_FEB)?.run).toEqual({
      length: 5,
      fadesIn: false,
      fadesOut: false,
    });
  });

  it("opens a fresh run on every week, and none in the middle of one", () => {
    expect(at("2026-01-21", JAN_TO_FEB)?.run).toBeNull();
    expect(at("2026-01-25", JAN_TO_FEB)?.run).toEqual({
      length: 7,
      fadesIn: false,
      // Jan 25–31 ends on the last of January, and the range runs on into
      // February — so this is where the band leaves the month.
      fadesOut: true,
    });
  });

  it("fades in on the first of a month the range reaches into", () => {
    expect(at("2026-02-01", JAN_TO_FEB)?.run).toEqual({
      length: 7,
      fadesIn: true,
      fadesOut: false,
    });
  });

  it("stops the run where the range stops", () => {
    // Feb 8 is a Sunday and the range ends on the 10th: three cells, no fade.
    expect(at("2026-02-08", JAN_TO_FEB)?.run).toEqual({
      length: 3,
      fadesIn: false,
      fadesOut: false,
    });
  });

  it("fades a month it passes clean through at both ends", () => {
    const through = { first: "2026-01-20", last: "2026-03-05" };
    expect(at("2026-02-01", through)?.run?.fadesIn).toBe(true);
    expect(at("2026-02-22", through)?.run).toEqual({
      length: 7,
      fadesIn: false,
      fadesOut: true,
    });
  });

  it("never fades at the ends of the range itself", () => {
    // The range opens on the 1st and closes on the last of the month, so both
    // runs sit on a month boundary — and neither has anywhere else to go.
    const february = { first: "2026-02-01", last: "2026-02-28" };
    expect(at("2026-02-01", february)?.run?.fadesIn).toBe(false);
    expect(at("2026-02-22", february)?.run?.fadesOut).toBe(false);
  });

  it("draws a one-day range as a single cell", () => {
    const day = { first: "2026-01-20", last: "2026-01-20" };
    expect(at("2026-01-20", day)).toEqual({
      role: "start",
      run: { length: 1, fadesIn: false, fadesOut: false },
    });
  });

  it("rows the runs by the week start it is given", () => {
    // Monday-first moves the break: the row now runs Jan 19–25, so the range's
    // first day opens a SIX-cell run instead of a five-cell one.
    expect(at("2026-01-20", JAN_TO_FEB, "mon")?.run?.length).toBe(6);
    expect(at("2026-01-25", JAN_TO_FEB, "mon")?.run).toBeNull();
    expect(at("2026-01-26", JAN_TO_FEB, "mon")?.run).toEqual({
      length: 6,
      fadesIn: false,
      fadesOut: true,
    });
  });
});
