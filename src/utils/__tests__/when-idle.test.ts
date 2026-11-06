// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { whenIdle } from "../when-idle";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("whenIdle", () => {
  it("runs the task when the browser is next idle, waiting no longer than the timeout", () => {
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", requestIdleCallback);
    const task = vi.fn();
    whenIdle(task, 2000);
    expect(task).toHaveBeenCalledOnce();
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
  });

  it("can be called off before the browser is idle", () => {
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal("requestIdleCallback", () => 7);
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);
    whenIdle(vi.fn(), 2000)();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it("runs it on the next turn where the browser can't say when it's idle", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    vi.useFakeTimers();
    const task = vi.fn();
    const cancel = whenIdle(task, 2000);
    expect(task).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(task).toHaveBeenCalledOnce();

    const later = vi.fn();
    whenIdle(later, 2000);
    cancel();
    vi.advanceTimersByTime(0);
    expect(later).toHaveBeenCalledOnce();
  });
});
