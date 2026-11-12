// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeHero } from "../home-hero";

afterEach(() => cleanup());

describe("HomeHero", () => {
  it("is the page's one heading, in three lines, with shorter ones for phones too narrow for them", () => {
    render(<HomeHero />);
    const heading = screen.getByRole("heading", { level: 1 });
    const wordings = [...heading.children].map((wording) => [...wording.children].map((line) => line.textContent));
    expect(wordings).toEqual([
      ["12 years of design craft", "and engineering know\u2011how", "for early\u2011stage product teams"],
      ["12 years of design craft and", "engineering know\u2011how", "for early\u2011stage teams"],
      ["12 years of design craft &", "engineering know\u2011how", "for early\u2011stage teams"],
    ]);
  });

  it("introduces Kartik in two paragraphs", () => {
    render(<HomeHero />);
    const section = screen.getByRole("region", { name: "Introduction" });
    const paragraphs = within(section)
      .getAllByText(/./, { selector: "p" })
      .map((p) => p.textContent);
    expect(paragraphs).toEqual([
      "I'm Kartik Iyer, a Toronto-based designer and builder.",
      "I thrive in environments of high agency, urgency, and uncertainty. I invest care into the details that make software feel considered.",
    ]);
  });

  it("says he's available for work and where he is", () => {
    render(<HomeHero />);
    expect(screen.getByText("Available for work")).toBeDefined();
    expect(screen.getByText("Toronto, ON")).toBeDefined();
  });

  it("names the place in words alone, with no map pin", () => {
    render(<HomeHero />);
    expect(screen.getByText("Toronto, ON").querySelector("svg")).toBeNull();
  });

  it("offers no buttons, the work following straight after it", () => {
    render(<HomeHero />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("holds the words alone, with no shader behind them", () => {
    render(<HomeHero />);
    const section = screen.getByRole("region", { name: "Introduction" });
    expect(section.children).toHaveLength(1);
    expect(section.firstElementChild?.querySelector("h1")).not.toBeNull();
  });

  it("opens the page: the pills and the heading a line apart, then the lede", () => {
    const { container } = render(<HomeHero />);
    const delay = (el: Element) => (el as HTMLElement).style.getPropertyValue("--opening-delay");
    const lines = [...container.querySelectorAll("[data-opening-line]")];
    expect(lines.map((line) => line.textContent?.slice(0, 24))).toEqual(["Available for workToront", "12 years of design craft"]);
    expect(lines.map((line) => delay(line))).toEqual(["0ms", "100ms"]);
    const steps = [...container.querySelectorAll("[data-opening-step]")];
    const lede = screen.getByText("I'm Kartik Iyer, a Toronto-based designer and builder.").closest("[data-opening-step]")!;
    expect(steps).toEqual([lede]);
    expect(delay(lede)).toBe("250ms");
  });

  it("keeps the line the lede measures against out of the accessibility tree", () => {
    render(<HomeHero />);
    const section = screen.getByRole("region", { name: "Introduction" });
    const hidden = section.querySelectorAll("[aria-hidden='true']");
    const text = [...hidden].map((el) => el.textContent).join("");
    expect(text).not.toMatch(/Kartik|Designer/);
    expect(within(section).getAllByRole("heading")).toHaveLength(1);
  });
});
