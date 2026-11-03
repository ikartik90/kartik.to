// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedOn } from "../use-delayed-on";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDelayedOn", () => {
  it("turns on `delay` ms after its input does", () => {
    const { result } = renderHook(({ on }) => useDelayedOn(on, 100), { initialProps: { on: true } });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(99));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("turns off the moment its input does", () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedOn(on, 100), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(100));
    rerender({ on: false });
    expect(result.current).toBe(false);
  });

  it("waits the delay out again each time its input comes back on", () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedOn(on, 100), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(100));
    rerender({ on: false });
    rerender({ on: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(true);
  });

  it("never turns on if its input goes off within the delay", () => {
    const { result, rerender } = renderHook(({ on }) => useDelayedOn(on, 100), { initialProps: { on: true } });
    act(() => vi.advanceTimersByTime(50));
    rerender({ on: false });
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(false);
  });
});
