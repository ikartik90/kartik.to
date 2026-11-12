import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HERO_OPENING_LINES, HERO_OPENING_STEPS, openingStepDelay } from "@/data/page-opening";
import { firstFoldHeld } from "@/utils/first-fold";
import { LandingCards } from "../landing-cards";

// The prototype's code, arrived or not.
let liveApp: { LiveDemo: (props: { onShown?: () => void }) => null } | undefined;
vi.mock("../../use-live-app", () => ({ useLiveApp: () => liveApp, loadLiveApp: () => new Promise(() => {}) }));
vi.mock("../backlight", () => ({ Backlight: () => <canvas data-testid="backlight" /> }));
const entrance = vi.hoisted(() => ({ riseIn: vi.fn() }));
vi.mock("../../opening", async (original) => ({ ...(await original<object>()), ...entrance }));

const LiveDemo = ({ onShown }: { onShown?: () => void }) => {
  useLayoutEffect(() => onShown?.(), [onShown]);
  return null;
};

let fades: (() => void)[] = [];
beforeEach(() => {
  liveApp = undefined;
  fades = [];
  vi.stubGlobal("cancelIdleCallback", () => undefined);
  HTMLElement.prototype.animate = function () {
    let end!: () => void;
    const finished = new Promise<Animation>((resolve) => (end = () => resolve(fade)));
    const fade = { finished, pause: () => {}, cancel: () => {}, startTime: null } as unknown as Animation;
    fades.push(end);
    return fade;
  } as HTMLElement["animate"];
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  vi.unstubAllGlobals();
});

beforeAll(() => {
  // jsdom has no document timeline, which the veil's fade is timed on.
  Object.defineProperty(document, "timeline", { value: { currentTime: 0 }, configurable: true });
  window.IntersectionObserver ??= class {
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});
afterEach(cleanup);

const card = (name: RegExp) => screen.getByRole("link", { name });

describe("LandingCards", () => {
  /** The observers of the carousel round the cards told that as much of it is on screen as `ratio`. */
  function watched() {
    const observers: { callback: IntersectionObserverCallback; nodes: Element[] }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry: { callback: IntersectionObserverCallback; nodes: Element[] };
        constructor(callback: IntersectionObserverCallback) {
          this.entry = { callback, nodes: [] };
          observers.push(this.entry);
        }
        observe(node: Element) {
          this.entry.nodes.push(node);
        }
        disconnect() {
          this.entry.nodes = [];
        }
      },
    );
    return (ratio: number) =>
      act(() => {
        for (const { callback, nodes } of [...observers]) {
          const carousels = nodes.filter((node) => node.querySelector("[data-carousel-slide]"));
          if (!carousels.length) continue;
          callback(
            carousels.map(
              (target) => ({ target, intersectionRatio: ratio, isIntersecting: ratio > 0 }) as IntersectionObserverEntry,
            ),
            {} as IntersectionObserver,
          );
        }
      });
  }
  const entering = () => screen.getByRole("region", { name: "Work" }).hasAttribute("data-entering");
  // Off the opening for good, or it would play again as the wait ends.
  const scrolledTo = () => screen.getByRole("region", { name: "Work" }).hasAttribute("data-scrolled-to");

  it("shows the cards in the server's page, as the opening's steps after the hero's, a step apart", () => {
    const page = document.createElement("div");
    page.innerHTML = renderToString(<LandingCards paused={false} onOpen={() => {}} />);
    expect(page.querySelector("[data-entering]")).toBeNull();
    const slides = [...page.querySelectorAll<HTMLElement>("[data-carousel-slide]")];
    expect(slides.length).toBeGreaterThan(1);
    slides.forEach((slide, i) => {
      expect(slide.className).toContain("page-opening--part_step");
      expect(slide.style.getPropertyValue("--opening-delay")).toBe(
        `${openingStepDelay(HERO_OPENING_LINES, HERO_OPENING_STEPS + i)}ms`,
      );
    });
  });

  it("leaves cards in the first fold to the opening, even a sliver of them", () => {
    const show = watched();
    entrance.riseIn.mockClear();
    render(<LandingCards paused={false} onOpen={() => {}} />);
    show(0.05);
    expect(entrance.riseIn).not.toHaveBeenCalled();
    expect(entering()).toBe(false);
    expect(scrolledTo()).toBe(false);
  });

  it("hides cards below the first fold, and rises them in as they're scrolled to only when 30% of them is on screen", () => {
    const show = watched();
    entrance.riseIn.mockClear();
    render(<LandingCards paused={false} onOpen={() => {}} />);
    expect(entering()).toBe(false);
    show(0);
    expect(entering()).toBe(true);
    show(0.05);
    expect(entrance.riseIn).not.toHaveBeenCalled();
    expect(entering()).toBe(true);
    show(0.3);
    expect(entrance.riseIn).toHaveBeenCalledOnce();
    expect(entering()).toBe(false);
    expect(scrolledTo()).toBe(true);
  });

  it("links each project's card to its address, under the copy of the homepage it's on", () => {
    render(<LandingCards paused={false} onOpen={() => {}} base="/dive" />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/dive/projects/design-system",
      "/dive/projects/check-ins",
      "/dive/projects/activation-and-retention",
    ]);
  });

  it("heads each card's words with Spotwork before its title", () => {
    render(<LandingCards paused={false} onOpen={() => {}} />);
    expect(screen.getByText("Spotwork • Check-ins and time tracking")).toBeTruthy();
  });

  describe("on a plain click", () => {
    let frames: FrameRequestCallback[];
    const drawFrame = () => frames.splice(0).forEach((frame) => frame(0));
    beforeEach(() => {
      frames = [];
      vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });
    afterEach(() => vi.useRealTimers());

    it("opens the card's project in place once the frame showing the card let go is drawn", () => {
      const onOpen = vi.fn();
      render(<LandingCards paused={false} onOpen={onOpen} />);
      const clicked = fireEvent.click(card(/^Check-ins and time tracking:/));
      expect(clicked).toBe(false);
      expect(onOpen).not.toHaveBeenCalled();
      // A frame's callbacks run before it's drawn.
      drawFrame();
      expect(onOpen).not.toHaveBeenCalled();
      vi.runOnlyPendingTimers();
      expect(onOpen).toHaveBeenCalledOnce();
      expect(onOpen).toHaveBeenCalledWith("check-ins");
    });

    it("opens it once when clicked again before it opens", () => {
      const onOpen = vi.fn();
      render(<LandingCards paused={false} onOpen={onOpen} />);
      fireEvent.click(card(/^Check-ins and time tracking:/));
      fireEvent.click(card(/^Check-ins and time tracking:/));
      drawFrame();
      vi.runOnlyPendingTimers();
      expect(onOpen).toHaveBeenCalledOnce();
    });
  });

  it("leaves a card clicked with a key held to the browser, to open in a new tab", () => {
    const onOpen = vi.fn();
    render(<LandingCards paused={false} onOpen={onOpen} />);
    const clicked = fireEvent.click(card(/^Design system:/), { metaKey: true });
    expect(clicked).toBe(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("draws each card's monitor and backlight before the prototype's code arrives, its window veiled in the app's colour", () => {
    render(<LandingCards paused={false} onOpen={() => {}} />);
    const covers = [...document.querySelectorAll("[data-cover]")];
    expect(covers).toHaveLength(3);
    for (const cover of covers) {
      expect(cover.querySelector("svg")).not.toBeNull();
      expect(cover.querySelector("[data-testid=backlight]")).not.toBeNull();
      expect(cover.querySelector("[data-app-veil]")).not.toBeNull();
    }
  });

  it("builds the cards' apps one at a time, first to last, each once the one before it is shown, without waiting for the page to load", () => {
    const readyState = vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const show: Record<string, () => void> = {};
    liveApp = {
      LiveDemo: (({ project, onShown }: { project: string; onShown?: () => void }) => {
        show[project] = () => onShown?.();
        return <i data-live={project} />;
      }) as never,
    };
    render(<LandingCards paused={false} onOpen={() => {}} />);
    const built = () => [...document.querySelectorAll("[data-live]")].map((node) => node.getAttribute("data-live"));
    const order = [...document.querySelectorAll("[data-sheet-card]")].map((node) => node.getAttribute("data-sheet-card"));
    expect(built()).toEqual(order.slice(0, 1));

    act(() => show[order[0]!]());
    expect(built()).toEqual(order.slice(0, 2));
    act(() => show[order[1]!]());
    expect(built()).toEqual(order);
    readyState.mockRestore();
  });

  it("holds back everything after the cards until the last card's app is shown", () => {
    const show: Record<string, () => void> = {};
    liveApp = {
      LiveDemo: (({ project, onShown }: { project: string; onShown?: () => void }) => {
        show[project] = () => onShown?.();
        return null;
      }) as never,
    };
    render(<LandingCards paused={false} onOpen={() => {}} />);
    const order = [...document.querySelectorAll("[data-sheet-card]")].map((node) => node.getAttribute("data-sheet-card")!);
    for (const project of order.slice(0, -1)) {
      expect(firstFoldHeld()).toBe(true);
      act(() => show[project]());
    }
    expect(firstFoldHeld()).toBe(true);
    act(() => show[order[order.length - 1]]());
    expect(firstFoldHeld()).toBe(false);
  });

  it("fades each window's veil off once its app is shown", async () => {
    const { rerender } = render(<LandingCards paused={false} onOpen={() => {}} />);
    liveApp = { LiveDemo: LiveDemo as never };
    rerender(<LandingCards paused={true} onOpen={() => {}} />);
    expect(fades).toHaveLength(3);
    expect(document.querySelectorAll("[data-app-veil]")).toHaveLength(3);
    await act(async () => fades.forEach((end) => end()));
    expect(document.querySelectorAll("[data-app-veil]")).toHaveLength(0);
  });

  it("plays a card as hovered on a touch screen only while it's whole on screen, not once it's partly off", () => {
    vi.useFakeTimers();
    const observers: { callback: IntersectionObserverCallback; nodes: Element[] }[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        entry = { callback: (() => {}) as IntersectionObserverCallback, nodes: [] as Element[] };
        constructor(callback: IntersectionObserverCallback) {
          this.entry.callback = callback;
          observers.push(this.entry);
        }
        observe(node: Element) {
          this.entry.nodes.push(node);
        }
        disconnect() {
          this.entry.nodes = [];
        }
      },
    );
    render(<LandingCards paused={false} onOpen={() => {}} />);
    const slide = document.querySelectorAll("[data-carousel-slide]")[1];
    /** Every observer of `slide` told that `width` px of its 800 are on screen. */
    const show = (width: number) =>
      act(() => {
        for (const { callback, nodes } of observers) {
          if (!nodes.includes(slide)) continue;
          const entry = {
            target: slide,
            intersectionRatio: width / 800,
            isIntersecting: width > 0,
            boundingClientRect: { width: 800, height: 500 },
            intersectionRect: { width, height: 500 },
            rootBounds: { height: 800 },
          };
          callback([entry as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
        }
      });
    const lit = () => slide.querySelector("[data-hover-held]") !== null;

    show(800);
    act(() => void vi.advanceTimersByTime(100));
    expect(lit()).toBe(true);
    show(600);
    expect(lit()).toBe(false);
    show(800);
    act(() => void vi.advanceTimersByTime(100));
    expect(lit()).toBe(true);
    vi.useRealTimers();
  });

  it("marks the hover on the hovered card's surface, frame, button and words, never on the card or cover round its app", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    render(<LandingCards paused={false} onOpen={() => {}} />);
    const hovered = card(/^Check-ins and time tracking:/);
    act(() => void hovered.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" })));
    const host = hovered.parentElement!;
    const marked = [...document.querySelectorAll("[data-hover-held]")];
    expect(marked).toHaveLength(5);
    expect(marked.every((part) => host.contains(part) && part !== host)).toBe(true);
    expect(host.querySelector("[data-cover][data-hover-held]")).toBeNull();
  });
});
