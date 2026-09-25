// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ShiftSchedulingV2, planDemoSweep } from "../shift-scheduling-v2";
import { scrollIntoView } from "@/test-support";

afterEach(() => {
  cleanup();
  // The tour only runs where an IntersectionObserver exists; unstubbing keeps it out of other cases.
  vi.unstubAllGlobals();
});

// Frozen at module scope, since TODAY is read at import. A mid-month Monday keeps every
// reach below in one month column and one row; the tour's timers are faked with it.
vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
afterAll(() => vi.useRealTimers());

const TODAY = Temporal.Now.plainDateISO();
const SHIFT_MONTH = TODAY.add({ months: 1 });
const OPENING = TODAY.with({ day: 1 });

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]; // prettier-ignore

const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

const monthLabel = (date: Temporal.PlainDate) =>
  `${SHORT_MONTHS[date.month - 1]} ${date.year}`;

const dayName = (date: Temporal.PlainDate) =>
  `${FULL_MONTHS[date.month - 1]} ${date.day}, ${date.year}`;

const gridLabel = (date: Temporal.PlainDate) =>
  `${FULL_MONTHS[date.month - 1]} ${date.year}`;

/** The live page only: the page a chevron pushes away stays on screen, aria-hidden. */
const monthsOnScreen = () =>
  screen.getAllByRole("grid").map((g) => g.getAttribute("aria-label"));

/** The owned cell; a spill copy shares its accessible name. */
function day(date: Temporal.PlainDate): HTMLButtonElement {
  const matches = screen.getAllByRole("gridcell", { name: dayName(date) });
  return (matches.find((c) => !c.hasAttribute("data-outside")) ??
    matches[0]) as HTMLButtonElement;
}

// Not `getAllByRole`: role queries over `play()`'s 120 samples are slow enough to time out in CI.
function selected(): (string | null)[] {
  const cells = [...document.querySelectorAll("[role=gridcell]")];
  if (!cells.length) throw new Error("selected(): no calendar on screen");
  return cells
    .filter((c) => c.getAttribute("aria-selected") === "true")
    .map((c) => c.getAttribute("data-date"));
}

// jsdom lays nothing out: 24px cells on a 28px pitch, month columns 250px apart.
const CELL = 24;
const PITCH = 28;

function layoutGrids() {
  screen.getAllByRole("grid").forEach((grid, monthIndex) => {
    [...grid.children].forEach((el, i) => {
      const left = monthIndex * 250 + (i % 7) * PITCH;
      const top = Math.floor(i / 7) * PITCH;
      (el as HTMLElement).getBoundingClientRect = () =>
        ({
          left,
          top,
          right: left + CELL,
          bottom: top + CELL,
          width: CELL,
          height: CELL,
          x: left,
          y: top,
          toJSON: () => {},
        }) as DOMRect;
    });
  });
}

const centre = (date: Temporal.PlainDate) => {
  const box = day(date).getBoundingClientRect();
  return { x: box.left + CELL / 2, y: box.top + CELL / 2 };
};

function marquee(from: Temporal.PlainDate, to: Temporal.PlainDate) {
  const a = centre(from);
  const b = centre(to);
  fireEvent.pointerDown(day(from), {
    pointerType: "mouse",
    button: 0,
    clientX: a.x,
    clientY: a.y,
  });
  fireEvent.pointerMove(window, { clientX: b.x, clientY: b.y });
  fireEvent.pointerUp(window);
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const WHOLE_TOUR_MS = 12_000;

/** Samples the board through the tour, which clears its work on the way out. */
async function play(): Promise<(string | null)[][]> {
  const frames: (string | null)[][] = [];
  for (let elapsed = 0; elapsed < WHOLE_TOUR_MS; elapsed += 100) {
    await advance(100);
    frames.push(selected());
  }
  return frames;
}

/** The distinct boards shown, in order. Sweep and hand edit tie on count, so length cannot pick. */
function boardsShown(frames: (string | null)[][]): string[] {
  const boards: string[] = [];
  for (const frame of frames) {
    const board = frame.join(",");
    if (board !== boards.at(-1)) boards.push(board);
  }
  return boards;
}

const finished = () => finishedBoard().join(",");

function finishedBoard(): string[] {
  const plan = planDemoSweep(SHIFT_MONTH);
  return [...plan.dates.filter((date) => !date.equals(plan.drop)), plan.add]
    .sort(Temporal.PlainDate.compare)
    .map((date) => date.toString());
}

describe("planDemoSweep", () => {
  const MONTHS = Array.from({ length: 36 }, (_, index) =>
    Temporal.PlainDate.from("2026-01-01").add({ months: index }),
  );

  it("sweeps working days only — a band is a rectangle, so weekends fall out", () => {
    for (const month of MONTHS) {
      const days = planDemoSweep(month).dates.map((date) => date.dayOfWeek);
      expect(Math.min(...days)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...days)).toBeLessThanOrEqual(5);
    }
  });

  it("commits between 15 and 25 shifts in every month there is", () => {
    for (const month of MONTHS) {
      const { dates } = planDemoSweep(month);
      expect(dates.length).toBeGreaterThanOrEqual(15);
      expect(dates.length).toBeLessThanOrEqual(25);
    }
  });

  it("keeps the whole block inside the month that sits in the middle column", () => {
    for (const month of MONTHS) {
      const plan = planDemoSweep(month);
      for (const date of [
        ...plan.dates,
        plan.from,
        plan.to,
        plan.drop,
        plan.add,
      ])
        expect(date.month).toBe(month.month);
    }
  });

  it("pins the band's corners to the first Monday and the last Friday", () => {
    for (const month of MONTHS) {
      const { from, to, dates } = planDemoSweep(month);
      expect(from.dayOfWeek).toBe(1);
      expect(to.dayOfWeek).toBe(5);
      expect(dates[0].equals(from)).toBe(true);
      expect(dates[dates.length - 1].equals(to)).toBe(true);
      expect(dates.length % 5).toBe(0);
    }
  });

  it("takes each week in full, in order", () => {
    for (const month of MONTHS) {
      const { dates } = planDemoSweep(month);
      for (const [index, date] of dates.entries()) {
        expect(date.dayOfWeek).toBe((index % 5) + 1);
        if (index > 0)
          expect(Temporal.PlainDate.compare(date, dates[index - 1])).toBe(1);
      }
    }
  });

  it("gives up a swept working day and takes the weekend beside it", () => {
    for (const month of MONTHS) {
      const { dates, drop, add } = planDemoSweep(month);
      const swept = dates.map((date) => date.toString());
      expect(swept).toContain(drop.toString());
      expect(swept).not.toContain(add.toString());
      expect(add.dayOfWeek).toBe(6);
      expect(add.since(drop).days).toBe(3);
    }
  });
});

describe("ShiftSchedulingV2 — layout", () => {
  it("opens on a three-month window running forward from this month", () => {
    render(<ShiftSchedulingV2 />);
    expect(screen.getByText(monthLabel(TODAY))).toBeTruthy();
    expect(screen.getByText(monthLabel(SHIFT_MONTH))).toBeTruthy();
    expect(
      screen.getByText(monthLabel(OPENING.add({ months: 2 }))),
    ).toBeTruthy();
  });

  it("puts the month the walkthrough draws on in the MIDDLE column", () => {
    render(<ShiftSchedulingV2 />);
    const middle = screen.getAllByRole("grid")[1];
    for (const date of planDemoSweep(SHIFT_MONTH).dates)
      expect(
        middle.querySelector(`[data-date="${date}"]:not([data-outside])`),
      ).toBeTruthy();
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

  it("advances the window one month per chevron press", () => {
    render(<ShiftSchedulingV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(monthsOnScreen()).toEqual(
      [1, 2, 3].map((m) => gridLabel(OPENING.add({ months: m }))),
    );
  });

  it("walks back one month at a time too", () => {
    render(<ShiftSchedulingV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(monthsOnScreen()).toEqual(
      [-1, 0, 1].map((m) => gridLabel(OPENING.add({ months: m }))),
    );
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
    const taken = selected();
    expect(taken).toContain(from.toString());
    expect(taken).toContain(to.toString());
    expect(taken).toContain(from.add({ days: 1 }).toString());
  });

  it("drags a band across the month columns of the range", () => {
    render(<ShiftSchedulingV2 />);
    layoutGrids();
    const first = OPENING.with({ day: 1 });
    const nextMonth = OPENING.add({ months: 1 }).with({ day: 1 });
    marquee(first, nextMonth);
    const taken = selected();
    expect(taken).toContain(first.toString());
    expect(taken).toContain(nextMonth.toString());
  });

  it("offers the drag at the cursor, and drops the offer once you drag", () => {
    render(<ShiftSchedulingV2 />);
    layoutGrids();
    const list = screen.getAllByRole("grid")[0].parentElement!.parentElement!;
    const tip = screen.getByText("Drag to select multiple")
      .parentElement as HTMLElement;

    expect(tip.hasAttribute("data-visible")).toBe(false);
    fireEvent.mouseEnter(list, { clientX: 60, clientY: 80 });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    marquee(TODAY, TODAY.add({ days: 2 }));
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.mouseLeave(list);
    fireEvent.mouseEnter(list, { clientX: 60, clientY: 80 });
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });

  it("reverts a date when the band retreats back off it", () => {
    render(<ShiftSchedulingV2 />);
    layoutGrids();
    const from = TODAY;
    const far = TODAY.add({ days: 2 });
    const a = centre(from);
    fireEvent.pointerDown(day(from), {
      pointerType: "mouse",
      button: 0,
      clientX: a.x,
      clientY: a.y,
    });
    const f = centre(far);
    fireEvent.pointerMove(window, { clientX: f.x, clientY: f.y });
    expect(selected()).toContain(far.toString());
    fireEvent.pointerMove(window, { clientX: a.x + 4, clientY: a.y });
    expect(selected()).not.toContain(far.toString());
    fireEvent.pointerUp(window);
  });
});

// Each case drives ~12s of simulated time. A timeout leaves React's act queue open and
// fails every later case in the file, so the ceiling stays generous.
describe("ShiftSchedulingV2 — the walkthrough", { timeout: 15_000 }, () => {
  function stage() {
    const reveal = scrollIntoView();
    const view = render(<ShiftSchedulingV2 />);
    // Before the reveal: a drag snapshots the cells' boxes at the press.
    layoutGrids();
    return { ...view, reveal };
  }

  it("stays off until the frame is properly on screen", async () => {
    stage();
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
    expect(document.querySelector("[data-demo-cursor]")).toBeNull();
  });

  it("draws the working weeks in one sweep, then swaps a day by hand", async () => {
    const { reveal } = stage();
    reveal();
    expect(boardsShown(await play())).toContain(finished());
  });

  it("commits the sweep as a drag, not as a run of clicks", async () => {
    const { reveal } = stage();
    reveal();
    const frames = await play();
    const gains = frames.map((frame, index) =>
      index === 0 ? 0 : frame.length - frames[index - 1].length,
    );
    expect(Math.max(...gains)).toBeGreaterThan(1);
  });

  it("hands the board back empty when it is done", async () => {
    const { reveal } = stage();
    reveal();
    await play();
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
  });

  it("declines to perform over dates the visitor picked first", async () => {
    const { reveal } = stage();
    const mine = TODAY.add({ days: 3 });
    fireEvent.click(day(mine));

    reveal();
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([mine.toString()]);
  });

  it("lets go of the band the moment a real pointer arrives", async () => {
    const { container, reveal } = stage();
    reveal();
    await advance(2200);
    const partial = selected();
    expect(partial.length).toBeGreaterThan(0);

    act(() => {
      container.firstElementChild!.dispatchEvent(
        new Event("pointerdown", { bubbles: true }),
      );
    });
    await advance(WHOLE_TOUR_MS);

    expect(selected()).toEqual(partial);
    const cursor = document.querySelector("[data-demo-cursor]");
    expect(cursor?.hasAttribute("data-visible")).toBe(false);
  });

  const controlNames = () =>
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((name) => /Demo$/.test(name));

  it("offers the two controls the performance implies", () => {
    stage();
    expect(controlNames()).toEqual(["Play Demo"]);

    fireEvent.click(day(SHIFT_MONTH.with({ day: 6 })));
    expect(controlNames()).toEqual(["Reset Demo", "Play Demo"]);
  });

  it("keeps reset off the rail while the walkthrough is drawing", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2600);
    expect(selected().length).toBeGreaterThan(0);
    expect(controlNames()).toEqual(["Stop Demo"]);

    await advance(WHOLE_TOUR_MS);
    expect(controlNames()).toEqual(["Play Demo"]);
  });

  it("replays on request, over a board it clears first", async () => {
    const { reveal } = stage();
    reveal();
    await play();
    await advance(WHOLE_TOUR_MS);

    fireEvent.click(screen.getByRole("button", { name: "Play Demo" }));
    expect(boardsShown(await play())).toContain(finished());
  });

  it("clears the board on reset, once the visitor has taken the stage", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2600);
    expect(selected().length).toBeGreaterThan(0);

    fireEvent.pointerDown(day(SHIFT_MONTH.with({ day: 6 })));
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(selected()).toEqual([]);
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
  });

  it("stops where it is and clears the board when the frame scrolls away", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2200);
    expect(selected().length).toBeGreaterThan(0);

    reveal.away();
    expect(selected()).toEqual([]);
    expect(document.querySelector("[data-demo-cursor]")).toBeNull();

    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
  });

  it("performs again from the top when the frame comes back", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2200);
    reveal.away();
    await advance(1000);

    reveal();
    expect(boardsShown(await play())).toContain(finished());
  });

  it("keeps performing while the frame is only half out of view", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2200);
    const partway = selected().length;

    reveal(0.5);
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
    expect(partway).toBeGreaterThan(0);
  });

  it("keeps the stand-in cursor out of the accessibility tree", async () => {
    const { reveal } = stage();
    reveal();
    await advance(1200);
    const cursor = document.querySelector("[data-demo-cursor]");
    expect(cursor?.getAttribute("aria-hidden")).toBe("true");
  });
});
