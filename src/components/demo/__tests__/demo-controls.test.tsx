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

/** The rail's outermost control — the one sitting in the frame's corner. */
const lastControl = (toolbar: HTMLElement) =>
  within(toolbar)
    .getAllByRole("button")
    .at(-1)
    ?.getAttribute("aria-label");

describe("DemoControls", () => {
  it("groups the pair into one toolbar, named for a screen reader", () => {
    render(<DemoControls onReplay={() => {}} onReset={() => {}} resettable />);
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
    render(<DemoControls onReplay={() => {}} onReset={() => {}} resettable />);
    for (const button of screen.getAllByRole("button"))
      expect(button.getAttribute("tabindex")).toBeNull();
  });

  // A control that cannot change anything invites a press and answers with
  // nothing. Replay is the whole offer until there is a run to clear.
  it("withholds reset while there is nothing for it to undo", () => {
    render(
      <DemoControls
        onReplay={() => {}}
        onReset={() => {}}
        resettable={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Replay Demo" })).toBeTruthy();
  });

  // The rail is pinned by its right edge, so the control that is always there
  // keeps the corner and it is the far side that moves. Reset can come and go
  // without shifting anything out from under the pointer.
  it("leaves replay in the corner whether or not reset is offered", () => {
    const { rerender } = render(
      <DemoControls
        onReplay={() => {}}
        onReset={() => {}}
        resettable={false}
      />,
    );
    const toolbar = screen.getByRole("toolbar", { name: "Demo controls" });
    expect(lastControl(toolbar)).toBe("Replay Demo");

    rerender(<DemoControls onReplay={() => {}} onReset={() => {}} resettable />);
    expect(lastControl(toolbar)).toBe("Replay Demo");
  });

  it("wires each control to its own handler", () => {
    const onReplay = vi.fn();
    const onReset = vi.fn();
    render(<DemoControls onReplay={onReplay} onReset={onReset} resettable />);

    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReplay).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Replay Demo" }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
