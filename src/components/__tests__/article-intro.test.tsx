// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleIntro } from "../article-intro";

// jsdom does not implement matchMedia, which the theme toggle in the opposite
// gutter resolves `system` mode through.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false }),
});

describe("ArticleIntro", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the title and the Index back link", () => {
    render(<ArticleIntro title="Hello World" />);

    expect(screen.getByRole("heading", { name: "Hello World" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Index" })).toBeDefined();
  });

  it("still renders the Index back link when there is no title", () => {
    render(<ArticleIntro />);

    expect(screen.getByRole("link", { name: "Index" })).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("carries its label in a hover tooltip, not beside the icon", () => {
    render(<ArticleIntro title="Hello World" />);

    const link = screen.getByRole("link", { name: "Index" });
    // Icon only — the glyph is an <svg>, so the anchor holds no text of its own.
    expect(link.textContent).toBe("");

    const tip = screen.getByText("Index").parentElement as HTMLElement;
    expect(tip.getAttribute("aria-hidden")).toBe("true");
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.mouseEnter(link, { clientX: 5, clientY: 5 });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    fireEvent.mouseLeave(link);
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });

  it("omits the heading for an empty or null title", () => {
    const { rerender } = render(<ArticleIntro title="" />);
    expect(screen.queryByRole("heading")).toBeNull();

    rerender(<ArticleIntro title={null} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("link", { name: "Index" })).toBeDefined();
  });
});
