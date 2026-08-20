import { afterEach, describe, expect, it, vi } from "vitest";
import { preservePageScroll } from "../preserve-page-scroll";

/**
 * A hand-cranked `requestAnimationFrame`, so a test can advance exactly as many
 * frames as it means to. Safari's clobber lands on the second or third frame
 * after the dialog closes, and the whole point of the budget is WHICH frames
 * are still watched — that is only assertable if frames are stepped one by one.
 */
function fakeFrames() {
  const queue: Array<() => void> = [];
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => queue.push(cb));
  return {
    step(times = 1) {
      for (let i = 0; i < times; i++) queue.shift()?.();
    },
    get pending() {
      return queue.length;
    },
  };
}

/** A scroll container standing in for the page. */
function fakePage(at: number) {
  return {
    y: at,
    read() {
      return this.y;
    },
    write(y: number) {
      this.y = y;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("preservePageScroll", () => {
  it("puts the position back when the browser zeroes it after the dialog closes", () => {
    const frames = fakeFrames();
    const page = fakePage(700);

    preservePageScroll(page);
    frames.step(); // frame 1 — Safari has not clobbered yet
    expect(page.y).toBe(700);

    page.y = 0; // the clobber
    frames.step();

    expect(page.y).toBe(700);
  });

  it("stops watching once it has restored, so later scrolling is left alone", () => {
    const frames = fakeFrames();
    const page = fakePage(700);

    preservePageScroll(page);
    page.y = 0;
    frames.step(2);
    expect(page.y).toBe(700);

    // The visitor scrolls back to the top of their own accord.
    page.y = 0;
    frames.step(4);

    expect(page.y).toBe(0);
  });

  it("does nothing when the page was already at the top", () => {
    const frames = fakeFrames();
    const page = fakePage(0);

    preservePageScroll(page);

    expect(frames.pending).toBe(0);
  });

  it("gives up after the frame budget, so a browser that never clobbers pays nothing", () => {
    const frames = fakeFrames();
    const page = fakePage(700);

    preservePageScroll(page);
    frames.step(20);

    expect(frames.pending).toBe(0);
    expect(page.y).toBe(700);
  });

  it("backs off the moment the visitor scrolls, rather than fighting them", () => {
    const frames = fakeFrames();
    const page = fakePage(700);

    preservePageScroll(page);
    window.dispatchEvent(new Event("wheel"));

    // A flick that happens to land on the top must not be undone.
    page.y = 0;
    frames.step(4);

    expect(page.y).toBe(0);
  });
});
