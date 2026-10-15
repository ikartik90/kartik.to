// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// WebGL isn't jsdom's; the shader only stands in.
vi.mock("@/components/background-effect", () => ({ BackgroundEffectLayer: () => <span data-background-effect="" /> }));

import { CHECK_INS } from "../check-ins-content";
import { OPEN_CARDS } from "../data";
import { DisplayCover } from "../display-cover";
import { ONBOARDING } from "../onboarding-content";
import { SHIFT } from "../shift-content";

const matchMedia = window.matchMedia;
let observers: IntersectionObserverCallback[] = [];
const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

const prefersReducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    ...matchMedia(query),
    matches: reduce && query.includes("reduce"),
  })) as typeof window.matchMedia;
};
const inView = (ratio: number) =>
  act(() =>
    observers.forEach((callback) =>
      callback(
        [
          {
            intersectionRatio: ratio,
            isIntersecting: ratio > 0,
            boundingClientRect: { height: 400 },
            rootBounds: { height: 800 },
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    ),
  );
const card = (id: string) => OPEN_CARDS.find((c) => c.id === id)!;

beforeEach(() => {
  observers = [];
  globalThis.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      observers.push(callback);
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  HTMLMediaElement.prototype.play = play;
  HTMLMediaElement.prototype.pause = pause;
  prefersReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.matchMedia = matchMedia;
});

describe("DisplayCover", () => {
  it("shows each project's walkthrough on the screen", () => {
    const shown = (id: string) => {
      const { container, unmount } = render(<DisplayCover card={card(id)} />);
      const video = container.querySelector("video");
      const seen = [video?.getAttribute("src"), video?.getAttribute("aria-label")];
      unmount();
      return seen;
    };
    expect(shown("check-ins")).toEqual([CHECK_INS.clips[0].src, CHECK_INS.clips[0].alt]);
    expect(shown("onboarding")).toEqual([ONBOARDING.clips[0].src, ONBOARDING.clips[0].alt]);
    expect(shown("shift-scheduling")).toEqual([SHIFT.clips[1].src, SHIFT.clips[1].alt]);
  });

  it("stands the screen on the walkthrough's shader and the dotted ground", () => {
    const { container } = render(<DisplayCover card={card("check-ins")} />);
    // The backlight's, then the screen's own.
    expect(container.querySelectorAll("[data-background-effect]")).toHaveLength(2);
    expect(container.querySelector("[data-cover-dots]")).not.toBeNull();
  });

  it("plays the walkthrough only while the card is in view", () => {
    render(<DisplayCover card={card("onboarding")} />);
    expect(play).not.toHaveBeenCalled();
    inView(0.5);
    expect(play).toHaveBeenCalledTimes(1);
    pause.mockClear();
    inView(0);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("keeps the walkthrough still, on its poster, for a visitor who prefers reduced motion", () => {
    prefersReducedMotion(true);
    const { container } = render(<DisplayCover card={card("onboarding")} />);
    inView(1);
    expect(play).not.toHaveBeenCalled();
    const clip = ONBOARDING.clips[0];
    expect(container.querySelector("video")?.getAttribute("poster")).toBe(clip.kind === "video" ? clip.poster : null);
  });
});
