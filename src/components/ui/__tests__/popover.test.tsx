// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Popover } from "../popover";

afterEach(cleanup);

const rect = { left: 10, top: 10, width: 20, height: 20 };

describe("Popover", () => {
  it("renders children in a labelled container with a named rect anchor", () => {
    render(
      <Popover
        rect={rect}
        anchorName="--test-anchor"
        className="box"
        role="toolbar"
        ariaLabel="Test menu"
        onDismiss={vi.fn()}
      >
        <button>Item</button>
      </Popover>,
    );
    expect(screen.getByRole("toolbar", { name: "Test menu" })).toBeDefined();
    expect(screen.getByText("Item")).toBeDefined();
    const anchor = document.querySelector<HTMLElement>("[data-popover-anchor]");
    expect(anchor).not.toBeNull();
    // The caller-supplied name threads through to the anchor's CSS anchor-name.
    expect(anchor?.style.getPropertyValue("anchor-name")).toBe("--test-anchor");
  });

  it("omits the synthesized anchor when element-anchored (no rect)", () => {
    render(
      <Popover className="box" role="listbox" ariaLabel="Insert" onDismiss={vi.fn()}>
        <button>Item</button>
      </Popover>,
    );
    expect(screen.getByRole("listbox", { name: "Insert" })).toBeDefined();
    expect(document.querySelector("[data-popover-anchor]")).toBeNull();
  });

  it("dismisses on Escape and on outside pointer-down but not inside", () => {
    const onDismiss = vi.fn();
    render(
      <Popover className="box" ariaLabel="Test menu" onDismiss={onDismiss}>
        <button>Item</button>
      </Popover>,
    );
    fireEvent.pointerDown(screen.getByText("Item"));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("dismisses on scroll only when dismissOnReflow is set", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <Popover className="box" ariaLabel="Test menu" onDismiss={onDismiss}>
        <button>Item</button>
      </Popover>,
    );
    fireEvent.scroll(window);
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(
      <Popover
        className="box"
        ariaLabel="Test menu"
        dismissOnReflow
        onDismiss={onDismiss}
      >
        <button>Item</button>
      </Popover>,
    );
    fireEvent.scroll(window);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
