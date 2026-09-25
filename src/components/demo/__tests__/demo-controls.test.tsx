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

const lastControl = (toolbar: HTMLElement) =>
  within(toolbar)
    .getAllByRole("button")
    .at(-1)
    ?.getAttribute("aria-label");

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
    expect(
      within(toolbar)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Reset Demo", "Play Demo"]);
  });

  it("leaves both controls in the tab order", () => {
    render(<DemoControls {...controls} />);
    for (const button of screen.getAllByRole("button"))
      expect(button.getAttribute("tabindex")).not.toBe("-1");
  });

  it("withholds reset while there is nothing for it to undo", () => {
    render(<DemoControls {...controls} resettable={false} />);
    expect(screen.queryByRole("button", { name: "Reset Demo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play Demo" })).toBeTruthy();
  });

  it("leaves the transport in the corner whether or not reset is offered", () => {
    const { rerender } = render(
      <DemoControls {...controls} resettable={false} />,
    );
    const toolbar = screen.getByRole("toolbar", { name: "Demo controls" });
    expect(lastControl(toolbar)).toBe("Play Demo");

    rerender(<DemoControls {...controls} />);
    expect(lastControl(toolbar)).toBe("Play Demo");
  });

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
