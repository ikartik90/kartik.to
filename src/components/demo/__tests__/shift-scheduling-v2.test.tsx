// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ShiftSchedulingV2 } from "../shift-scheduling-v2";

afterEach(cleanup);

// The demo reads the real clock, so every expectation is DERIVED from it the
// same way the component is — asserting fixed dates here would only re-pin what
// the component deliberately stopped pinning, and would rot on a given day.
const TODAY = Temporal.Now.plainDateISO();
// One month back, first-of-month: where the three-month range opens.
const OPENING = TODAY.subtract({ months: 1 }).with({ day: 1 });

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]; // prettier-ignore

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

/** "Jul 2026" — the narrow label a Calendar.Month renders. */
const monthLabel = (date: Temporal.PlainDate) =>
  `${SHORT_MONTHS[date.month - 1]} ${date.year}`;

/** "July 22, 2026" — a day cell's accessible name. */
const dayName = (date: Temporal.PlainDate) =>
  `${FULL_MONTHS[date.month - 1]} ${date.day}, ${date.year}`;

/** The OWNED cell for a date — a spill copy shares its accessible name. */
function day(date: Temporal.PlainDate): HTMLButtonElement {
  const matches = screen.getAllByRole("gridcell", { name: dayName(date) });
  return (matches.find((c) => !c.hasAttribute("data-outside")) ??
    matches[0]) as HTMLButtonElement;
}

const selected = () =>
  screen
    .getAllByRole("gridcell")
    .filter((c) => c.getAttribute("aria-selected") === "true")
    .map((c) => c.getAttribute("data-date"));

// jsdom lays nothing out, so the marquee has nothing to intersect until the
// cells are given a synthetic grid: 24px cells on a 28px pitch, each month
// column offset by 250px.
const CELL = 24;
const PITCH = 28;

function layoutGrids() {
  screen.getAllByRole("grid").forEach((grid, monthIndex) => {
    [...grid.children].forEach((el, i) => {
      const left = monthIndex * 250 + (i % 7) * PITCH;
      const top = Math.floor(i / 7) * PITCH;
      (el as HTMLElement).getBoundingClientRect = () =>
        ({
          left, top, right: left + CELL, bottom: top + CELL,
          width: CELL, height: CELL, x: left, y: top,
          toJSON: () => {},
        }) as DOMRect;
    });
  });
}

const centre = (date: Temporal.PlainDate) => {
  const box = day(date).getBoundingClientRect();
  return { x: box.left + CELL / 2, y: box.top + CELL / 2 };
};

/** Press on `from`, drag the band to `to`, release. */
function marquee(from: Temporal.PlainDate, to: Temporal.PlainDate) {
  const a = centre(from);
  const b = centre(to);
  fireEvent.pointerDown(day(from), {
    pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
  });
  fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });
  fireEvent.pointerUp(window);
}

describe("ShiftSchedulingV2 — layout", () => {
  it("opens on a three-month window with the CURRENT month in the middle", () => {
    render(<ShiftSchedulingV2 />);
    expect(screen.getByText(monthLabel(OPENING))).toBeTruthy();
    expect(screen.getByText(monthLabel(TODAY))).toBeTruthy();
    expect(screen.getByText(monthLabel(OPENING.add({ months: 2 })))).toBeTruthy();
  });

  it("highlights the real today, with no override pinning it to a fixed date", () => {
    render(<ShiftSchedulingV2 />);
    const todays = screen
      .getAllByRole("gridcell")
      .filter((c) => c.getAttribute("data-state") === "today");
    expect(todays).toHaveLength(1);
    expect(todays[0].getAttribute("data-date")).toBe(TODAY.toString());
  });

  it("labels and hints the calendar as one field", () => {
    render(<ShiftSchedulingV2 />);
    const group = screen.getByRole("group");
    const labelId = group.getAttribute("aria-labelledby");
    const hintId = group.getAttribute("aria-describedby");
    expect(document.getElementById(labelId!)?.textContent).toBe(
      "Scheduling Calendar",
    );
    expect(document.getElementById(hintId!)?.textContent).toMatch(
      /drag across multiple dates/i,
    );
  });

  it("announces every month grid as multi-selectable", () => {
    render(<ShiftSchedulingV2 />);
    const grids = screen.getAllByRole("grid");
    expect(grids).toHaveLength(3);
    for (const grid of grids) {
      expect(grid.getAttribute("aria-multiselectable")).toBe("true");
    }
  });

  it("pages the whole three-month range at once", () => {
    render(<ShiftSchedulingV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Next 3 months" }));
    expect(screen.getByText(monthLabel(OPENING.add({ months: 3 })))).toBeTruthy();
    expect(screen.getByText(monthLabel(OPENING.add({ months: 5 })))).toBeTruthy();
  });

  it("keeps the wireframe chrome around the form", () => {
    render(<ShiftSchedulingV2 />);
    expect(screen.getByText("Post a Shift")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Post Shift")).toBeTruthy();
  });
});

describe("ShiftSchedulingV2 — selection", () => {
  it("starts with nothing selected", () => {
    render(<ShiftSchedulingV2 />);
    expect(selected()).toEqual([]);
  });

  it("does not treat today as a selection", () => {
    render(<ShiftSchedulingV2 />);
    expect(day(TODAY).getAttribute("aria-selected")).toBe("false");
  });

  it("adds a date on click and drops it again on a second click", () => {
    render(<ShiftSchedulingV2 />);
    const target = TODAY.add({ days: 2 });
    fireEvent.click(day(target));
    expect(selected()).toEqual([target.toString()]);
    fireEvent.click(day(target));
    expect(selected()).toEqual([]);
  });

  it("takes a block of dates on a click-and-drag", () => {
    render(<ShiftSchedulingV2 />);
    layoutGrids();
    const from = TODAY;
    const to = TODAY.add({ days: 2 });
    marquee(from, to);
    // A same-row band takes the run between its two ends.
    const taken = selected();
    expect(taken).toContain(from.toString());
    expect(taken).toContain(to.toString());
    expect(taken).toContain(from.add({ days: 1 }).toString());
  });

  it("drags a band across the month columns of the range", () => {
    render(<ShiftSchedulingV2 />);
    layoutGrids();
    // First row of the opening month across to the first row of the next —
    // a thin band that crosses the column gap without taking the rows below.
    const first = OPENING.with({ day: 1 });
    const nextMonth = OPENING.add({ months: 1 }).with({ day: 1 });
    marquee(first, nextMonth);
    const taken = selected();
    expect(taken).toContain(first.toString());
    expect(taken).toContain(nextMonth.toString());
  });

  it("reverts a date when the band retreats back off it", () => {
    render(<ShiftSchedulingV2 />);
    layoutGrids();
    const from = TODAY;
    const far = TODAY.add({ days: 2 });
    const a = centre(from);
    fireEvent.pointerDown(day(from), {
      pointerType: "mouse", button: 0, clientX: a.x, clientY: a.y,
    });
    const f = centre(far);
    fireEvent.pointerMove(window, { clientX: f.x, clientY: f.y });
    expect(selected()).toContain(far.toString());
    // Shrink the band back to the press cell — `far` leaves it and reverts.
    fireEvent.pointerMove(window, { clientX: a.x + 4, clientY: a.y });
    expect(selected()).not.toContain(far.toString());
    fireEvent.pointerUp(window);
  });
});
