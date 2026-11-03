import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useControllable, useOpen } from "../controllable";

describe("a value a part holds unless its owner does", () => {
  it("starts at its default and keeps what it's set to, telling the owner", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllable<boolean | undefined>(undefined, false, onChange));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("follows the owner's value, asking the owner to change it", () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useControllable(value, false, onChange), {
      initialProps: { value: true },
    });
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(true);
    expect(onChange).toHaveBeenCalledWith(false);
    rerender({ value: false });
    expect(result.current[0]).toBe(false);
  });
});

describe("whether a popover is open", () => {
  it("keeps one open from the start through presses outside it, until it's opened or closed itself", () => {
    const { result } = renderHook(() => useOpen(true));
    expect(result.current.open).toBe(true);
    expect(result.current.outside).toBe(false);
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(false);
    expect(result.current.outside).toBe(true);
    act(() => result.current.setOpen(true));
    expect(result.current.outside).toBe(true);
  });

  it("closes on a press outside it when it starts shut", () => {
    const { result } = renderHook(() => useOpen(false));
    expect(result.current.open).toBe(false);
    expect(result.current.outside).toBe(true);
  });
});
