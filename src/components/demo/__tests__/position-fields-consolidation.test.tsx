// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { PositionFieldsConsolidation } from "../position-fields-consolidation";

afterEach(cleanup);

const pickSegment = (name: string) =>
  fireEvent.click(screen.getByRole("option", { name }));

/**
 * Whether the cut is being SHOWN. It stays mounted across the toggle — on the
 * way out it outlives the arrangement it belongs to — and, being decorative, it
 * is permanently `aria-hidden`, so `data-presented` is what carries its state.
 */
const cutShown = () =>
  screen.getByTestId("crop-fade").getAttribute("data-presented") !== "false";

const before = () => screen.getByTestId("before-pane");
const after = () => screen.getByTestId("after-pane");

describe("PositionFieldsConsolidation — what the old arrangement costs", () => {
  // The redlines ARE the argument about the old screen, and they name two
  // separate costs rather than one complaint about size.
  it("redlines the two costs of spelling a position out as fields", () => {
    render(<PositionFieldsConsolidation />);

    const redlines = screen.getByTestId("redlines");
    expect(
      within(redlines)
        .getAllByTestId("redline-label")
        .map((label) => label.textContent),
    ).toEqual(["Disabled Fields", "Poor Hierarchy"]);
  });

  it("spells the position out as five fields, every one of them refused", () => {
    render(<PositionFieldsConsolidation />);

    for (const label of [
      "Site Address",
      "Unit",
      "Hourly Wage",
      "Department",
      "Entrance Instructions",
    ]) {
      expect(within(before()).getByText(label)).toBeTruthy();
    }
    expect(within(before()).getAllByTestId("disabled-mark")).toHaveLength(5);
  });

  // The old body is cut off, and the gradient is what says the form continues
  // under the tear rather than ending at it — which is also what lets the
  // right-hand mark run on into dots rather than closing.
  it("crops the old body, and fades it into the cut", () => {
    render(<PositionFieldsConsolidation />);

    expect(cutShown()).toBe(true);
  });
});

describe("PositionFieldsConsolidation — what the new arrangement answers", () => {
  it("reads the position back as one summary panel", () => {
    render(<PositionFieldsConsolidation />);
    pickSegment("After");

    expect(within(after()).getByTestId("position-summary")).toBeTruthy();
    for (const label of ["Site Location", "Hourly Wage", "Department"]) {
      expect(within(after()).getByText(label)).toBeTruthy();
    }
  });

  // The first redline's complaint, answered: there is nothing left to disable
  // because there is nothing left that pretends to be a field.
  it("leaves no field to refuse, and so no refusals", () => {
    render(<PositionFieldsConsolidation />);

    expect(within(after()).queryAllByTestId("disabled-mark")).toHaveLength(0);
  });

  // The second, answered: the flat column becomes a panel with an order to it —
  // a heading row carrying the position's name, and the details ranked beneath.
  // Five things at one weight is what the redline named; this is not that.
  it("gives the position a shape to be read in", () => {
    render(<PositionFieldsConsolidation />);
    pickSegment("After");

    const panel = within(after()).getByTestId("position-summary");
    expect(panel.children.length).toBeGreaterThan(1);
    // The name leads, above everything the panel goes on to say about it.
    expect(panel.firstElementChild?.textContent).toContain("View Position");
  });

  // And the panel fits, so there is nothing running under the tear for a
  // gradient to fade out.
  it("fits inside the card, so nothing needs fading into the cut", () => {
    render(<PositionFieldsConsolidation />);
    pickSegment("After");

    expect(cutShown()).toBe(false);
  });

  // Editing the position was always somewhere else — the old screen said so in
  // a notice above five dead fields, the new one says it once, on the summary.
  it("keeps the way through to the position it is summarising", () => {
    render(<PositionFieldsConsolidation />);

    expect(within(before()).getByText("Edit Position")).toBeTruthy();
    expect(within(after()).getByText("View Position")).toBeTruthy();
  });
});

describe("PositionFieldsConsolidation — a diagram, not a form", () => {
  // Every field in the old arrangement is scenery: a real frame around a bar,
  // never an input. A form you can fill in is a form you read instead of
  // looking at, and what there is to see here is where the parts SIT.
  it("offers nothing in either arrangement to press or type into", () => {
    render(<PositionFieldsConsolidation />);

    for (const pane of [before(), after()]) {
      expect(within(pane).queryAllByRole("button")).toHaveLength(0);
      expect(within(pane).queryAllByRole("textbox")).toHaveLength(0);
      expect(within(pane).queryAllByRole("link")).toHaveLength(0);
    }
  });

  it("leaves the segmented control as the only reachable control", () => {
    const { container } = render(<PositionFieldsConsolidation />);

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
