// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ShiftScheduling } from "../shift-scheduling";

afterEach(cleanup);

const repeatSwitch = () =>
  screen.getByRole("switch", { name: /repeat this shift on other days/i });

const recurrence = () => screen.getByTestId("recurrence");

describe("ShiftScheduling — repeat toggle", () => {
  it("labels the first date field 'First Shift' while repeating", () => {
    render(<ShiftScheduling />);
    expect(screen.getByText("First Shift")).toBeTruthy();
    expect(screen.queryByText("Shift Date")).toBeNull();
  });

  it("relabels the date field to 'Shift Date' when repeat is switched off", () => {
    render(<ShiftScheduling />);
    fireEvent.click(repeatSwitch());
    expect(screen.getByText("Shift Date")).toBeTruthy();
    expect(screen.queryByText("First Shift")).toBeNull();
  });

  it("collapses the weekday toolbar, the Last Shift field AND the Notice as one region", () => {
    render(<ShiftScheduling />);
    const region = recurrence();
    expect(region.contains(screen.getByRole("toolbar"))).toBe(true);
    expect(region.contains(screen.getByText("Last Shift"))).toBe(true);
    expect(region.contains(screen.getByRole("status"))).toBe(true);
  });

  it("keeps the region expanded and interactive while repeating", () => {
    render(<ShiftScheduling />);
    expect(recurrence().getAttribute("data-collapsed")).toBe("false");
    expect(recurrence().hasAttribute("inert")).toBe(false);
  });

  it("collapses and inerts the region when repeat is switched off", () => {
    render(<ShiftScheduling />);
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-collapsed")).toBe("true");
    expect(recurrence().hasAttribute("inert")).toBe(true);
  });

  it("restores the region and the 'First Shift' label when repeat is switched back on", () => {
    render(<ShiftScheduling />);
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
    render(<ShiftScheduling />);
    expect(recurrence().getAttribute("data-armed")).toBe("false");
    fireEvent.click(repeatSwitch());
    expect(recurrence().getAttribute("data-armed")).toBe("true");
  });

  // The Notice fades out WITH the region, so its text must not re-flow mid-exit.
  it("holds the Notice's recurrence sentence steady while the region collapses", () => {
    render(<ShiftScheduling />);
    fireEvent.click(repeatSwitch());
    expect(screen.getByRole("status").textContent).toContain("repeat every");
  });

  // Deselecting every weekday leaves the region VISIBLE, so the sentence must
  // drop the clause it can no longer fill.
  it("drops the Notice's repeat clause when every weekday is deselected", () => {
    render(<ShiftScheduling />);
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    fireEvent.click(screen.getByRole("button", { name: "Thursday" }));
    expect(screen.getByRole("status").textContent).not.toContain("repeat every");
  });
});
