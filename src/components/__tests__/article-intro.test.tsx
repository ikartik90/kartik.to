// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArticleIntro } from "../article-intro";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";

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

  it("renders the title and the menu button", () => {
    render(<ArticleIntro title="Hello World" />);

    expect(screen.getByRole("heading", { name: "Hello World" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Menu" })).toBeDefined();
  });

  it("still renders the menu button when there is no title", () => {
    render(<ArticleIntro />);

    expect(screen.getByRole("button", { name: "Menu" })).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("no longer carries a back link of its own — the palette holds it", () => {
    render(<ArticleIntro title="Hello World" />);

    expect(screen.queryByRole("link", { name: "Index" })).toBeNull();
  });

  it("asks for the command palette when the menu button is pressed", () => {
    const open = vi.fn();
    const stop = subscribeCommandPalette(open);
    render(<ArticleIntro title="Hello World" />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(open).toHaveBeenCalledTimes(1);
    stop();
  });

  it("carries its label in a hover tooltip, not beside the icon", () => {
    render(<ArticleIntro title="Hello World" />);

    const button = screen.getByRole("button", { name: "Menu" });
    // Icon only — the glyph is an <svg>, so the button holds no text of its own.
    expect(button.textContent).toBe("");

    const tip = screen.getByText("Menu").parentElement as HTMLElement;
    expect(tip.getAttribute("aria-hidden")).toBe("true");
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.mouseEnter(button, { clientX: 5, clientY: 5 });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    fireEvent.mouseLeave(button);
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });

  it("omits the heading for an empty or null title", () => {
    const { rerender } = render(<ArticleIntro title="" />);
    expect(screen.queryByRole("heading")).toBeNull();

    rerender(<ArticleIntro title={null} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByRole("button", { name: "Menu" })).toBeDefined();
  });
});
