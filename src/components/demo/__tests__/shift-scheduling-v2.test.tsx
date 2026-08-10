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
  // The demo only performs itself where an IntersectionObserver exists, so
  // dropping the stub is what keeps the walkthrough OUT of every other case.
  vi.unstubAllGlobals();
});

// The demo reads the real clock, so every expectation is DERIVED from it the
// same way the component is — asserting fixed dates here would only re-pin what
// the component deliberately stopped pinning. What IS pinned is the clock those
// derivations read, which keeps the deriving intact while stopping the suite
// from rotting on a given day. It has to be frozen at module scope, since TODAY
// is read here at import time; the component reads it later, at mount (the lazy
// `openingMonth` initialiser), so it sees the same frozen date. Only `Date` is
// faked, so React's and testing-library's timers stay real.
//
// The anchor is deliberately mid-month AND a Monday: these tests reach up to
// two days forward, and on a month-end TODAY those reaches cross into the next
// month COLUMN — the marquee then sweeps a band across the 250px gap between
// grids and takes an unrelated run of cells (this suite failed with a July 10th
// block selected for a July 31 → August 2 drag). A late-week TODAY breaks the
// same-row assumption the same way. It fired only on the 30th/31st, and so only
// in CI, which runs UTC ahead of local.
//
// The timers go with the clock: the walkthrough is a chain of `setTimeout`s, so
// the suite drives that too rather than sitting out seven seconds of animation.
// React's own scheduling stays real.
vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
afterAll(() => vi.useRealTimers());

const TODAY = Temporal.Now.plainDateISO();
// The month the walkthrough draws its shifts in — a roster is written forward.
const SHIFT_MONTH = TODAY.add({ months: 1 });
// First-of-month, one month before that: where the three-month range opens, so
// the month being drawn on is the middle column.
const OPENING = TODAY.with({ day: 1 });

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

// Read off the `role` attribute the calendar sets rather than through
// `getAllByRole`, which is the same set of cells by a far dearer route: RTL
// COMPUTES a role for every node and then tests each for accessible visibility,
// which in jsdom means a `getComputedStyle` walk per element. `play()` samples
// the board 120 times over three month grids, so that is ~15,000 role
// computations per run — enough on its own to push the heaviest case past the
// suite's per-test budget on a slower machine, which is exactly what it did in
// CI. The empty check keeps what the role query gave for free: if the calendar
// is not on screen at all, say so loudly instead of returning "nothing is
// selected" and letting an assertion pass over a broken render.
function selected(): (string | null)[] {
  const cells = [...document.querySelectorAll("[role=gridcell]")];
  if (!cells.length) throw new Error("selected(): no calendar on screen");
  return cells
    .filter((c) => c.getAttribute("aria-selected") === "true")
    .map((c) => c.getAttribute("data-date"));
}

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

/** Press on `from`, drag the band to `to`, release. */
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

/** Long enough for the whole performance, finale and withdrawal included. */
const WHOLE_TOUR_MS = 12_000;

/**
 * Runs the walkthrough, sampling the board as it goes. The frames matter
 * because the tour CLEARS what it drew on its way out — the finished work only
 * exists mid-run, so an assertion made at the end would be an assertion about
 * an empty grid.
 */
async function play(): Promise<(string | null)[][]> {
  const frames: (string | null)[][] = [];
  for (let elapsed = 0; elapsed < WHOLE_TOUR_MS; elapsed += 100) {
    await advance(100);
    frames.push(selected());
  }
  return frames;
}

/**
 * The distinct boards the walkthrough put up, in order, as comparable strings.
 *
 * Deliberately NOT "the fullest frame it reached": the sweep and the hand edit
 * land on the SAME count — 15 either way, since the swap gives one date up and
 * takes another — so picking by length would be picking between two different
 * boards on a tie, and which one won would come down to which frames the
 * sampler happened to catch. Asking whether a board was ever up is the question
 * the cases actually mean, and it cannot be decided by sampling luck.
 */
function boardsShown(frames: (string | null)[][]): string[] {
  const boards: string[] = [];
  for (const frame of frames) {
    const board = frame.join(",");
    if (board !== boards.at(-1)) boards.push(board);
  }
  return boards;
}

/** `finishedBoard()` in the form `boardsShown` returns. */
const finished = () => finishedBoard().join(",");

/** The board the walkthrough is trying to build: the sweep, less one, plus one. */
function finishedBoard(): string[] {
  const plan = planDemoSweep(SHIFT_MONTH);
  return [...plan.dates.filter((date) => !date.equals(plan.drop)), plan.add]
    .sort(Temporal.PlainDate.compare)
    .map((date) => date.toString());
}

// The plan is checked against the SPEC — working weeks, one month, a brief that
// asks for 15 to 25 shifts — rather than against the block this month happens to
// produce, so it stays a test of the rule and not of July 2026.
describe("planDemoSweep", () => {
  /** Every month of three years, so no arrangement of a month goes untried. */
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

  // The range runs wider than the form and its outer columns are half-cut by
  // design, so a date drawn in either of them is a date nobody can see. Only
  // the middle month — today's — is fully on screen.
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
      // Whole weeks, so the rectangle has no ragged corner to explain.
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

  // The edit the sweep leaves you to make by hand: a rectangle cannot reach a
  // weekend, so swapping a working day for a Saturday is exactly the shape of
  // change a click is still for.
  it("gives up a swept working day and takes the weekend beside it", () => {
    for (const month of MONTHS) {
      const { dates, drop, add } = planDemoSweep(month);
      const swept = dates.map((date) => date.toString());
      expect(swept).toContain(drop.toString());
      expect(swept).not.toContain(add.toString());
      expect(add.dayOfWeek).toBe(6);
      // Same week, so the swap reads as one decision rather than two.
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

  // Where the block lands is load-bearing, not cosmetic: the range is wider
  // than the form and its outer columns are cropped at the frame, so the middle
  // is the only one wholly on screen.
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

  // The chevrons walk the range rather than paging it: two of the three months
  // stay on screen, so a run drawn across a boundary is still in view while you
  // extend it into the month you just brought in.
  it("advances the window one month per chevron press", () => {
    render(<ShiftSchedulingV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(
      screen.getByText(monthLabel(OPENING.add({ months: 1 }))),
    ).toBeTruthy();
    expect(
      screen.getByText(monthLabel(OPENING.add({ months: 3 }))),
    ).toBeTruthy();
    expect(screen.queryByText(monthLabel(OPENING))).toBeNull();
  });

  it("walks back one month at a time too", () => {
    render(<ShiftSchedulingV2 />);
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(
      screen.getByText(monthLabel(OPENING.subtract({ months: 1 }))),
    ).toBeTruthy();
    expect(
      screen.getByText(monthLabel(OPENING.add({ months: 1 }))),
    ).toBeTruthy();
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

  // The sweep is the demo's whole point and nothing in the chrome shows it, so
  // the calendar volunteers it at the cursor — until you've done it once.
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
    // Shrink the band back to the press cell — `far` leaves it and reverts.
    fireEvent.pointerMove(window, { clientX: a.x + 4, clientY: a.y });
    expect(selected()).not.toContain(far.toString());
    fireEvent.pointerUp(window);
  });
});

// These cases budget WALL CLOCK for SIMULATED time: each drives some twelve
// seconds of animation, and the replay case twice that, so the runner's 5s
// default was never the right unit for them. The explicit ceiling is not there
// to be approached — the whole file passes under 500ms a case — but to keep a
// slow machine from timing one out, because of what a timeout does HERE: the
// abandoned test leaves React's act queue open, every later render in the file
// mounts into it and is never flushed, and five more cases fail claiming the
// calendar does not exist. One slow case takes the suite down with five
// misleading errors on top, and the real one at the bottom.
describe("ShiftSchedulingV2 — the walkthrough", { timeout: 15_000 }, () => {
  /** Render with a grid the marquee can actually intersect, ready to be seen. */
  function stage() {
    const reveal = scrollIntoView();
    const view = render(<ShiftSchedulingV2 />);
    // Before the reveal, so the cells are measurable by the time the band opens
    // over them — a drag snapshots their boxes at the press.
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
    // A band grows: the count climbs through intermediate sizes on its way to
    // the full block. Clicking the dates one at a time would climb too — but a
    // single frame would never gain more than one date, and this one gains a
    // whole row of the grid at a time.
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
    // Far enough in to be mid-drag, with a partial band committed.
    await advance(2200);
    const partial = selected();
    expect(partial.length).toBeGreaterThan(0);

    act(() => {
      container.firstElementChild!.dispatchEvent(
        new Event("pointerdown", { bubbles: true }),
      );
    });
    await advance(WHOLE_TOUR_MS);

    // Whatever it had drawn stays drawn — it was committed the same way a
    // person's own drag would have been — and nothing is added after.
    expect(selected()).toEqual(partial);
    // The cursor bows out where it stands rather than unmounting, so what says
    // it has gone is the visibility, not the element.
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
    // Reset is offered against WORK, and an empty grid is already the state it
    // hands back — so a shift has to be drawn on before there is a pair at all.
    expect(controlNames()).toEqual(["Replay Demo"]);

    fireEvent.click(day(SHIFT_MONTH.with({ day: 6 })));
    expect(controlNames()).toEqual(["Reset Demo", "Replay Demo"]);
  });

  // ...and "back to how it started" is a moving target while the walkthrough is
  // still drawing, so the offer waits for the performance to be over.
  it("keeps reset off the rail while the walkthrough is drawing", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2600);
    expect(selected().length).toBeGreaterThan(0);
    expect(controlNames()).toEqual(["Replay Demo"]);

    // And gone again at the other end, since the run puts the grid back.
    await advance(WHOLE_TOUR_MS);
    expect(controlNames()).toEqual(["Replay Demo"]);
  });

  it("replays on request, over a board it clears first", async () => {
    const { reveal } = stage();
    reveal();
    await play();
    await advance(WHOLE_TOUR_MS);

    fireEvent.click(screen.getByRole("button", { name: "Replay Demo" }));
    // The sweep TOGGLES, so a replay run over dates still on the board would
    // rub them out rather than draw them again.
    expect(boardsShown(await play())).toContain(finished());
  });

  it("clears the board on reset, once the visitor has taken the stage", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2600);
    expect(selected().length).toBeGreaterThan(0);

    // Touching the grid stands the show down — which is what hands the control
    // back, with the shifts it had already drawn still on the board.
    fireEvent.pointerDown(day(SHIFT_MONTH.with({ day: 6 })));
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(selected()).toEqual([]);
    // Off means off: the rest of the plan doesn't land afterwards.
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
  });

  it("stops where it is and clears the board when the frame scrolls away", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2200);
    expect(selected().length).toBeGreaterThan(0);

    reveal.away();
    // Nobody is watching, so the run is called off AND the board put back —
    // the next thing that happens here is a performance from the top, and it
    // needs a clean grid to draw on.
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

  // The gate is deliberately slack in the middle: a frame parked near the edge
  // must not flicker the performance on and off.
  it("keeps performing while the frame is only half out of view", async () => {
    const { reveal } = stage();
    reveal();
    await advance(2200);
    const partway = selected().length;

    reveal(0.5);
    await advance(WHOLE_TOUR_MS);
    expect(selected()).toEqual([]);
    // It ran on to the end and handed the board back, rather than being cut
    // off where it stood.
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
