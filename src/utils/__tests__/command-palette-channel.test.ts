import { describe, it, expect, vi } from "vitest";
import {
  openCommandPalette,
  subscribeCommandPalette,
} from "../command-palette-channel";

describe("command palette channel", () => {
  it("calls every subscriber when the palette is asked for", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = subscribeCommandPalette(first);
    const stopSecond = subscribeCommandPalette(second);

    openCommandPalette();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    stopFirst();
    stopSecond();
  });

  it("stops calling a subscriber once it unsubscribes", () => {
    const listener = vi.fn();
    const stop = subscribeCommandPalette(listener);

    openCommandPalette();
    stop();
    openCommandPalette();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when nothing is listening", () => {
    expect(() => openCommandPalette()).not.toThrow();
  });
});
