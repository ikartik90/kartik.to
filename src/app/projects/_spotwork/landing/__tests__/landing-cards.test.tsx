import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingCards } from "../landing-cards";

// The prototype's code, arrived or not.
let liveApp: { LiveDemo: (props: { onShown?: () => void }) => null } | undefined;
vi.mock("../../use-live-app", () => ({ useLiveApp: () => liveApp }));
vi.mock("../backlight", () => ({ Backlight: () => <canvas data-testid="backlight" /> }));

const LiveDemo = ({ onShown }: { onShown?: () => void }) => {
  useLayoutEffect(() => onShown?.(), [onShown]);
  return null;
};

let fades: (() => void)[] = [];
beforeEach(() => {
  liveApp = undefined;
  fades = [];
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
  it("links each project's card to its address, under the copy of the homepage it's on", () => {
    render(<LandingCards paused={false} onOpen={() => {}} base="/dive" />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/dive/projects/design-system",
      "/dive/projects/check-ins",
      "/dive/projects/activation-and-retention",
    ]);
  });

  it("opens a card's project in place on a plain click", () => {
    const onOpen = vi.fn();
    render(<LandingCards paused={false} onOpen={onOpen} />);
    const clicked = fireEvent.click(card(/^Check-ins and time tracking:/));
    expect(clicked).toBe(false);
    expect(onOpen).toHaveBeenCalledWith("check-ins");
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

  it("fades each window's veil off once its app is shown", async () => {
    const { rerender } = render(<LandingCards paused={false} onOpen={() => {}} />);
    liveApp = { LiveDemo: LiveDemo as never };
    rerender(<LandingCards paused={true} onOpen={() => {}} />);
    expect(fades).toHaveLength(3);
    expect(document.querySelectorAll("[data-app-veil]")).toHaveLength(3);
    await act(async () => fades.forEach((end) => end()));
    expect(document.querySelectorAll("[data-app-veil]")).toHaveLength(0);
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
