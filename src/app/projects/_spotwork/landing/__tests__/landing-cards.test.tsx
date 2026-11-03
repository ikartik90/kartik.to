import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LandingCards } from "../landing-cards";

vi.mock("../live-demo", () => ({ LiveDemo: () => null }));
vi.mock("../backlight", () => ({ Backlight: () => null }));

beforeAll(() => {
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
});
