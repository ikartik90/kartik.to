// @vitest-environment jsdom
import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
