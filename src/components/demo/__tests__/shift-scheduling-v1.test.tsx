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
import { renderToString } from "react-dom/server";
import { Temporal } from "@js-temporal/polyfill";
import {
  ShiftSchedulingV1,
  planDemoRecurrence,
  monthsBetween,
} from "../shift-scheduling-v1";
import { WEEKDAY_KEYS, weekdayOf } from "@/utils/calendar-month";
import { scrollIntoView } from "@/test-support";
import { DEFAULT_DATE_FORMAT, formatCalendarDate } from "@/utils/calendar-date";

afterEach(() => {
  cleanup();
  // The tour only runs where an IntersectionObserver exists; unstubbing keeps it out of other cases.
  vi.unstubAllGlobals();
});

// Frozen at module scope, since TODAY is read at import; the walkthrough's timers are faked with it.
vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
afterAll(() => vi.useRealTimers());

const TODAY = Temporal.Now.plainDateISO();
const FIRST_SHIFT = TODAY.add({ days: 1 });

const repeatSwitch = () =>
  screen.getByRole("switch", { name: /repeat this shift on other days/i });

const recurrence = () => screen.getByTestId("recurrence");

const repeatCard = () => screen.getByTestId("repeat-card");

const counterweight = () => screen.getByTestId("repeat-counterweight");

const notice = () => screen.getByRole("status").textContent ?? "";

const openRepeat = () => fireEvent.click(repeatSwitch());

// Sunday-first, for Temporal's `dayOfWeek % 7`.
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]; // prettier-ignore

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

const weekdayName = (date: Temporal.PlainDate) =>
  WEEKDAY_NAMES[date.dayOfWeek % 7];

const longDate = (date: Temporal.PlainDate) =>
  `${WEEKDAY_NAMES[date.dayOfWeek % 7]}, ${date.day} ${MONTH_NAMES[date.month - 1]}, ${date.year}`;

/** By name: the frame's Replay/Reset rail is a toolbar too. */
const weekdayToolbar = () =>
  screen.getByRole("toolbar", { name: "Repeat on weekdays" });

const pressedWeekdays = () =>
  within(weekdayToolbar())
    .getAllByRole("button")
    .filter((chip) => chip.getAttribute("aria-pressed") === "true")
    .map((chip) => chip.getAttribute("aria-label") ?? "");

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

interface Frame {
  repeat: boolean;
  weekdays: string[];
  notice: string;
}

/** Samples the form through the whole tour; jsdom cannot time the cursor's travel. */
async function play(steps = 64, stepMs = 250): Promise<Frame[]> {
  const frames: Frame[] = [];
  for (let step = 0; step < steps; step += 1) {
    await advance(stepMs);
    frames.push({
      repeat: repeatSwitch().getAttribute("aria-checked") === "true",
      weekdays: pressedWeekdays(),
      notice: notice(),
    });
  }
  return frames;
}

/** The last frame with the most weekdays; the first one still names the opening range. */
const peak = (frames: Frame[]) =>
  frames.reduce((best, frame) =>
    frame.weekdays.length >= best.weekdays.length ? frame : best,
  );

describe("planDemoRecurrence", () => {
  const shiftsIn = (first: Temporal.PlainDate, count?: number) => {
    const plan = planDemoRecurrence(first, count);
    const repeats = new Set(plan.weekdays);
    let shifts = 0;
    for (
      let date = first;
      Temporal.PlainDate.compare(date, plan.lastShift) <= 0;
      date = date.add({ days: 1 })
    ) {
      if (repeats.has(weekdayOf(date))) shifts += 1;
    }
    return shifts;
  };

  it("takes every other weekday, opening on the one the first shift falls on", () => {
    const sunday = Temporal.PlainDate.from("2026-08-09");
    expect(planDemoRecurrence(sunday).weekdays).toEqual([
      "sun",
      "tue",
      "thu",
      "sat",
    ]);
  });

  it("wraps the alternation round the end of the week", () => {
    const thursday = Temporal.PlainDate.from("2026-08-13");
    expect(planDemoRecurrence(thursday).weekdays).toEqual([
      "thu",
      "sat",
      "mon",
      "wed",
    ]);
  });

  it("books exactly 25 shifts, whichever weekday the run opens on", () => {
    for (let offset = 0; offset < 7; offset += 1) {
      const first = Temporal.PlainDate.from("2026-08-09").add({ days: offset });
      expect(shiftsIn(first)).toBe(25);
    }
  });

  it("counts to whatever total it is asked for", () => {
    const first = Temporal.PlainDate.from("2026-08-09");
    expect(shiftsIn(first, 1)).toBe(1);
    expect(shiftsIn(first, 7)).toBe(7);
    expect(shiftsIn(first, 40)).toBe(40);
  });

  it("closes the run on a day it actually repeats on", () => {
    const plan = planDemoRecurrence(Temporal.PlainDate.from("2026-08-09"));
    expect(plan.weekdays).toContain(weekdayOf(plan.lastShift));
  });

  it("ends after the day it starts on", () => {
    const first = Temporal.PlainDate.from("2026-08-09");
    expect(
      Temporal.PlainDate.compare(planDemoRecurrence(first).lastShift, first),
    ).toBe(1);
  });
});

describe("monthsBetween", () => {
  it("counts the chevron presses between two months", () => {
    const from = Temporal.PlainDate.from("2026-07-21");
    expect(monthsBetween(from, Temporal.PlainDate.from("2026-07-02"))).toBe(0);
    expect(monthsBetween(from, Temporal.PlainDate.from("2026-08-25"))).toBe(1);
    expect(monthsBetween(from, Temporal.PlainDate.from("2027-01-04"))).toBe(6);
  });
});

describe("ShiftSchedulingV1 — repeat toggle", () => {
  it("opens with the repeat card closed, ready for the walkthrough to open it", () => {
    render(<ShiftSchedulingV1 />);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("false");
    expect(recurrence().getAttribute("data-collapsed")).toBe("true");
    expect(screen.getByText("Shift Date")).toBeTruthy();
  });

  it("leaves the date field labelled 'Shift Date' whether or not it repeats", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    expect(screen.getByText("Shift Date")).toBeTruthy();
    fireEvent.click(repeatSwitch());
    expect(screen.getByText("Shift Date")).toBeTruthy();
  });

  it("collapses the weekday toolbar, the Until field AND the Notice as one region", () => {
    render(<ShiftSchedulingV1 />);
    const region = recurrence();
    expect(region.contains(weekdayToolbar())).toBe(true);
    expect(region.contains(screen.getByText("Until"))).toBe(true);
    expect(region.contains(screen.getByRole("status"))).toBe(true);
  });

  it("keeps the region expanded and interactive while repeating", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
    expect(recurrence().hasAttribute("inert")).toBe(false);
  });

  it("collapses and inerts the region when repeat is switched off", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-collapsed")).toBe("true");
    expect(recurrence().hasAttribute("inert")).toBe(true);
  });

  it("restores the region when repeat is switched back on", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    fireEvent.click(repeatSwitch());
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
    expect(recurrence().hasAttribute("inert")).toBe(false);
  });

  it("does not arm the entry animation until the switch is first touched", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().getAttribute("data-armed")).toBe("false");
    openRepeat();
    expect(recurrence().getAttribute("data-armed")).toBe("true");
  });

  it("holds the Notice's recurrence sentence steady while the region collapses", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    fireEvent.click(repeatSwitch());
    expect(notice()).toContain("repeat every");
  });

  it("reads the run as a pattern between two dates", () => {
    render(<ShiftSchedulingV1 />);
    expect(notice()).toBe(
      `This shift will repeat every ${weekdayName(FIRST_SHIFT)} between ` +
        `${longDate(FIRST_SHIFT)} and ${longDate(TODAY.add({ days: 8 }))}.`,
    );
  });

  it("drops the Notice's repeat clause when every weekday is deselected", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    const toolbar = within(weekdayToolbar());
    for (const name of pressedWeekdays()) {
      fireEvent.click(toolbar.getByRole("button", { name }));
    }
    expect(pressedWeekdays()).toEqual([]);
    expect(notice()).not.toContain("repeat every");
    expect(notice()).toBe(`This shift will start on ${longDate(FIRST_SHIFT)}.`);
  });
});

describe("ShiftSchedulingV1 — repeating shift card", () => {
  it("groups the repeat switch and the recurrence region in one card", () => {
    render(<ShiftSchedulingV1 />);
    expect(repeatCard().contains(repeatSwitch())).toBe(true);
    expect(repeatCard().contains(recurrence())).toBe(true);
  });

  it("keeps the switch out of the region it collapses", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().contains(repeatSwitch())).toBe(false);
  });

  it("stacks the shift date field above the card rather than inside it", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    expect(repeatCard().contains(screen.getByText("Shift Date"))).toBe(false);
  });

  it("folds the card's divider away with the recurrence region", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().contains(screen.getByTestId("repeat-divider"))).toBe(
      true,
    );
  });
});

describe("ShiftSchedulingV1 — collapsed counterweight", () => {
  it("keeps the counterweight folded away while repeating", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    expect(counterweight().getAttribute("data-open")).toBe("false");
  });

  it("unfolds the counterweight when repeat is switched off", () => {
    render(<ShiftSchedulingV1 />);
    expect(counterweight().getAttribute("data-open")).toBe("true");
  });

  it("folds it back away when repeat is switched on again", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    expect(counterweight().getAttribute("data-open")).toBe("false");
  });

  it("keeps the counterweight out of the tab order and the a11y tree", () => {
    render(<ShiftSchedulingV1 />);
    const scope = counterweight().firstElementChild;
    expect(scope?.getAttribute("aria-hidden")).toBe("true");
    expect(scope?.hasAttribute("inert")).toBe(true);
  });
});

describe("ShiftSchedulingV1 — default date range", () => {
  const format = formatCalendarDate(DEFAULT_DATE_FORMAT);

  it("starts the run tomorrow", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.getByText(format(FIRST_SHIFT))).toBeTruthy();
  });

  it("ends the run a week after that", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.getByText(format(TODAY.add({ days: 8 })))).toBeTruthy();
  });

  it("describes that range in the Notice", () => {
    render(<ShiftSchedulingV1 />);
    expect(notice()).toContain(longDate(FIRST_SHIFT));
    expect(notice()).toContain(longDate(TODAY.add({ days: 8 })));
  });
});

describe("ShiftSchedulingV1 — default repeat weekday", () => {
  it("pre-selects only the weekday the first shift falls on", () => {
    render(<ShiftSchedulingV1 />);
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);
  });

  it("names that weekday in the Notice", () => {
    render(<ShiftSchedulingV1 />);
    expect(notice()).toContain(`repeat every ${weekdayName(FIRST_SHIFT)}`);
  });

  it("leaves the weekday alone once the user has toggled it", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    const toolbar = within(weekdayToolbar());
    fireEvent.click(
      toolbar.getByRole("button", { name: weekdayName(FIRST_SHIFT) }),
    );
    expect(pressedWeekdays()).toEqual([]);
  });
});

describe("ShiftSchedulingV1 — walkthrough", () => {
  const PLAN = planDemoRecurrence(FIRST_SHIFT);
  // Sorted: the toolbar reads chips in row order, not press order.
  const PLANNED_NAMES = PLAN.weekdays
    .map((key) => WEEKDAY_KEYS.indexOf(key))
    .map((index) => WEEKDAY_NAMES[index])
    .sort();

  it("stays put until the form is actually on screen", async () => {
    scrollIntoView();
    render(<ShiftSchedulingV1 />);

    await advance(12_000);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("false");
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);
  });

  it("opens the card, fills in the pattern and dates the run to 25 shifts", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    const finished = peak(await play());
    expect(finished.repeat).toBe(true);
    expect(finished.weekdays.sort()).toEqual(PLANNED_NAMES);
    expect(finished.notice).toContain(longDate(PLAN.lastShift));
  });

  it("clears the run it built and puts the dates back", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    await play();
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);
    expect(notice()).toContain(longDate(TODAY.add({ days: 8 })));
  });

  it("leaves the card OPEN when it hands the form over", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    await play();
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
  });

  it("gives up the focus its own clicks took", async () => {
    const reveal = scrollIntoView();
    const { container } = render(<ShiftSchedulingV1 />);
    reveal();

    await play();
    const stage = container.firstElementChild as HTMLElement;
    expect(stage.contains(document.activeElement)).toBe(false);
  });

  it("does not start over while it stays on screen", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();
    await play();

    reveal();
    const frames = await play();
    expect(peak(frames).weekdays).toEqual([weekdayName(FIRST_SHIFT)]);
  });

  it("rewinds the card shut when the frame scrolls away mid-performance", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    await advance(4000);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");

    reveal.away();
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("false");
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);
    expect(document.querySelector("[data-demo-cursor]")).toBeNull();
  });

  it("performs again from the top when the frame comes back", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();
    await advance(4000);
    reveal.away();
    await advance(1000);

    reveal();
    const finished = peak(await play());
    expect(finished.repeat).toBe(true);
    expect(finished.weekdays.sort()).toEqual(PLANNED_NAMES);
    expect(finished.notice).toContain(longDate(PLAN.lastShift));
  });

  it("plays on through a frame that is only half out of view", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();
    await advance(4000);

    reveal(0.5);
    const finished = peak(await play());
    expect(finished.weekdays.sort()).toEqual(PLANNED_NAMES);
  });

  it("declines to perform over a card the visitor has already opened", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    openRepeat();
    reveal();

    const frames = await play();
    expect(peak(frames).weekdays).toEqual([weekdayName(FIRST_SHIFT)]);
  });

  it("gets out of the way the moment a real pointer lands on the form", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    await advance(1600);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");

    act(() => {
      fireEvent.pointerDown(repeatCard());
    });
    const frames = await play();
    expect(peak(frames).weekdays).toEqual([weekdayName(FIRST_SHIFT)]);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
  });

  it("replays on request, rewinding the card shut first", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();
    await play();
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Play Demo" }));
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("false");

    const finished = peak(await play());
    expect(finished.weekdays.sort()).toEqual(PLANNED_NAMES);
  });

  it("clears the run but not the card, once the visitor has taken the stage", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();
    await advance(2600);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(pressedWeekdays().length).toBeGreaterThan(1);

    fireEvent.pointerDown(repeatCard());
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);

    const frames = await play();
    expect(peak(frames).weekdays).toEqual([weekdayName(FIRST_SHIFT)]);
    expect(notice()).toContain(longDate(TODAY.add({ days: 8 })));
  });

  it("clears a run the visitor built themselves, card and all left open", async () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    const toolbar = within(weekdayToolbar());
    const extra = WEEKDAY_NAMES.find(
      (name) => name !== weekdayName(FIRST_SHIFT),
    )!;
    fireEvent.click(toolbar.getByRole("button", { name: extra }));
    expect(pressedWeekdays().length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);
  });

  it("offers replay in the frame's corner with reset inboard of it", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    fireEvent.click(
      within(weekdayToolbar()).getByRole("button", {
        name: WEEKDAY_NAMES.find((name) => name !== weekdayName(FIRST_SHIFT))!,
      }),
    );
    const reset = screen.getByRole("button", { name: "Reset Demo" });
    const replay = screen.getByRole("button", { name: "Play Demo" });
    expect(
      reset.compareDocumentPosition(replay) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("withholds reset until there is a pattern or a date to clear", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    openRepeat();
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    const extra = WEEKDAY_NAMES.find(
      (name) => name !== weekdayName(FIRST_SHIFT),
    )!;
    const chip = within(weekdayToolbar()).getByRole("button", { name: extra });
    fireEvent.click(chip);
    expect(screen.getByRole("button", { name: "Reset Demo" })).toBeTruthy();

    fireEvent.click(chip);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
  });

  it("keeps reset off the rail while the walkthrough is performing", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    await advance(2600);
    expect(pressedWeekdays().length).toBeGreaterThan(1);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();

    await play();
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
  });

  it("keeps the stand-in cursor out of the accessibility tree", async () => {
    const reveal = scrollIntoView();
    const { container } = render(<ShiftSchedulingV1 />);
    reveal();
    await advance(1200);

    const cursor = container.querySelector("[data-demo-cursor]");
    expect(cursor?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("ShiftSchedulingV1 — hydration safety", () => {
  it("renders markup that does not depend on the day the server is on", () => {
    // A full day apart: `plainDateISO` reads the local zone, so a UTC-midnight pair can be one local day.
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
    const buildDay = renderToString(<ShiftSchedulingV1 />);

    vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
    const viewingDay = renderToString(<ShiftSchedulingV1 />);

    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
    expect(viewingDay).toBe(buildDay);
  });
});

describe("shift time range", () => {
  const group = () => screen.getByRole("group", { name: "Shift time" });
  const timeTrigger = (name: "Start Time" | "End Time") => {
    const label = within(group()).getByText(name) as HTMLLabelElement;
    return document.getElementById(label.htmlFor) as HTMLButtonElement;
  };

  const openList = (name: "Start Time" | "End Time") => {
    fireEvent.click(timeTrigger(name));
    return screen.getByRole("dialog", { name: "Choose time" });
  };

  it("opens on a nine-to-five", () => {
    render(<ShiftSchedulingV1 />);
    expect(timeTrigger("Start Time").textContent).toBe("9:00 AM");
    expect(timeTrigger("End Time").textContent).toBe("5:00 PM");
  });

  it("names the clock its hours are quoted in, once, for both fields", () => {
    render(<ShiftSchedulingV1 />);
    // 13 July: daylight saving is in force.
    expect(
      within(group()).getByText("Eastern Daylight Time (UTC-4)"),
    ).toBeTruthy();
  });

  it("measures the end against the start, and the start against nothing", () => {
    render(<ShiftSchedulingV1 />);
    const end = openList("End Time");
    expect(
      within(end).getByRole("option", { name: "5:00 PM, +8 hours" }),
    ).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    const start = openList("Start Time");
    expect(within(start).getAllByRole("option")[0].textContent).toBe("12:00 AM");
    expect(within(start).queryByText(/hours$/)).toBeNull();
  });

  it("re-anchors the end list when the start moves", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(within(openList("Start Time")).getByRole("option", {
      name: "7:00 AM",
    }));
    expect(timeTrigger("Start Time").textContent).toBe("7:00 AM");

    const end = openList("End Time");
    expect(
      within(end).getByRole("option", { name: "5:00 PM, +10 hours" }),
    ).toBeTruthy();
  });

  it("does not put a field around both controls", () => {
    render(<ShiftSchedulingV1 />);
    expect(group().hasAttribute("data-field")).toBe(false);
    const fields = [...document.querySelectorAll("[data-field]")];
    const bothTriggers = fields.filter(
      (f) => f.querySelectorAll('[data-control][aria-haspopup="dialog"]').length > 1,
    );
    expect(bothTriggers).toEqual([]);
  });

  it("hands the hours back on reset", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(within(openList("Start Time")).getByRole("option", {
      name: "7:00 AM",
    }));
    expect(timeTrigger("Start Time").textContent).toBe("7:00 AM");

    fireEvent.click(screen.getByRole("button", { name: /clear|reset/i }));
    expect(timeTrigger("Start Time").textContent).toBe("9:00 AM");
    expect(timeTrigger("End Time").textContent).toBe("5:00 PM");
  });
});
