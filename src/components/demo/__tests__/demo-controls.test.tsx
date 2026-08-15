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

/** The props every case here shares, so each test states only its own. */
const controls = {
  onPlay: () => {},
  onStop: () => {},
  onReset: () => {},
  running: false,
  resettable: true,
};

describe("DemoControls", () => {
  it("groups the pair into one toolbar, named for a screen reader", () => {
    render(<DemoControls {...controls} />);
    const toolbar = screen.getByRole("toolbar", { name: "Demo controls" });
    // DOM order is the visual order is the tab order: reset inboard, the
    // transport in the corner itself.
    expect(
      within(toolbar)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Reset Demo", "Play Demo"]);
  });

  // The toolbar owns the SEMANTICS and nothing else — no roving cursor, the
  // same call `OptionList.Toolbar` makes. Two controls do not need a keyboard
  // mode of their own, and taking one of them out of the tab order would cost
  // more than the grouping is worth.
  it("leaves both controls in the tab order", () => {
    render(<DemoControls {...controls} />);
    for (const button of screen.getAllByRole("button"))
      expect(button.getAttribute("tabindex")).toBeNull();
  });

  // A control that cannot change anything invites a press and answers with
  // nothing. The transport is the whole offer until there is a run to clear.
  it("withholds reset while there is nothing for it to undo", () => {
    render(<DemoControls {...controls} resettable={false} />);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play Demo" })).toBeTruthy();
  });

  // The rail is pinned by its right edge, so the control that is always there
  // keeps the corner and it is the far side that moves. Reset can come and go
  // without shifting anything out from under the pointer.
  it("leaves the transport in the corner whether or not reset is offered", () => {
    const { rerender } = render(
      <DemoControls {...controls} resettable={false} />,
    );
    const toolbar = screen.getByRole("toolbar", { name: "Demo controls" });
    expect(lastControl(toolbar)).toBe("Play Demo");

    rerender(<DemoControls {...controls} />);
    expect(lastControl(toolbar)).toBe("Play Demo");
  });

  // One corner, one transport: a demo that is performing offers the way OUT of
  // the performance, and a demo standing still offers the way in. Both press
  // the same spot, so the control under the pointer is always the one the
  // moment calls for.
  it("swaps play for stop while a run is in flight", () => {
    const { rerender } = render(<DemoControls {...controls} running />);
    const toolbar = screen.getByRole("toolbar", { name: "Demo controls" });
    expect(lastControl(toolbar)).toBe("Stop Demo");
    expect(screen.queryByRole("button", { name: "Play Demo" })).toBeNull();

    rerender(<DemoControls {...controls} />);
    expect(lastControl(toolbar)).toBe("Play Demo");
    expect(screen.queryByRole("button", { name: "Stop Demo" })).toBeNull();
  });

  it("wires each control to its own handler", () => {
    const onPlay = vi.fn();
    const onStop = vi.fn();
    const onReset = vi.fn();
    const { rerender } = render(
      <DemoControls
        {...controls}
        onPlay={onPlay}
        onStop={onStop}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Play Demo" }));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(
      <DemoControls
        {...controls}
        onPlay={onPlay}
        onStop={onStop}
        onReset={onReset}
        running
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop Demo" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
