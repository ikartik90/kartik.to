// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectionPopover } from "../selection-popover";

afterEach(cleanup);

const rect = { left: 10, top: 10, width: 20, height: 20 };

describe("SelectionPopover", () => {
  it("renders children in a labelled toolbar with an anchor", () => {
    render(
      <SelectionPopover rect={rect} ariaLabel="Test menu" onDismiss={vi.fn()}>
        <button>Item</button>
      </SelectionPopover>,
    );
    expect(screen.getByRole("toolbar", { name: "Test menu" })).toBeDefined();
    expect(screen.getByText("Item")).toBeDefined();
    expect(document.querySelector("[data-selection-anchor]")).not.toBeNull();
  });

  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(
      <SelectionPopover rect={rect} ariaLabel="Test menu" onDismiss={onDismiss}>
        <button>Item</button>
      </SelectionPopover>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on outside pointer-down but not inside", () => {
    const onDismiss = vi.fn();
    render(
      <SelectionPopover rect={rect} ariaLabel="Test menu" onDismiss={onDismiss}>
        <button>Item</button>
      </SelectionPopover>,
    );

    fireEvent.pointerDown(screen.getByText("Item"));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on scroll only when dismissOnReflow is set", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <SelectionPopover rect={rect} ariaLabel="Test menu" onDismiss={onDismiss}>
        <button>Item</button>
      </SelectionPopover>,
    );
    fireEvent.scroll(window);
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(
      <SelectionPopover
        rect={rect}
        ariaLabel="Test menu"
        dismissOnReflow
        onDismiss={onDismiss}
      >
        <button>Item</button>
      </SelectionPopover>,
    );
    fireEvent.scroll(window);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
