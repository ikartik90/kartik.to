// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// WebGL, tested in its own file.
vi.mock("../shaders/dither-ground", () => ({ DitherGround: () => <div data-dither-ground="" /> }));

import { HomeHero } from "../home-hero";

afterEach(() => cleanup());

describe("HomeHero", () => {
  it("is the page's one heading, in two lines spaced apart", () => {
    render(<HomeHero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Designer who ships");
    expect(heading.children).toHaveLength(2);
  });

  it("introduces Kartik in three paragraphs", () => {
    render(<HomeHero />);
    const section = screen.getByRole("region", { name: "Introduction" });
    const paragraphs = within(section)
      .getAllByText(/./, { selector: "p" })
      .map((p) => p.textContent);
    expect(paragraphs).toEqual([
      "I'm Kartik Iyer, a Toronto-based designer and builder.",
      "I've dedicated over 12 years listening to customers and cross-functional teams, turning their roughly articulated ideas into coherent products.",
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

  it("leads to the work on the page and opens the resume in a new tab", () => {
    render(<HomeHero />);
    expect(screen.getByRole("link", { name: "See my work" }).getAttribute("href")).toBe("#work");
    const resume = screen.getByRole("link", { name: "Resume" });
    expect(resume.getAttribute("href")).toBe("/resume/SKartikIyer-ProductDesign-2026.pdf");
    expect(resume.getAttribute("target")).toBe("_blank");
  });

  it("draws the dithering behind the words", () => {
    const { container } = render(<HomeHero />);
    expect(container.querySelector("[data-dither-ground]")).not.toBeNull();
  });

  it("opens the page: the pills and each heading line a line apart, then the lede and the buttons as they stand", () => {
    const { container } = render(<HomeHero />);
    const delay = (el: Element, name = "--opening-delay") => (el as HTMLElement).style.getPropertyValue(name);
    const lines = [...container.querySelectorAll("[data-opening-line]")];
    expect(lines.map((line) => line.textContent)).toEqual([
      "Available for workToronto, ON",
      "Designer",
      "who ships",
    ]);
    expect(lines.map((line) => delay(line))).toEqual(["0ms", "100ms", "200ms"]);
    const steps = [...container.querySelectorAll("[data-opening-step]")];
    const ctas = screen.getByRole("link", { name: "See my work" }).parentElement!;
    const lede = screen.getByText("I'm Kartik Iyer, a Toronto-based designer and builder.").closest("[data-opening-step]")!;
    expect(steps).toEqual([lede, ctas]);
    // In one column the lede stands above the buttons; side by side, beside the heading and the buttons below it.
    expect([lede, ctas].map((step) => delay(step, "--opening-delay-stacked"))).toEqual(["350ms", "500ms"]);
    expect([ctas, lede].map((step) => delay(step, "--opening-delay-beside"))).toEqual(["350ms", "500ms"]);
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
