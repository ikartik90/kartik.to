// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  within,
} from "@testing-library/react";
import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ShiftSchedulingV0, planDemoShiftDates } from "../shift-scheduling-v0";
import { scrollIntoView } from "@/test-support";

afterEach(() => {
  cleanup();
  // The demo only performs itself where an IntersectionObserver exists, so
  // dropping the stub is what keeps the tour OUT of every unrelated case.
  vi.unstubAllGlobals();
});

// The CLOCK is frozen, not the expectations: every date below is still derived
// from `Temporal.Now` exactly as the component derives it (Calendar reads the
// clock at render), so this doesn't re-pin what the demo leaves live — it just
// stops the suite depending on which day it runs. It has to be frozen at module
// scope, since TODAY is read here at import time. Only `Date` is faked, so
// React's and testing-library's timers stay real.
//
// The anchor is deliberately mid-month AND a Monday: these tests reach up to
// two days forward, and on a month-end TODAY those reaches land on a date the
// grid doesn't own as a selectable cell (only as an outside spill copy), while
// a late-week TODAY pushes them into the next row and out of the marquee's
// same-row band. That is the bug this replaced — it fired only on the 30th/31st,
// and so only in CI, which runs UTC ahead of local.
//
// The timers go with it: the in-view tour is a chain of `setTimeout`s, so the
// suite drives that clock too rather than waiting out five seconds of
// animation. React's own scheduling stays real.
vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
afterAll(() => vi.useRealTimers());

const TODAY = Temporal.Now.plainDateISO();

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

/** "July 22, 2026" — a day cell's accessible name. */
const dayName = (date: Temporal.PlainDate) =>
  `${FULL_MONTHS[date.month - 1]} ${date.day}, ${date.year}`;

/** The OWNED cell for a date — a spill-over copy shares its accessible name. */
function day(date: Temporal.PlainDate): HTMLButtonElement {
  const matches = screen.getAllByRole("gridcell", { name: dayName(date) });
  return (matches.find((c) => !c.hasAttribute("data-outside")) ??
    matches[0]) as HTMLButtonElement;
}

const wireframeScope = (container: HTMLElement) =>
  container.querySelector('[class*="wireframe"]') as HTMLElement;

/** Long enough for the whole tour — opening beat, four stops, exit, hand-back. */
const play = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(12_000);
  });

/**
 * Far enough in for the last date to have been clicked, but short of the exit
 * fade that hands the calendar back. jsdom lays nothing out, so every travel
 * runs at the hook's floor: 500 + 260 + 4 × (260 + 140 + 130) + 3 × 340 ≈ 3.9s.
 */
const playToLastPick = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(4_000);
  });

const selectedDates = () =>
  screen
    .getAllByRole("gridcell")
    .filter((cell) => cell.getAttribute("aria-selected") === "true");

const shown = (tooltip: HTMLElement | null) =>
  Boolean(tooltip?.hasAttribute("data-visible"));

describe("ShiftSchedulingV0", () => {
  it("renders inside the shared Post a Shift shell", () => {
    render(<ShiftSchedulingV0 />);
    expect(screen.getByText("Post a Shift")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Post Shift")).toBeTruthy();
  });

  it("presents the form column as an inert, decorative wireframe", () => {
    const { container } = render(<ShiftSchedulingV0 />);
    const scope = wireframeScope(container);
    expect(scope).toBeTruthy();
    expect(scope.hasAttribute("inert")).toBe(true);
    expect(scope.getAttribute("aria-hidden")).toBe("true");
    // Its fields are shapes, not controls: the text inputs became bars outright,
    // and the parts that remain real elements — the checkbox box, the combobox
    // trigger — are drawn but withheld from the accessibility tree, because the
    // column is scenery. So they exist in the DOM and are absent by role.
    expect(scope.querySelector("input")).toBeNull();
    expect(scope.querySelectorAll('[role="checkbox"]').length).toBe(1);
    expect(within(scope).queryAllByRole("checkbox").length).toBe(0);
    expect(within(scope).queryByRole("textbox")).toBeNull();
    // Label, value and hint across four fields.
    expect(scope.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(4);
  });

  it("keeps the calendar column live and outside the wireframe", () => {
    const { container } = render(<ShiftSchedulingV0 />);
    const scope = wireframeScope(container);
    const grid = screen.getByRole("grid");
    expect(scope.contains(grid)).toBe(false);

    // Its own label and hint stay real text — the calendar is the subject.
    expect(screen.getByText("Scheduling Calendar")).toBeTruthy();
    expect(
      screen
        .getByText(/Select one or more shift dates/i)
        .querySelector("[data-skeleton]"),
    ).toBeNull();
  });

  it("opens with nothing scheduled, then toggles dates on and off", () => {
    render(<ShiftSchedulingV0 />);
    const cell = day(TODAY);
    expect(cell.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(cell);
    expect(day(TODAY).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(day(TODAY));
    expect(day(TODAY).getAttribute("aria-selected")).toBe("false");
  });

  it("takes dates ONE at a time — no marquee sweep", () => {
    render(<ShiftSchedulingV0 />);
    const from = day(TODAY);
    const to = day(TODAY.add({ days: 2 }));

    // jsdom lays nothing out, so give the two cells a synthetic box for the
    // band to intersect; without a rect there is nothing to prove.
    const rect = (left: number) => () =>
      ({
        left,
        top: 0,
        right: left + 24,
        bottom: 24,
        width: 24,
        height: 24,
        x: left,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;
    from.getBoundingClientRect = rect(0);
    to.getBoundingClientRect = rect(56);

    fireEvent.pointerDown(from, {
      pointerType: "mouse",
      button: 0,
      clientX: 12,
      clientY: 12,
    });
    fireEvent.pointerMove(window, { clientX: 68, clientY: 12 });
    fireEvent.pointerUp(window);

    // The press committed nothing on its own, and the drag swept nothing up.
    expect(
      screen
        .getAllByRole("gridcell")
        .filter((c) => c.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);
  });

  it("does not let Shift+Arrow run a range either", () => {
    render(<ShiftSchedulingV0 />);
    fireEvent.keyDown(day(TODAY), { key: "ArrowRight", shiftKey: true });
    expect(
      screen
        .getAllByRole("gridcell")
        .filter((c) => c.getAttribute("aria-selected") === "true"),
    ).toHaveLength(0);
  });

  it("schedules several dates one click at a time — the hint's promise", () => {
    render(<ShiftSchedulingV0 />);
    const second = TODAY.add({ days: 1 });

    fireEvent.click(day(TODAY));
    fireEvent.click(day(second));

    expect(day(TODAY).getAttribute("aria-selected")).toBe("true");
    expect(day(second).getAttribute("aria-selected")).toBe("true");
  });
});

describe("planDemoShiftDates", () => {
  it("picks four upcoming dates, every other day", () => {
    const dates = planDemoShiftDates(Temporal.PlainDate.from("2026-07-13"));
    expect(dates.map(String)).toEqual([
      "2026-07-14",
      "2026-07-16",
      "2026-07-18",
      "2026-07-20",
    ]);
  });

  it("closes the spacing rather than run past the month's end", () => {
    // The 26th of a 31-day month: every-other-day would need the 33rd.
    const dates = planDemoShiftDates(Temporal.PlainDate.from("2026-07-26"));
    expect(dates.map(String)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
    ]);
  });

  it("backs up to fit when even that doesn't — the run stays in one month", () => {
    const dates = planDemoShiftDates(Temporal.PlainDate.from("2026-02-27"));
    expect(dates.map(String)).toEqual([
      "2026-02-25",
      "2026-02-26",
      "2026-02-27",
      "2026-02-28",
    ]);
  });

  it("never leaves the month it starts in, whatever day it is asked on", () => {
    for (let day = 1; day <= 31; day++) {
      const today = Temporal.PlainDate.from({ year: 2026, month: 7, day });
      const dates = planDemoShiftDates(today);
      expect(dates).toHaveLength(4);
      expect(dates.every((date) => date.month === today.month)).toBe(true);
      // Strictly ascending, so the cursor never doubles back on itself.
      expect(dates.map((date) => date.day)).toEqual(
        [...dates.map((date) => date.day)].sort((a, b) => a - b),
      );
      expect(new Set(dates.map(String)).size).toBe(4);
    }
  });
});

describe("ShiftSchedulingV0 — the in-view walkthrough", () => {
  it("stays still until the demo is actually on screen", async () => {
    scrollIntoView(); // observed, but never reported as visible
    render(<ShiftSchedulingV0 />);

    await play();
    expect(selectedDates()).toHaveLength(0);
  });

  it("picks the planned dates when the demo comes into view", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await playToLastPick();

    const planned = planDemoShiftDates(TODAY);
    planned.forEach((date) =>
      expect(day(date).getAttribute("aria-selected")).toBe("true"),
    );
    // Exactly those — nothing swept up on the way between them.
    expect(selectedDates()).toHaveLength(planned.length);
  });

  it("hands the calendar back empty when it has finished", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await play();

    expect(selectedDates()).toHaveLength(0);
  });

  it("does not start over while it stays on screen", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await play();

    reveal();
    await playToLastPick();
    // A second performance would put its four dates back on the board.
    expect(selectedDates()).toHaveLength(0);
  });

  it("stops where it is and clears the board when the demo scrolls away", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(selectedDates().length).toBeGreaterThan(0);

    reveal.away();
    // Nobody is watching it stop, and what happens next here is a performance
    // from the top — which needs an empty grid to pick on.
    expect(selectedDates()).toHaveLength(0);
    expect(document.querySelector("[data-demo-cursor]")).toBeNull();

    await play();
    expect(selectedDates()).toHaveLength(0);
  });

  it("performs again from the top when the demo comes back", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    reveal.away();

    reveal();
    await playToLastPick();
    expect(
      selectedDates().map((cell) => cell.getAttribute("data-date")),
    ).toEqual(planDemoShiftDates(TODAY).map((date) => date.toString()));
  });

  // The gate holds its answer between its two lines, so a demo parked near the
  // edge of the fold does not flicker on and off.
  it("plays on through a demo that is only half out of view", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    reveal(0.5);
    await playToLastPick();
    expect(selectedDates()).toHaveLength(4);
  });

  it("declines to perform over dates the visitor already picked", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    fireEvent.click(day(TODAY));
    reveal();
    await play();

    expect(selectedDates()).toHaveLength(1);
    expect(day(TODAY).getAttribute("aria-selected")).toBe("true");
  });

  it("hands the grid back the moment the visitor presses on it", async () => {
    const reveal = scrollIntoView();
    const { container } = render(<ShiftSchedulingV0 />);

    reveal();
    // One stop in: the opening beat, the fade-in, a move and the first press.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    const taken = selectedDates().length;
    expect(taken).toBeGreaterThan(0);

    fireEvent.pointerDown(screen.getByRole("grid"));
    await play();

    // What it had already committed stands; nothing further was added, and the
    // stand-in cursor withdrew rather than share the grid with a real one.
    expect(selectedDates()).toHaveLength(taken);
    expect(
      container
        .querySelector("[data-demo-cursor]")
        ?.hasAttribute("data-visible"),
    ).toBe(false);
  });

  it("replays on request, over whatever is on the board", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await play();
    // A pick of the visitor's own, which a replay must clear rather than
    // toggle its way around.
    fireEvent.click(day(TODAY));

    fireEvent.click(screen.getByRole("button", { name: "Replay Demo" }));
    await playToLastPick();

    const planned = planDemoShiftDates(TODAY);
    expect(selectedDates()).toHaveLength(planned.length);
    expect(day(TODAY).getAttribute("aria-selected")).toBe("false");
  });

  // Reset is offered against WORK, and an empty board is already the state it
  // hands back — so until dates are on it there is nothing to press.
  it("withholds reset until the board carries something to clear", () => {
    render(<ShiftSchedulingV0 />);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    fireEvent.click(day(TODAY));
    expect(screen.getByRole("button", { name: "Reset Demo" })).toBeTruthy();
  });

  // ...and "back to how it started" is a moving target while the walkthrough is
  // still picking, so the offer waits for the performance to be over.
  it("keeps reset off the rail while the walkthrough is picking", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(selectedDates().length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    // And it is gone again at the other end, since the run puts the board back.
    await play();
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
  });

  it("clears the board on request, once the visitor has taken the stage", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(selectedDates().length).toBeGreaterThan(0);

    // Touching the calendar stands the show down — which is what hands the
    // control back, with the picks it had already made still on the board.
    fireEvent.pointerDown(day(TODAY));
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(selectedDates()).toHaveLength(0);

    // ...and the performance it interrupted does not carry on picking.
    await play();
    expect(selectedDates()).toHaveLength(0);
  });

  it("names both controls for a screen reader and labels them on hover", () => {
    render(<ShiftSchedulingV0 />);
    // Reset only exists once there is a pick to clear.
    fireEvent.click(day(TODAY));
    const replay = screen.getByRole("button", { name: "Replay Demo" });
    const reset = screen.getByRole("button", { name: "Reset Demo" });

    // Replay takes the corner, Reset sits inboard of it — and since nothing
    // reorders the rail visually, that DOM order IS the tab order.
    expect(reset.compareDocumentPosition(replay)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Each carries a decorative twin of that name, hidden until hovered.
    expect(shown(screen.getByText("Replay Demo").parentElement)).toBe(false);
    expect(shown(screen.getByText("Reset Demo").parentElement)).toBe(false);
  });

  it("keeps the stand-in cursor out of the accessibility tree", async () => {
    const reveal = scrollIntoView();
    const { container } = render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    const cursor = container.querySelector("[data-demo-cursor]");
    expect(cursor).toBeTruthy();
    expect(cursor?.getAttribute("aria-hidden")).toBe("true");
  });
});
