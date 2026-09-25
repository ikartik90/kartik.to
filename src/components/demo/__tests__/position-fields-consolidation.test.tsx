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

const cutShown = () =>
  screen.getByTestId("crop-fade").getAttribute("data-presented") !== "false";

const before = () => screen.getByTestId("before-pane");
const after = () => screen.getByTestId("after-pane");

describe("PositionFieldsConsolidation — what the old arrangement costs", () => {
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

  it("leaves no field to refuse, and so no refusals", () => {
    render(<PositionFieldsConsolidation />);

    expect(within(after()).queryAllByTestId("disabled-mark")).toHaveLength(0);
  });

  it("gives the position a shape to be read in", () => {
    render(<PositionFieldsConsolidation />);
    pickSegment("After");

    const panel = within(after()).getByTestId("position-summary");
    expect(panel.children.length).toBeGreaterThan(1);
    expect(panel.firstElementChild?.textContent).toContain("View Position");
  });

  it("fits inside the card, so nothing needs fading into the cut", () => {
    render(<PositionFieldsConsolidation />);
    pickSegment("After");

    expect(cutShown()).toBe(false);
  });

  it("keeps the way through to the position it is summarising", () => {
    render(<PositionFieldsConsolidation />);

    expect(within(before()).getByText("Edit Position")).toBeTruthy();
    expect(within(after()).getByText("View Position")).toBeTruthy();
  });
});

describe("PositionFieldsConsolidation — a diagram, not a form", () => {
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
