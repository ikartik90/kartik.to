// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ShiftSchedulingV1 } from "../shift-scheduling-v1";
import {
  DEFAULT_DATE_FORMAT,
  formatCalendarDate,
} from "@/utils/calendar-date";

afterEach(cleanup);

const repeatSwitch = () =>
  screen.getByRole("switch", { name: /repeat this shift on other days/i });

const recurrence = () => screen.getByTestId("recurrence");

const repeatCard = () => screen.getByTestId("repeat-card");

const counterweight = () => screen.getByTestId("repeat-counterweight");

// Sunday-first, matching Temporal's `dayOfWeek % 7` (ISO runs Mon=1…Sun=7).
const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]; // prettier-ignore

const weekdayName = (date: Temporal.PlainDate) =>
  WEEKDAY_NAMES[date.dayOfWeek % 7];

/** The accessible names of the weekday chips currently toggled on. */
const pressedWeekdays = () =>
  within(screen.getByRole("toolbar"))
    .getAllByRole("button")
    .filter((chip) => chip.getAttribute("aria-pressed") === "true")
    .map((chip) => chip.getAttribute("aria-label") ?? "");

describe("ShiftSchedulingV1 — repeat toggle", () => {
  it("labels the first date field 'First Shift' while repeating", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.getByText("First Shift")).toBeTruthy();
    expect(screen.queryByText("Shift Date")).toBeNull();
  });

  it("relabels the date field to 'Shift Date' when repeat is switched off", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
    expect(screen.getByText("Shift Date")).toBeTruthy();
    expect(screen.queryByText("First Shift")).toBeNull();
  });

  it("collapses the weekday toolbar, the Last Shift field AND the Notice as one region", () => {
    render(<ShiftSchedulingV1 />);
    const region = recurrence();
    expect(region.contains(screen.getByRole("toolbar"))).toBe(true);
    expect(region.contains(screen.getByText("Last Shift"))).toBe(true);
    expect(region.contains(screen.getByRole("status"))).toBe(true);
  });

  it("keeps the region expanded and interactive while repeating", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
    expect(recurrence().hasAttribute("inert")).toBe(false);
  });

  it("collapses and inerts the region when repeat is switched off", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-collapsed")).toBe("true");
    expect(recurrence().hasAttribute("inert")).toBe(true);
  });

  it("restores the region and the 'First Shift' label when repeat is switched back on", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
    expect(recurrence().hasAttribute("inert")).toBe(false);
    expect(screen.getByText("First Shift")).toBeTruthy();
  });

  // Re-entry from `display: none` needs an @starting-style before-change style,
  // but that also fires on FIRST render — which would play a spurious open
  // animation on page load. `data-armed` gates it to post-interaction only.
  it("does not arm the entry animation until the switch is first touched", () => {
    render(<ShiftSchedulingV1 />);
    expect(recurrence().getAttribute("data-armed")).toBe("false");
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-armed")).toBe("true");
  });

  // The Notice fades out WITH the region, so its text must not re-flow mid-exit.
  it("holds the Notice's recurrence sentence steady while the region collapses", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
    expect(screen.getByRole("status").textContent).toContain("repeat every");
  });

  // Deselecting every weekday leaves the region VISIBLE, so the sentence must
  // drop the clause it can no longer fill.
  it("drops the Notice's repeat clause when every weekday is deselected", () => {
    render(<ShiftSchedulingV1 />);
    const toolbar = within(screen.getByRole("toolbar"));
    for (const name of pressedWeekdays()) {
      fireEvent.click(toolbar.getByRole("button", { name }));
    }
    expect(pressedWeekdays()).toEqual([]);
    expect(screen.getByRole("status").textContent).not.toContain("repeat every");
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
    expect(repeatCard().contains(screen.getByText("First Shift"))).toBe(false);
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
    expect(counterweight().getAttribute("data-open")).toBe("false");
  });

  it("unfolds the counterweight when repeat is switched off", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
    expect(counterweight().getAttribute("data-open")).toBe("true");
  });

  it("folds it back away when repeat is switched on again", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
    fireEvent.click(repeatSwitch());
    expect(counterweight().getAttribute("data-open")).toBe("false");
  });

  // It is scenery standing in for the rest of the form, so it must never take
  // focus or be read out — the same contract the shell's header and footer keep.
  it("keeps the counterweight out of the tab order and the a11y tree", () => {
    render(<ShiftSchedulingV1 />);
    fireEvent.click(repeatSwitch());
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
  const today = Temporal.Now.plainDateISO();

  it("starts the run tomorrow", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.getByText(format(today.add({ days: 1 })))).toBeTruthy();
  });

  it("ends the run a week after that", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.getByText(format(today.add({ days: 8 })))).toBeTruthy();
  });

  it("describes that range in the Notice", () => {
    render(<ShiftSchedulingV1 />);
    const notice = screen.getByRole("status").textContent ?? "";
    // "Tuesday, 11 August, 2026" — the Notice's own long form, both ends.
    expect(notice).toContain(String(today.add({ days: 1 }).day));
    expect(notice).toContain(String(today.add({ days: 8 }).day));
  });
});

describe("ShiftSchedulingV1 — default repeat weekday", () => {
  const firstShift = Temporal.Now.plainDateISO().add({ days: 1 });

  it("pre-selects only the weekday the first shift falls on", () => {
    render(<ShiftSchedulingV1 />);
    expect(pressedWeekdays()).toEqual([weekdayName(firstShift)]);
  });

  it("names that weekday in the Notice", () => {
    render(<ShiftSchedulingV1 />);
    expect(screen.getByRole("status").textContent).toContain(
      `repeat every ${weekdayName(firstShift)}`,
    );
  });

  // Seeded from the opening date, NOT bound to it — the toolbar is the user's
  // to edit once they are in the form.
  it("leaves the weekday alone once the user has toggled it", () => {
    render(<ShiftSchedulingV1 />);
    const toolbar = within(screen.getByRole("toolbar"));
    fireEvent.click(toolbar.getByRole("button", { name: weekdayName(firstShift) }));
    expect(pressedWeekdays()).toEqual([]);
  });
});
