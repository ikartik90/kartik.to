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
  // The demo only performs itself where an IntersectionObserver exists, so
  // dropping the stub is what keeps the walkthrough OUT of every other case.
  vi.unstubAllGlobals();
});

// The CLOCK is frozen, not the expectations: every date below is still derived
// from `Temporal.Now` exactly as the component derives it, so this doesn't
// re-pin what the demo leaves live — it just stops the suite depending on which
// day it runs. It has to be frozen at module scope, since TODAY is read here at
// import time.
//
// The timers go with it: the walkthrough is a chain of `setTimeout`s, so the
// suite drives that clock too rather than waiting out ten seconds of animation.
// React's own scheduling stays real.
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

/** Opens the recurrence card the way a visitor would, for the cases about it. */
const openRepeat = () => fireEvent.click(repeatSwitch());

// Sunday-first, matching Temporal's `dayOfWeek % 7` (ISO runs Mon=1…Sun=7).
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]; // prettier-ignore

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]; // prettier-ignore

const weekdayName = (date: Temporal.PlainDate) =>
  WEEKDAY_NAMES[date.dayOfWeek % 7];

/** "Tuesday, 25 August, 2026" — the Notice's own long form. */
const longDate = (date: Temporal.PlainDate) =>
  `${WEEKDAY_NAMES[date.dayOfWeek % 7]}, ${date.day} ${MONTH_NAMES[date.month - 1]}, ${date.year}`;

/**
 * The weekday chips' toolbar, by name — the frame's own Replay/Reset rail is
 * a toolbar too, so an unqualified role query now matches both.
 */
const weekdayToolbar = () =>
  screen.getByRole("toolbar", { name: "Repeat on weekdays" });

/** The accessible names of the weekday chips currently toggled on. */
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

/**
 * Runs the walkthrough right through, sampling the form as it goes. The tour's
 * length depends on how far the cursor has to travel between stops, which jsdom
 * cannot know — so nothing here asserts on a wall-clock instant. What it holds
 * is a series of frames, and the case picks the one it cares about out of it.
 */
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

/**
 * The walkthrough's finished run: the LAST frame holding the most weekdays.
 * Last, not first — the pattern is complete several stops before the end date
 * is, and the first frame at full weekdays still names the opening range.
 */
const peak = (frames: Frame[]) =>
  frames.reduce((best, frame) =>
    frame.weekdays.length >= best.weekdays.length ? frame : best,
  );

// ---------------------------------------------------------------------------

// The walkthrough's arithmetic, checked by COUNTING the range it produces
// rather than by restating the formula that produced it.
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
    // 2026-08-09 is a Sunday.
    const sunday = Temporal.PlainDate.from("2026-08-09");
    expect(planDemoRecurrence(sunday).weekdays).toEqual([
      "sun",
      "tue",
      "thu",
      "sat",
    ]);
  });

  it("wraps the alternation round the end of the week", () => {
    // 2026-08-13 is a Thursday: thu → sat → mon → wed.
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

  // A range that ended on a day the run doesn't repeat on would be describing
  // a last shift that never happens.
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

// ---------------------------------------------------------------------------

describe("ShiftSchedulingV1 — repeat toggle", () => {
  it("opens with the repeat card closed, ready for the walkthrough to open it", () => {
    render(<ShiftSchedulingV1 />);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("false");
    expect(recurrence().getAttribute("data-collapsed")).toBe("true");
    expect(screen.getByText("Shift Date")).toBeTruthy();
  });

  // The switch adds a SECOND date to the form; it does not re-describe the one
  // already filled in. Renaming it under the pointer made the field the visitor
  // had just set look like it had become something else.
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

  // Re-entry from `display: none` needs an @starting-style before-change style,
  // but that also fires on FIRST render — which would play a spurious open
  // animation on page load. `data-armed` gates it to post-interaction only.
  it("does not arm the entry animation until the switch is first touched", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().getAttribute("data-armed")).toBe("false");
    openRepeat();
    expect(recurrence().getAttribute("data-armed")).toBe("true");
  });

  // The Notice fades out WITH the region, so its text must not re-flow mid-exit.
  it("holds the Notice's recurrence sentence steady while the region collapses", () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    fireEvent.click(repeatSwitch());
    expect(notice()).toContain("repeat every");
  });

  // The whole sentence, not a fragment of it: the Notice is what v1 exists to
  // show, so its wording is the specification rather than an implementation
  // detail. A run is a PATTERN bounded by two dates — the pattern leads, and
  // both dates are named in the same breath as the range they bracket.
  it("reads the run as a pattern between two dates", () => {
    render(<ShiftSchedulingV1 />);
    expect(notice()).toBe(
      `This shift will repeat every ${weekdayName(FIRST_SHIFT)} between ` +
        `${longDate(FIRST_SHIFT)} and ${longDate(TODAY.add({ days: 8 }))}.`,
    );
  });

  // Deselecting every weekday leaves the region VISIBLE, so the sentence must
  // fall back to the one thing it can still say.
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

// The recurrence controls are boxed WITH the switch that governs them (Figma
// 901:2365): the switch is the card's header, a rule separates it from what it
// turns on, and everything below that rule folds away together.
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

  // A rule left hanging under the switch is the obvious way this collapse can
  // go wrong, so the divider folds away inside the region with everything else.
  it("folds the card's divider away with the recurrence region", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().contains(screen.getByTestId("repeat-divider"))).toBe(
      true,
    );
  });
});

// Collapsing the recurrence would otherwise shrink the whole dialog, and the
// DemoFrame centres it — so the switch you just clicked would slide out from
// under the pointer. A wireframe block in the footer takes back exactly the
// space the recurrence gave up (Figma 902:2390), holding the dialog's height
// and the switch's position steady.
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

  // It is scenery standing in for the rest of the form, so it must never take
  // focus or be read out — the same contract the shell's header and footer keep.
  it("keeps the counterweight out of the tab order and the a11y tree", () => {
    render(<ShiftSchedulingV1 />);
    const scope = counterweight().firstElementChild;
    expect(scope?.getAttribute("aria-hidden")).toBe("true");
    expect(scope?.hasAttribute("inert")).toBe(true);
  });
});

// The form seeds a plausible near-future run off the real clock, so these are
// derived the same way rather than pinned — a fixed date here would just
// re-introduce what the component stopped hard-coding.
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

  // Seeded from the opening date, NOT bound to it — the toolbar is the user's
  // to edit once they are in the form.
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

// The demo performs itself: repeat on, every other weekday, and a last shift
// far enough out to book 25 of them — then clears the run and hands over a form
// that is open and ready to use.
describe("ShiftSchedulingV1 — walkthrough", () => {
  const PLAN = planDemoRecurrence(FIRST_SHIFT);
  // The toolbar reads its chips out in row order, not in the order the tour
  // presses them, so every comparison against this is order-independent.
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

  // Shut is the walkthrough's starting position, not the demo's resting one:
  // handing back a form with a single switch in it would make the visitor's
  // first act the very click they have just been shown.
  it("leaves the card OPEN when it hands the form over", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    await play();
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
  });

  // The picker hands focus back to its trigger as it closes, so without this
  // the walkthrough leaves the Until field sitting in its focused state,
  // as though the visitor had tabbed into it. Nobody did.
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

  // Rewound, not handed over: a finished run leaves the card OPEN because that
  // is the usable form, but a run nobody saw the end of has to go back to the
  // position the NEXT one starts from — which is the card shut, so its first
  // click has something to open.
  it("rewinds the card shut when the frame scrolls away mid-performance", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();

    // Far enough in for the switch to have been thrown and chips pressed.
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

  // The gate holds its answer between its two lines, so a frame parked near the
  // edge does not flicker the performance on and off.
  it("plays on through a frame that is only half out of view", async () => {
    const reveal = scrollIntoView();
    render(<ShiftSchedulingV1 />);
    reveal();
    await advance(4000);

    reveal(0.5);
    const finished = peak(await play());
    expect(finished.weekdays.sort()).toEqual(PLANNED_NAMES);
  });

  // The visitor got there first — the tour's opening move would be undoing it.
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

    // Far enough in for the switch to have been thrown.
    await advance(1600);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");

    act(() => {
      fireEvent.pointerDown(repeatCard());
    });
    const frames = await play();
    // Whatever it had already committed stays — it committed it the way a
    // visitor would — but nothing more is added, and it never resets.
    expect(peak(frames).weekdays).toEqual([weekdayName(FIRST_SHIFT)]);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
  });

  // Replay is the ONE path that shuts the card again, because the tour's first
  // move is to throw that switch and it needs somewhere to throw it to.
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
    // Far enough in for chips to have been pressed — a run to clear.
    await advance(2600);
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(pressedWeekdays().length).toBeGreaterThan(1);

    // Touching the form stands the show down — which is what hands the control
    // back, with the pattern it had already built still on the form.
    fireEvent.pointerDown(repeatCard());
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(repeatSwitch().getAttribute("aria-checked")).toBe("true");
    expect(pressedWeekdays()).toEqual([weekdayName(FIRST_SHIFT)]);

    // …and the performance really is off: nothing else lands afterwards.
    const frames = await play();
    expect(peak(frames).weekdays).toEqual([weekdayName(FIRST_SHIFT)]);
    expect(notice()).toContain(longDate(TODAY.add({ days: 8 })));
  });

  it("clears a run the visitor built themselves, card and all left open", async () => {
    render(<ShiftSchedulingV1 />);
    openRepeat();
    const toolbar = within(weekdayToolbar());
    // Any weekday but the seeded one, so this adds rather than deselects.
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
    // Reset only exists once there is a pattern to clear.
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

  // Reset is offered against WORK — chips and dates — and NOT against the
  // switch, which reset never puts back either: it always hands the card over
  // open. A form still carrying its seeded pattern has nothing to clear,
  // whichever way that switch happens to be sitting.
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

    // ...and it goes again when the visitor puts the pattern back themselves.
    fireEvent.click(chip);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
  });

  // "Back to how it started" is a moving target while the walkthrough is still
  // building, so the offer waits for the performance to be over — and by then
  // the run has cleared itself, leaving nothing to offer.
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
