import { afterEach, describe, expect, it, vi } from "vitest";
import { firstFoldHeld, holdFirstFold, subscribeFirstFold } from "../first-fold";

afterEach(() => {
  vi.useRealTimers();
});

describe("holdFirstFold", () => {
  it("holds the first fold until every hold is let go, telling its listeners each time it changes", () => {
    const heard = vi.fn();
    const unsubscribe = subscribeFirstFold(heard);
    const first = holdFirstFold(10_000);
    const second = holdFirstFold(10_000);
    expect(firstFoldHeld()).toBe(true);

    first();
    first();
    expect(firstFoldHeld()).toBe(true);
    second();
    expect(firstFoldHeld()).toBe(false);
    expect(heard).toHaveBeenCalled();
    unsubscribe();
  });

  it("lets go of its own accord after the timeout, so a fetch that never lands can't hold the page up", () => {
    vi.useFakeTimers();
    const release = holdFirstFold(8000);
    vi.advanceTimersByTime(7999);
    expect(firstFoldHeld()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(firstFoldHeld()).toBe(false);
    release();
    expect(firstFoldHeld()).toBe(false);
  });
});
