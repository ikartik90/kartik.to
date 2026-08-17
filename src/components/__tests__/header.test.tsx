// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Header } from "../header";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";

const mockPathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

describe("Header", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the circular logo, title, and tagline on the home page", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeDefined();
    expect(
      document.querySelector('img[src*="kartik-iyer-logo"]'),
    ).not.toBeNull();
    expect(screen.getByText("Kartik Iyer")).toBeDefined();
    expect(screen.getByText("DESIGNER • BUILDER • ENGINEER •")).toBeDefined();
  });

  it("asks for the command palette when the menu button is pressed", () => {
    const open = vi.fn();
    const stop = subscribeCommandPalette(open);
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(open).toHaveBeenCalledTimes(1);
    stop();
  });

  it("shows the ⌘K shortcut beside the menu, and names it on hover", () => {
    render(<Header />);

    // The shortcut is the resting label; CSS is what withholds it from a
    // touch-first device and hides it under the cursor.
    expect(screen.getByText("⌘K").tagName).toBe("KBD");

    const menu = screen.getByRole("button", { name: "Menu" });
    const tip = screen.getByText("Menu").parentElement as HTMLElement;
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.mouseEnter(menu, { clientX: 5, clientY: 5 });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    fireEvent.mouseLeave(menu);
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });

  it("renders nothing on non-home pages", () => {
    mockPathname.mockReturnValue("/writing/my-article");
    const { container } = render(<Header />);
    expect(container.firstChild).toBeNull();
  });
});
