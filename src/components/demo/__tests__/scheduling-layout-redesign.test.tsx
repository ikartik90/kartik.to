// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { SchedulingLayoutRedesign } from "../scheduling-layout-redesign";

afterEach(cleanup);

/**
 * Which of the two arrangements is being SHOWN. Both stay mounted so the toggle
 * can morph between them, so "presented" is a state the pane carries rather
 * than a question of whether it exists.
 */
function presented(pane: HTMLElement): boolean {
  return pane.getAttribute("aria-hidden") !== "true";
}

const pickSegment = (name: string) =>
  fireEvent.click(screen.getByRole("option", { name }));

const selectedSegments = () =>
  screen
    .getAllByRole("option")
    .filter((option) => option.getAttribute("aria-selected") === "true")
    .map((option) => option.textContent);

describe("SchedulingLayoutRedesign — the toggle", () => {
  it("opens on the arrangement being argued against", () => {
    render(<SchedulingLayoutRedesign />);

    expect(selectedSegments()).toEqual(["Before"]);
    expect(presented(screen.getByTestId("before-pane"))).toBe(true);
    expect(presented(screen.getByTestId("after-pane"))).toBe(false);
  });

  it("swaps which arrangement is presented when the other segment is picked", () => {
    render(<SchedulingLayoutRedesign />);

    pickSegment("After");

    expect(selectedSegments()).toEqual(["After"]);
    expect(presented(screen.getByTestId("after-pane"))).toBe(true);
    expect(presented(screen.getByTestId("before-pane"))).toBe(false);
  });

  it("goes back, so the comparison can be read in either direction", () => {
    render(<SchedulingLayoutRedesign />);

    pickSegment("After");
    pickSegment("Before");

    expect(selectedSegments()).toEqual(["Before"]);
    expect(presented(screen.getByTestId("before-pane"))).toBe(true);
  });

  // The two arrangements cross-fade into each other, and a pane that unmounted
  // the moment it went off would have nothing left to fade OUT — the morph
  // would read as a hard cut with a delay in front of it.
  it("keeps both arrangements mounted across the toggle", () => {
    render(<SchedulingLayoutRedesign />);

    pickSegment("After");
    expect(screen.getByTestId("before-pane")).toBeTruthy();

    pickSegment("Before");
    expect(screen.getByTestId("after-pane")).toBeTruthy();
  });
});

describe("SchedulingLayoutRedesign — what each arrangement says", () => {
  // The redlines ARE the argument about the old layout: two separate concerns
  // bracketed on either side of one screen.
  it("redlines the two concerns the old screen crams together", () => {
    render(<SchedulingLayoutRedesign />);

    const redlines = screen.getByTestId("redlines");
    expect(within(redlines).getByText("Shift Information")).toBeTruthy();
    expect(within(redlines).getByText("Shift Planning")).toBeTruthy();
  });

  it("withdraws the redlines with the arrangement they annotate", () => {
    render(<SchedulingLayoutRedesign />);
    expect(presented(screen.getByTestId("redlines"))).toBe(true);

    pickSegment("After");
    expect(presented(screen.getByTestId("redlines"))).toBe(false);
  });

  it("names the three steps the redesign splits that screen into", () => {
    render(<SchedulingLayoutRedesign />);

    const after = screen.getByTestId("after-pane");
    expect(
      within(after)
        .getAllByTestId("step-name")
        .map((name) => name.textContent),
    ).toEqual(["Shift Information", "Shift Planning", "Review Shift Summary"]);
  });

  // The first two steps are the two concerns the redline brackets called out,
  // in that order — which is the whole point the pair of frames is making.
  it("carries the redlined concerns over as the first two steps", () => {
    render(<SchedulingLayoutRedesign />);

    const redlined = within(screen.getByTestId("redlines"))
      .getAllByTestId("redline-label")
      .map((label) => label.textContent);
    const steps = within(screen.getByTestId("after-pane"))
      .getAllByTestId("step-name")
      .map((name) => name.textContent);

    expect(steps.slice(0, 2)).toEqual(redlined);
  });
});

describe("SchedulingLayoutRedesign — a diagram, not a wizard", () => {
  it("offers nothing in the new arrangement to press", () => {
    render(<SchedulingLayoutRedesign />);
    pickSegment("After");

    const after = screen.getByTestId("after-pane");
    expect(within(after).queryAllByRole("button")).toHaveLength(0);
    expect(within(after).queryAllByRole("tab")).toHaveLength(0);
  });

  it("offers nothing in the old arrangement to press either", () => {
    render(<SchedulingLayoutRedesign />);

    const before = screen.getByTestId("before-pane");
    expect(within(before).queryAllByRole("button")).toHaveLength(0);
    expect(within(before).queryAllByRole("combobox")).toHaveLength(0);
  });

  // The segmented control is the ONE live thing on the stage, so it is the one
  // thing a keyboard can reach. The wireframed fields are REAL controls — a
  // Combobox button, a Checkbox button — so they are still in the DOM; what
  // keeps them out of the tab order is the `inert` their scope carries, and
  // that is the thing worth pinning.
  it("leaves the segmented control as the only reachable control", () => {
    const { container } = render(<SchedulingLayoutRedesign />);

    const reachable = Array.from(
      container.querySelectorAll(
        "a[href], button, input, select, textarea, [tabindex]",
      ),
    ).filter((node) => !node.closest("[inert]"));

    expect(
      reachable.every((node) => node.closest('[role="listbox"]') !== null),
    ).toBe(true);
    expect(reachable.length).toBeGreaterThan(0);
  });
});
