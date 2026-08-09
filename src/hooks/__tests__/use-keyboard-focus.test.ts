// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { markSyntheticPointer } from "@/utils/synthetic-pointer";
import { useKeyboardFocus } from "../use-keyboard-focus";

describe("useKeyboardFocus", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-keyboard-focus");
  });

  it("sets data-keyboard-focus on Tab and removes it on pointer down", () => {
    renderHook(() => useKeyboardFocus());

    expect(document.documentElement.hasAttribute("data-keyboard-focus")).toBe(
      false,
    );

    act(() => {
      fireEvent.keyDown(window, { key: "Tab" });
    });
    expect(document.documentElement.hasAttribute("data-keyboard-focus")).toBe(
      true,
    );

    act(() => {
      fireEvent.mouseDown(window);
    });
    expect(document.documentElement.hasAttribute("data-keyboard-focus")).toBe(
      false,
    );
  });

  // A demo replayed from the keyboard performs with a stand-in cursor that
  // presses things. Taking that for the visitor's hand would drop the focus ring
  // off the very control they are still standing on.
  it("keeps the ring through a demo's own presses", () => {
    renderHook(() => useKeyboardFocus());

    act(() => {
      fireEvent.keyDown(window, { key: "Tab" });
      window.dispatchEvent(
        markSyntheticPointer(new MouseEvent("pointerdown", { bubbles: true })),
      );
    });

    expect(document.documentElement.hasAttribute("data-keyboard-focus")).toBe(
      true,
    );
  });

  it("does not set data-keyboard-focus for non-Tab keys", () => {
    renderHook(() => useKeyboardFocus());

    act(() => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(document.documentElement.hasAttribute("data-keyboard-focus")).toBe(
      false,
    );
  });
});
