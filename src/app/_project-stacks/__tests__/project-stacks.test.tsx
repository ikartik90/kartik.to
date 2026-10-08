// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The sheets' content and the covers' drawings are tested by rendering the page; here they only stand in.
vi.mock("../onboarding-sheet", () => ({ OnboardingSheet: () => <p>Onboarding sheet</p> }));
vi.mock("../shift-sheet", () => ({ ShiftSheet: () => <p>Shift scheduling sheet</p> }));
vi.mock("../card-figures", () => {
  const Figure = () => <svg role="img" aria-label="Figure" />;
  return {
    DesignSystemFigure: Figure,
    ShiftSchedulingFigure: Figure,
    CheckInsFigure: Figure,
    OnboardingFigure: Figure,
  };
});

import { openProjectSheet } from "@/utils/project-sheet-channel";
import { SPOTWORK } from "../data";
import { ProjectStacks } from "../project-stacks";

const matchMedia = window.matchMedia;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
  // jsdom has no Web Animations; with reduced motion nothing plays, but closing still clears what might.
  HTMLElement.prototype.getAnimations = () => [];
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  // Reduced motion: the sheet opens, switches and closes at once, with no animations to stand in for.
  window.matchMedia = ((query: string) => ({
    ...matchMedia(query),
    matches: query.includes("reduce"),
  })) as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.matchMedia = matchMedia;
  window.history.replaceState(null, "", "/");
});

const sheet = () => document.querySelector<HTMLDialogElement>("dialog[open]");

describe("ProjectStacks", () => {
  it("heads the section with the outcome, over a card per project", () => {
    render(<ProjectStacks />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(SPOTWORK.headline);
    const cards = [...document.querySelectorAll("[data-sheet-card]")];
    expect(cards.map((card) => card.querySelector("[data-face-text]")?.textContent)).toEqual(
      SPOTWORK.cards.map(({ title, sentence }) => title + sentence),
    );
  });

  // As the server renders it, so it plays from the first paint: the arrows show until the carousel finds it can't scroll.
  it("carries the page's opening on: the headline, then the arrows, the steps after the hero's", () => {
    const page = document.createElement("div");
    page.innerHTML = renderToString(<ProjectStacks />);
    const delay = (el: Element | null) => (el as HTMLElement | null)?.style.getPropertyValue("--opening-delay");
    const headline = page.querySelector("h2");
    const arrows = page.querySelector("[aria-label='Next']")?.parentElement ?? null;
    expect([headline, arrows].map((el) => el?.hasAttribute("data-opening-step"))).toEqual([true, true]);
    expect([delay(headline), delay(arrows)]).toEqual(["650ms", "800ms"]);
  });

  it("is where the hero's See my work lands", () => {
    const { container } = render(<ProjectStacks id="work" />);
    expect(container.querySelector("section")?.id).toBe("work");
  });

  it("links shift scheduling and onboarding to their sheets' addresses, and says the rest are coming this week", () => {
    render(<ProjectStacks />);
    const openers = screen.getAllByRole("link", { name: /:/ });
    expect(openers.map((link) => link.getAttribute("href"))).toEqual([
      "/projects/shift-scheduling",
      "/projects/onboarding",
    ]);
    for (const link of openers) expect(link.getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.getAllByText("Coming this week")).toHaveLength(2);
    for (const id of ["check-ins", "design-system"]) {
      expect(document.querySelector(`[data-sheet-card="${id}"]`)?.tagName).toBe("DIV");
    }
  });

  it("opens a card's sheet over the page, named for its project, at the project's address", () => {
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("link", { name: /^Company onboarding:/ }));
    expect(sheet()?.getAttribute("aria-label")).toBe("Company onboarding");
    expect(within(sheet()!).getByText("Onboarding sheet")).toBeDefined();
    expect(window.location.pathname).toBe("/projects/onboarding");
  });

  it("leaves a card clicked with a key held to the browser, to open in a new tab", () => {
    render(<ProjectStacks />);
    let prevented: boolean | undefined;
    document.addEventListener(
      "click",
      (event) => {
        prevented = event.defaultPrevented;
        // jsdom can't follow the link.
        event.preventDefault();
      },
      { once: true },
    );
    fireEvent.click(screen.getByRole("link", { name: /^Company onboarding:/ }), { metaKey: true });
    expect(prevented).toBe(false);
    expect(sheet()).toBeNull();
  });

  it("opens with the sheet the page was served for", () => {
    window.history.replaceState(null, "", "/projects/shift-scheduling");
    render(<ProjectStacks sheet="shift-scheduling" />);
    expect(within(sheet()!).getByText("Shift scheduling sheet")).toBeDefined();
  });

  it("moves an old link's sheet (`?sheet=`) to its project's address, but not one that isn't ready", () => {
    window.history.replaceState(null, "", "/?sheet=shift-scheduling");
    const { unmount } = render(<ProjectStacks />);
    expect(within(sheet()!).getByText("Shift scheduling sheet")).toBeDefined();
    expect(window.location.pathname + window.location.search).toBe("/projects/shift-scheduling");
    unmount();

    window.history.replaceState(null, "", "/?sheet=check-ins");
    render(<ProjectStacks />);
    expect(sheet()).toBeNull();
  });

  it("offers only the next project from the first sheet, and only the previous from the last, the address following", () => {
    render(<ProjectStacks />);
    const nav = () => within(sheet()!).getByRole("navigation", { name: "More projects" });
    const offered = () => within(nav()).getAllByRole("link").map((link) => link.textContent);

    fireEvent.click(screen.getByRole("link", { name: /^Shift scheduling:/ }));
    expect(offered()).toEqual(["NextCompany onboarding"]);
    expect(within(nav()).getByRole("link", { name: /^Next/ }).getAttribute("href")).toBe("/projects/onboarding");

    fireEvent.click(within(nav()).getByRole("link", { name: /^Next/ }));
    expect(sheet()?.getAttribute("aria-label")).toBe("Company onboarding");
    expect(within(sheet()!).getByText("Onboarding sheet")).toBeDefined();
    expect(window.location.pathname).toBe("/projects/onboarding");
    expect(offered()).toEqual(["PreviousShift scheduling"]);
  });

  // Another project's sheet replaces the address rather than adding one, so Back leaves the sheet at once.
  it("closes when Back takes its address off, and opens again on Forward", async () => {
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("link", { name: /^Company onboarding:/ }));
    fireEvent.click(within(sheet()!).getByRole("link", { name: /^Previous/ }));

    window.history.back();
    await waitFor(() => expect(sheet()).toBeNull());
    expect(window.location.pathname).toBe("/");

    window.history.forward();
    await waitFor(() => expect(sheet()?.getAttribute("aria-label")).toBe("Shift scheduling"));
  });

  it("returns to the address it opened from as it closes", async () => {
    window.history.replaceState(null, "", "/?from=here#work");
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("link", { name: /^Shift scheduling:/ }));
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeNull();
    await waitFor(() => expect(window.location.pathname + window.location.search).toBe("/?from=here"));
    expect(window.location.hash).toBe("#work");
  });

  it("opened at its own address, leaves the homepage's in its place as it closes", () => {
    window.history.replaceState(null, "", "/projects/onboarding");
    render(<ProjectStacks sheet="onboarding" />);
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeNull();
    expect(window.location.pathname).toBe("/");
  });

  it("opens the sheet the command palette asks for, at its address, and goes to it from another's", () => {
    render(<ProjectStacks />);

    act(() => void expect(openProjectSheet("onboarding")).toBe(true));
    expect(sheet()?.getAttribute("aria-label")).toBe("Company onboarding");
    expect(window.location.pathname).toBe("/projects/onboarding");

    act(() => void openProjectSheet("shift-scheduling"));
    expect(within(sheet()!).getByText("Shift scheduling sheet")).toBeDefined();
    expect(window.location.pathname).toBe("/projects/shift-scheduling");
  });

  it("closes from its Close button", () => {
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("link", { name: /^Shift scheduling:/ }));
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeNull();
  });
});

describe("ProjectStacks while its sheet moves", () => {
  // Stand-ins for the sheet's animations, each under way until the test ends it.
  let moving: Animation[] = [];

  const animate = function (this: Element) {
    let state: AnimationPlayState = "running";
    let end!: () => void;
    let abort!: () => void;
    const finished = new Promise<Animation>((resolve, reject) => {
      end = () => resolve(animation);
      abort = () => reject(new DOMException("Aborted", "AbortError"));
    });
    finished.catch(() => {});
    const animation = {
      effect: { target: this },
      finished,
      startTime: null,
      get playState() {
        return state;
      },
      pause: () => void (state === "running" && (state = "paused")),
      finish: () => void (state !== "idle" && ((state = "finished"), end())),
      cancel: () => void ((state = "idle"), abort()),
    } as unknown as Animation;
    moving.push(animation);
    return animation;
  };

  /** Ends the animations under way, and with `all`, those they start in turn, until the sheet is still. */
  async function end({ all = true } = {}) {
    do {
      const now = moving.splice(0);
      if (!now.length) return;
      await act(async () => now.forEach((animation) => animation.finish()));
    } while (all);
  }

  /** Back or Forward, once the page has heard it. */
  const step = (go: () => void) =>
    act(
      () =>
        new Promise<void>((resolve) => {
          window.addEventListener("popstate", () => resolve(), { once: true });
          go();
        }),
    );

  const openShift = async () => {
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("link", { name: /^Shift scheduling:/ }));
    await end();
  };
  const next = () => fireEvent.click(within(sheet()!).getByRole("link", { name: /^Next/ }));
  const shown = () => ({ path: window.location.pathname, sheet: sheet()?.getAttribute("aria-label") ?? null });

  beforeEach(() => {
    moving = [];
    window.matchMedia = ((query: string) => ({ ...matchMedia(query), matches: false })) as typeof window.matchMedia;
    HTMLElement.prototype.animate = animate as unknown as HTMLElement["animate"];
    Object.defineProperty(document, "timeline", { configurable: true, value: { currentTime: 0 } });
    // jsdom can't style the backdrop, and says so.
    const styleOf = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => styleOf(el));
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
    Reflect.deleteProperty(document, "timeline");
  });

  it("closes on Back taken as it goes to the next project, and opens where it was on Forward", async () => {
    await openShift();
    next();
    await step(() => window.history.back());
    await end();
    expect(shown()).toEqual({ path: "/", sheet: null });

    await step(() => window.history.forward());
    await end();
    expect(shown()).toEqual({ path: "/projects/shift-scheduling", sheet: "Shift scheduling" });
  });

  it("closes on Back taken as the next project slides in, and opens on it on Forward", async () => {
    await openShift();
    next();
    await end({ all: false });
    expect(window.location.pathname).toBe("/projects/onboarding");
    await step(() => window.history.back());
    await end();
    expect(shown()).toEqual({ path: "/", sheet: null });

    await step(() => window.history.forward());
    await end();
    expect(shown()).toEqual({ path: "/projects/onboarding", sheet: "Company onboarding" });
  });

  it("closes from its Close button pressed as it goes to the next project", async () => {
    await openShift();
    next();
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Close" }));
    await end();
    expect(sheet()).toBeNull();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("opens again on Forward taken as Back closes it, and closes again on Back", async () => {
    await openShift();
    await step(() => window.history.back());
    await step(() => window.history.forward());
    await end();
    expect(shown()).toEqual({ path: "/projects/shift-scheduling", sheet: "Shift scheduling" });

    await step(() => window.history.back());
    await end();
    expect(shown()).toEqual({ path: "/", sheet: null });
  });
});

describe("ProjectStacks under a base", () => {
  beforeEach(() => window.history.replaceState(null, "", "/dive"));

  it("links its cards and its sheets' next and previous to the project addresses under it", () => {
    render(<ProjectStacks base="/dive" />);
    expect(screen.getAllByRole("link", { name: /:/ }).map((link) => link.getAttribute("href"))).toEqual([
      "/dive/projects/shift-scheduling",
      "/dive/projects/onboarding",
    ]);

    fireEvent.click(screen.getByRole("link", { name: /^Shift scheduling:/ }));
    expect(window.location.pathname).toBe("/dive/projects/shift-scheduling");
    const next = within(sheet()!).getByRole("link", { name: /^Next/ });
    expect(next.getAttribute("href")).toBe("/dive/projects/onboarding");

    fireEvent.click(next);
    expect(window.location.pathname).toBe("/dive/projects/onboarding");
  });

  it("closes when Back returns to the page under it, and opens again on Forward", async () => {
    render(<ProjectStacks base="/dive" />);
    fireEvent.click(screen.getByRole("link", { name: /^Company onboarding:/ }));
    expect(window.location.pathname).toBe("/dive/projects/onboarding");

    window.history.back();
    await waitFor(() => expect(sheet()).toBeNull());
    expect(window.location.pathname).toBe("/dive");

    window.history.forward();
    await waitFor(() => expect(sheet()?.getAttribute("aria-label")).toBe("Company onboarding"));
  });

  it("opened at its own address, leaves the page under it in its place as it closes", () => {
    window.history.replaceState(null, "", "/dive/projects/onboarding");
    render(<ProjectStacks base="/dive" sheet="onboarding" />);
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Close" }));
    expect(window.location.pathname).toBe("/dive");
  });

  it("opens the sheet the command palette asks for at its address under it", () => {
    render(<ProjectStacks base="/dive" />);
    act(() => void openProjectSheet("shift-scheduling"));
    expect(window.location.pathname).toBe("/dive/projects/shift-scheduling");
  });
});
