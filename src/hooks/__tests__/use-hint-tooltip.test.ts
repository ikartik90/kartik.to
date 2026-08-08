// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHintTooltip, HINT_TOOLTIP_MS } from "../use-hint-tooltip";

describe("useHintTooltip", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts hidden", () => {
    const { result } = renderHook(() => useHintTooltip());
    expect(result.current.visible).toBe(false);
  });

  it("shows on demand and withdraws itself after the hint window", () => {
    const { result } = renderHook(() => useHintTooltip());

    act(() => result.current.show(10, 20));
    expect(result.current.visible).toBe(true);

    act(() => vi.advanceTimersByTime(HINT_TOOLTIP_MS - 1));
    expect(result.current.visible).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.visible).toBe(false);
  });

  it("takes a custom hint window", () => {
    const { result } = renderHook(() => useHintTooltip(500));

    act(() => result.current.show(0, 0));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.visible).toBe(false);
  });

  it("hides on demand, and the pending timer cannot resurrect it", () => {
    const { result } = renderHook(() => useHintTooltip());

    act(() => result.current.show(0, 0));
    act(() => result.current.hide());
    expect(result.current.visible).toBe(false);

    act(() => vi.advanceTimersByTime(HINT_TOOLTIP_MS));
    expect(result.current.visible).toBe(false);
  });

  it("restarts the window on each show, so a fresh hover gets a full hint", () => {
    const { result } = renderHook(() => useHintTooltip());

    act(() => result.current.show(0, 0));
    act(() => vi.advanceTimersByTime(HINT_TOOLTIP_MS - 100));
    act(() => result.current.hide());

    act(() => result.current.show(0, 0));
    act(() => vi.advanceTimersByTime(HINT_TOOLTIP_MS - 1));
    expect(result.current.visible).toBe(true);
  });

  it("retire hides it and refuses every later show", () => {
    const { result } = renderHook(() => useHintTooltip());

    act(() => result.current.show(0, 0));
    act(() => result.current.retire());
    expect(result.current.visible).toBe(false);

    act(() => result.current.show(0, 0));
    expect(result.current.visible).toBe(false);
  });

  it("keeps its identity across renders, so callers can depend on it", () => {
    const { result, rerender } = renderHook(() => useHintTooltip());
    const first = result.current;
    rerender();
    expect(result.current.show).toBe(first.show);
    expect(result.current.hide).toBe(first.hide);
    expect(result.current.retire).toBe(first.retire);
  });
});
