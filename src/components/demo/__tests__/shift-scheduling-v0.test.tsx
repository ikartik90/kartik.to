// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { ShiftSchedulingV0 } from "../shift-scheduling-v0";

afterEach(cleanup);

// Derived from the real clock the same way the component is — pinning a date
// here would only re-pin what the demo deliberately leaves live.
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
      screen.getByText(/Select one or more dates/i).querySelector(
        "[data-skeleton]",
      ),
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
    const rect = (left: number) =>
      () =>
        ({
          left, top: 0, right: left + 24, bottom: 24,
          width: 24, height: 24, x: left, y: 0, toJSON: () => {},
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
