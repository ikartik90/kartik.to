// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { DemoControls } from "../demo-controls";

afterEach(cleanup);

describe("DemoControls", () => {
  it("groups the pair into one toolbar, named for a screen reader", () => {
    render(<DemoControls onReplay={() => {}} onReset={() => {}} />);
    const toolbar = screen.getByRole("toolbar", { name: "Demo controls" });
    // DOM order is the visual order is the tab order: reset inboard, replay in
    // the corner itself.
    expect(
      within(toolbar)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Reset Demo", "Replay Demo"]);
  });

  // The toolbar owns the SEMANTICS and nothing else — no roving cursor, the
  // same call `OptionList.Toolbar` makes. Two controls do not need a keyboard
  // mode of their own, and taking one of them out of the tab order would cost
  // more than the grouping is worth.
  it("leaves both controls in the tab order", () => {
    render(<DemoControls onReplay={() => {}} onReset={() => {}} />);
    for (const button of screen.getAllByRole("button"))
      expect(button.getAttribute("tabindex")).toBeNull();
  });

  it("wires each control to its own handler", () => {
    const onReplay = vi.fn();
    const onReset = vi.fn();
    render(<DemoControls onReplay={onReplay} onReset={onReset} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReplay).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Replay Demo" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
