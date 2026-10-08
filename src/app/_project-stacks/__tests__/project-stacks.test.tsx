// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("opens shift scheduling and onboarding, and says the rest are coming this week", () => {
    render(<ProjectStacks />);
    const openers = screen.getAllByRole("button", { name: /:/ });
    expect(openers.map((button) => button.getAttribute("data-sheet-card"))).toEqual(["shift-scheduling", "onboarding"]);
    for (const button of openers) expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.getAllByText("Coming this week")).toHaveLength(2);
    for (const id of ["check-ins", "design-system"]) {
      expect(document.querySelector(`[data-sheet-card="${id}"]`)?.tagName).toBe("DIV");
    }
  });

  it("opens a card's sheet over the page, named for its project", () => {
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("button", { name: /^Company onboarding:/ }));
    expect(sheet()?.getAttribute("aria-label")).toBe("Company onboarding");
    expect(within(sheet()!).getByText("Onboarding sheet")).toBeDefined();
  });

  it("opens the sheet the address names, but not one that isn't ready", () => {
    window.history.replaceState(null, "", "/?sheet=shift-scheduling");
    const { unmount } = render(<ProjectStacks />);
    expect(within(sheet()!).getByText("Shift scheduling sheet")).toBeDefined();
    unmount();

    window.history.replaceState(null, "", "/?sheet=check-ins");
    render(<ProjectStacks />);
    expect(sheet()).toBeNull();
  });

  it("offers only the next project from the first sheet, and only the previous from the last", () => {
    render(<ProjectStacks />);
    const nav = () => within(sheet()!).getByRole("navigation", { name: "More projects" });
    const offered = () => within(nav()).getAllByRole("button").map((button) => button.textContent);

    fireEvent.click(screen.getByRole("button", { name: /^Shift scheduling:/ }));
    expect(offered()).toEqual(["NextCompany onboarding"]);

    fireEvent.click(within(nav()).getByRole("button", { name: /^Next/ }));
    expect(sheet()?.getAttribute("aria-label")).toBe("Company onboarding");
    expect(within(sheet()!).getByText("Onboarding sheet")).toBeDefined();
    expect(offered()).toEqual(["PreviousShift scheduling"]);
  });

  it("closes from its Close button", () => {
    render(<ProjectStacks />);
    fireEvent.click(screen.getByRole("button", { name: /^Shift scheduling:/ }));
    fireEvent.click(within(sheet()!).getByRole("button", { name: "Close" }));
    expect(sheet()).toBeNull();
  });
});
