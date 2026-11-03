import { describe, expect, it } from "vitest";
import { bookedOn, bookingOn, dayKey, offerActions, plannerRows, rosterOf, sendOffers, withdrawOffers, type Filter } from "../planner";
import { entryOn, post, reschedule, seedSeries, type Series } from "../shifts";

// A Wednesday. Weekdays AM is full Monday to Thursday and one short on Fridays (Figma's 5/6).
const TODAY = "2025-12-03";
const ALL: Filter = { show: "all", publicApplicants: true, search: "" };
const weekdays = (series = seedSeries(TODAY)) => series.find((s) => s.id === "weekdays")!;
const names = (series: Series, filter: Partial<Filter> = {}) =>
  plannerRows(series, TODAY, { ...ALL, ...filter }).map((row) => row.person.name);

describe("the Shift planner's people", () => {
  it("lists Figma's Weekdays AM: those hired, those who applied, then those available", () => {
    expect(names(weekdays())).toEqual([
      "Jeremiah Schwartzmann",
      "Samantha Stevens",
      "Nathaniel Blake",
      "Brianna Santos",
      "Destiny Porter",
      "Jack Daniels",
      "Giorgia Morone",
      "Drishti Suresh",
      "Marilyn Calzoni",
      "Miguel Fernando Marquez",
      "Giana Baptista",
      "Shreyasee Pangaonkar",
    ]);
  });

  it("has workers available for every shift, from the worker pool and the public posting alike", () => {
    const [posted] = post([], { template: "general", title: "Day Shift", dates: ["2025-12-05"], start: 540, end: 1020, workers: 2 });
    for (const series of [...seedSeries(TODAY), posted]) {
      const { available } = rosterOf(series);
      expect(available.some((person) => person.pool && !person.applicant), series.title).toBe(true);
      expect(available.some((person) => person.applicant && !person.pool), series.title).toBe(true);
    }
  });

  it("hires nobody yet for a shift just posted", () => {
    const [posted] = post([], { template: "general", title: "Day Shift", dates: ["2025-12-05"], start: 540, end: 1020, workers: 2 });
    expect(rosterOf(posted).hired).toEqual([]);
    expect(names(posted)).toEqual(["Giorgia Morone", "Drishti Suresh", "Marilyn Calzoni", "Miguel Fernando Marquez"]);
  });

  it("never has one available for a shift at the same time as one they're hired on", () => {
    const series = seedSeries(TODAY);
    for (const a of series)
      for (const b of series) {
        if (a === b || a.start >= b.end || b.start >= a.end || !a.dates.some((date) => b.dates.includes(date))) continue;
        const both = rosterOf(a).available.filter((person) => rosterOf(b).hired.includes(person));
        expect(both.map((person) => person.name), `${a.title} and ${b.title}`).toEqual([]);
      }
  });

  it("never books one worker on two of Figma's shifts at once", () => {
    const series = seedSeries(TODAY);
    for (const a of series)
      for (const b of series) {
        if (a === b || a.start >= b.end || b.start >= a.end || !a.dates.some((date) => b.dates.includes(date))) continue;
        const both = rosterOf(a).hired.filter((person) => rosterOf(b).hired.includes(person));
        expect(both.map((person) => person.name), `${a.title} and ${b.title}`).toEqual([]);
      }
  });
});

describe("each day's booking", () => {
  const bookings = (series: Series, date: string, today = TODAY) =>
    plannerRows(series, today, ALL).map((row) => bookingOn(series, row, date, today));

  it("books the workers hired, and shows the one who cancelled on a day left short", () => {
    // 1 December is a Monday, 5 December a Friday.
    expect(bookings(weekdays(), "2025-12-04").slice(0, 6)).toEqual(Array(6).fill("booked"));
    expect(bookings(weekdays(), "2025-12-05").slice(0, 6)).toEqual([...Array(5).fill("booked"), "cancelled"]);
  });

  it("offers a short day to those who applied, and waitlists them for a full one", () => {
    expect(bookings(weekdays(), "2025-12-04").slice(6, 8)).toEqual(["waitlisted", "waitlisted"]);
    expect(bookings(weekdays(), "2025-12-05").slice(6, 8)).toEqual(["offered", "offered"]);
  });

  it("leaves those who applied out of the days already gone", () => {
    expect(bookings(weekdays(), "2025-12-01").slice(6, 8)).toEqual([null, null]);
  });

  it("books nobody on a day added to the schedule, and offers it", () => {
    const series = weekdays();
    const added = weekdays(reschedule([series], "weekdays", [...series.dates, "2025-12-06"], true));
    expect(bookings(added, "2025-12-06")).toEqual([...Array(6).fill(null), "offered", "offered", ...Array(4).fill(null)]);
  });

  it("only waitlists those who applied while SpotFill's offers are off", () => {
    const series = weekdays();
    const quiet = weekdays(reschedule([series], "weekdays", series.dates, false));
    expect(bookings(quiet, "2025-12-05").slice(6, 8)).toEqual(["waitlisted", "waitlisted"]);
  });

  it("books those available nothing on any day", () => {
    const series = weekdays();
    for (const date of series.dates) expect(bookings(series, date).slice(8), date).toEqual(Array(4).fill(null));
  });
});

describe("narrowing the list", () => {
  it("shows those hired, those who applied, or those offered a day", () => {
    expect(names(weekdays(), { show: "booked" })).toHaveLength(6);
    expect(names(weekdays(), { show: "candidates" })).toEqual([
      "Giorgia Morone",
      "Drishti Suresh",
      "Marilyn Calzoni",
      "Miguel Fernando Marquez",
      "Giana Baptista",
      "Shreyasee Pangaonkar",
    ]);
    expect(names(weekdays(), { show: "offered" })).toEqual(["Giorgia Morone", "Drishti Suresh"]);
    const full = reschedule([weekdays()], "weekdays", ["2025-12-04"], true)[0];
    expect(names(full, { show: "offered" })).toEqual([]);
  });

  it("hides applicants from outside the worker pool unless asked", () => {
    expect(names(weekdays(), { publicApplicants: false })).not.toContain("Giorgia Morone");
    // Hired, so they stay.
    expect(names(weekdays(), { publicApplicants: false })).toContain("Jack Daniels");
  });

  it("finds a worker by name", () => {
    expect(names(weekdays(), { search: "  sam" })).toEqual(["Samantha Stevens"]);
  });
});

describe("sending and withdrawing offers", () => {
  // Thursday 4 December is full, Friday 5 December one short.
  const FULL = "2025-12-04";
  const SHORT = "2025-12-05";
  const rowOf = (series: Series, name: string) => plannerRows(series, TODAY, ALL).find((row) => row.person.name === name)!;
  const day = (series: Series, name: string, date: string) => dayKey(rowOf(series, name), date);
  const on = (series: Series, name: string, date: string) => bookingOn(series, rowOf(series, name), date, TODAY);
  const send = (series: Series, ...picked: [string, string][]) => ({
    ...series,
    offers: sendOffers(series, TODAY, picked.map(([name, date]) => day(series, name, date))),
  });
  const withdraw = (series: Series, ...picked: [string, string][]) => ({
    ...series,
    offers: withdrawOffers(series, TODAY, picked.map(([name, date]) => day(series, name, date))),
  });

  it("offers a day picked to one available while the shift has a vacancy on it", () => {
    const series = send(weekdays(), ["Marilyn Calzoni", SHORT], ["Miguel Fernando Marquez", SHORT]);
    expect(on(series, "Marilyn Calzoni", SHORT)).toBe("offered");
    expect(on(series, "Miguel Fernando Marquez", SHORT)).toBe("offered");
    expect(on(series, "Marilyn Calzoni", FULL)).toBeNull();
  });

  it("waitlists them instead on a day whose places are all filled", () => {
    const series = send(weekdays(), ["Marilyn Calzoni", FULL], ["Marilyn Calzoni", SHORT]);
    expect(on(series, "Marilyn Calzoni", FULL)).toBe("waitlisted");
    expect(on(series, "Marilyn Calzoni", SHORT)).toBe("offered");
  });

  it("sends nothing to a day picked that isn't available", () => {
    const series = send(weekdays(), ["Jeremiah Schwartzmann", FULL], ["Giorgia Morone", FULL], ["Jack Daniels", SHORT]);
    expect(on(series, "Jeremiah Schwartzmann", FULL)).toBe("booked");
    expect(on(series, "Giorgia Morone", FULL)).toBe("waitlisted");
    expect(on(series, "Jack Daniels", SHORT)).toBe("cancelled");
  });

  it("makes every day picked that's offered, booked or waitlisted available again, and leaves a cancellation be", () => {
    const series = withdraw(
      send(weekdays(), ["Miguel Fernando Marquez", SHORT]),
      ["Giorgia Morone", SHORT],
      ["Giorgia Morone", FULL],
      ["Jeremiah Schwartzmann", FULL],
      ["Miguel Fernando Marquez", SHORT],
      ["Jack Daniels", SHORT],
    );
    expect(on(series, "Giorgia Morone", SHORT)).toBeNull();
    expect(on(series, "Giorgia Morone", FULL)).toBeNull();
    expect(on(series, "Jeremiah Schwartzmann", FULL)).toBeNull();
    expect(on(series, "Miguel Fernando Marquez", SHORT)).toBeNull();
    expect(on(series, "Jack Daniels", SHORT)).toBe("cancelled");
    // Only the days picked.
    expect(on(series, "Jeremiah Schwartzmann", SHORT)).toBe("booked");
  });

  it("opens a vacancy by withdrawing a booking, so the next offer that day is sent", () => {
    const series = send(withdraw(weekdays(), ["Jeremiah Schwartzmann", FULL]), ["Marilyn Calzoni", FULL]);
    expect(on(series, "Marilyn Calzoni", FULL)).toBe("offered");
  });

  it("counts only those booked in a day's fill: a withdrawn booking lowers it, an offer sent doesn't", () => {
    expect(bookedOn(weekdays(), FULL)).toBe(6);
    const sent = send(weekdays(), ["Marilyn Calzoni", FULL], ["Marilyn Calzoni", SHORT]);
    expect([bookedOn(sent, FULL), bookedOn(sent, SHORT)]).toEqual([6, 5]);
    const withdrawn = withdraw(sent, ["Jeremiah Schwartzmann", FULL], ["Giorgia Morone", SHORT], ["Jack Daniels", SHORT]);
    expect([bookedOn(withdrawn, FULL), bookedOn(withdrawn, SHORT)]).toEqual([5, 5]);
    expect(entryOn(withdrawn, FULL)).toEqual({ filled: 5, total: 6 });
    // Offered again, still not booked.
    expect(bookedOn(send(withdrawn, ["Jeremiah Schwartzmann", FULL]), FULL)).toBe(5);
  });

  it("forgets what was sent or withdrawn on a day taken off the schedule, so it comes back unfilled", () => {
    const series = withdraw(send(weekdays(), ["Marilyn Calzoni", SHORT]), ["Jeremiah Schwartzmann", SHORT]);
    const off = reschedule([series], "weekdays", series.dates.filter((date) => date !== SHORT), true);
    const back = weekdays(reschedule(off, "weekdays", series.dates, true));
    expect(on(back, "Marilyn Calzoni", SHORT)).toBeNull();
    expect(on(back, "Jeremiah Schwartzmann", SHORT)).toBeNull();
    expect(on(back, "Jeremiah Schwartzmann", FULL)).toBe("booked");
    expect(on(weekdays(reschedule([series], "weekdays", series.dates, true)), "Marilyn Calzoni", SHORT)).toBe("offered");
  });

  it("lists who's been sent an offer among those offered", () => {
    const series = send(weekdays(), ["Marilyn Calzoni", SHORT]);
    expect(names(series, { show: "offered" })).toContain("Marilyn Calzoni");
  });

  it("counts the days picked each action would change: those available to send to, the rest but cancellations to withdraw", () => {
    const series = weekdays();
    const actions = (...picked: [string, string][]) =>
      offerActions(series, TODAY, picked.map(([name, date]) => day(series, name, date)));
    expect(actions(["Marilyn Calzoni", SHORT], ["Marilyn Calzoni", FULL])).toEqual({ send: 2, withdraw: 0 });
    expect(actions(["Jeremiah Schwartzmann", FULL])).toEqual({ send: 0, withdraw: 1 });
    expect(actions(["Giorgia Morone", SHORT], ["Giorgia Morone", FULL])).toEqual({ send: 0, withdraw: 2 });
    expect(actions(["Jack Daniels", SHORT])).toEqual({ send: 0, withdraw: 0 });
    expect(actions(["Marilyn Calzoni", SHORT], ["Giorgia Morone", SHORT])).toEqual({ send: 1, withdraw: 1 });
    expect(actions()).toEqual({ send: 0, withdraw: 0 });
  });
});
