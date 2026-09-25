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
  // The tour only runs where an IntersectionObserver exists; unstubbing keeps it out of other cases.
  vi.unstubAllGlobals();
});

// Frozen at module scope, since TODAY is read at import. A mid-month Monday keeps every
// reach below in one month and one row; the tour's timers are faked with it.
vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
afterAll(() => vi.useRealTimers());

const TODAY = Temporal.Now.plainDateISO();

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

const dayName = (date: Temporal.PlainDate) =>
  `${FULL_MONTHS[date.month - 1]} ${date.day}, ${date.year}`;

/** The owned cell; a spill-over copy shares its accessible name. */
function day(date: Temporal.PlainDate): HTMLButtonElement {
  const matches = screen.getAllByRole("gridcell", { name: dayName(date) });
  return (matches.find((c) => !c.hasAttribute("data-outside")) ??
    matches[0]) as HTMLButtonElement;
}

const wireframeScope = (container: HTMLElement) =>
  container.querySelector('[class*="wireframe"]') as HTMLElement;

/** Long enough for the whole tour. */
const play = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(12_000);
  });

/** Past the last pick, short of the exit fade (≈3.9s at the hook's floor in jsdom). */
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
    expect(scope.querySelector("input")).toBeNull();
    expect(scope.querySelectorAll('[role="checkbox"]').length).toBe(1);
    expect(within(scope).queryAllByRole("checkbox").length).toBe(0);
    expect(within(scope).queryByRole("textbox")).toBeNull();
    expect(scope.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(4);
  });

  it("keeps the calendar column live and outside the wireframe", () => {
    const { container } = render(<ShiftSchedulingV0 />);
    const scope = wireframeScope(container);
    const grid = screen.getByRole("grid");
    expect(scope.contains(grid)).toBe(false);

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

    // jsdom lays nothing out, so the band needs synthetic rects to intersect.
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
      expect(dates.map((date) => date.day)).toEqual(
        [...dates.map((date) => date.day)].sort((a, b) => a - b),
      );
      expect(new Set(dates.map(String)).size).toBe(4);
    }
  });
});

describe("ShiftSchedulingV0 — the in-view walkthrough", () => {
  it("stays still until the demo is actually on screen", async () => {
    scrollIntoView();
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
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    const taken = selectedDates().length;
    expect(taken).toBeGreaterThan(0);

    fireEvent.pointerDown(screen.getByRole("grid"));
    await play();

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
    fireEvent.click(day(TODAY));

    fireEvent.click(screen.getByRole("button", { name: "Play Demo" }));
    await playToLastPick();

    const planned = planDemoShiftDates(TODAY);
    expect(selectedDates()).toHaveLength(planned.length);
    expect(day(TODAY).getAttribute("aria-selected")).toBe("false");
  });

  it("withholds reset until the board carries something to clear", () => {
    render(<ShiftSchedulingV0 />);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    fireEvent.click(day(TODAY));
    expect(screen.getByRole("button", { name: "Reset Demo" })).toBeTruthy();
  });

  it("keeps reset off the rail while the walkthrough is picking", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(selectedDates().length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    await play();
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
  });

  it("stops the walkthrough where it stands, keeping its picks", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    const picked = selectedDates().length;
    expect(picked).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Stop Demo" }));
    await play();
    expect(selectedDates()).toHaveLength(picked);
    expect(screen.getByRole("button", { name: "Play Demo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset Demo" })).toBeTruthy();
  });

  it("clears the board on request, once the visitor has taken the stage", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV0 />);

    reveal();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(selectedDates().length).toBeGreaterThan(0);

    fireEvent.pointerDown(day(TODAY));
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(selectedDates()).toHaveLength(0);

    await play();
    expect(selectedDates()).toHaveLength(0);
  });

  it("names both controls for a screen reader and labels them on hover", () => {
    render(<ShiftSchedulingV0 />);
    fireEvent.click(day(TODAY));
    const replay = screen.getByRole("button", { name: "Play Demo" });
    const reset = screen.getByRole("button", { name: "Reset Demo" });

    expect(reset.compareDocumentPosition(replay)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(shown(screen.getByText("Play Demo").parentElement)).toBe(false);
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
