// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Header } from "../header";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";

const mockPathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// jsdom has no matchMedia; the theme toggle resolves `system` mode through it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockReturnValue({ matches: false }),
});

/** Claim the field the shortcut's platform detection reads first. */
function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "userAgentData", {
    value: { platform },
    configurable: true,
  });
}

describe("Header", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/");
  });

  afterEach(() => {
    cleanup();
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  });

  it("holds only the menu and the theme toggle on the home page, no logo", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("button", { name: "Menu" })).toBeDefined();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText("DESIGNER • BUILDER • ENGINEER •")).toBeNull();
  });

  it("draws the menu and the theme toggle as tertiary circles", () => {
    render(<Header />);
    for (const name of ["Menu", "Dark theme"]) {
      const cls = screen.getByRole("button", { name }).className;
      expect(cls).toContain("shape_circle");
      expect(cls).toContain("emphasis_tertiary");
    }
  });

  it("asks for the command palette when the menu button is pressed", () => {
    const open = vi.fn();
    const stop = subscribeCommandPalette(open);
    render(<Header />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(open).toHaveBeenCalledTimes(1);
    stop();
  });

  it("writes the shortcut with the key the platform actually types", () => {
    stubPlatform("Windows");
    render(<Header />);
    expect(screen.getByText("Ctrl K").tagName).toBe("KBD");
    expect(screen.queryByText("⌘K")).toBeNull();
  });

  it("shows the ⌘K shortcut beside the menu, and names it on hover", () => {
    stubPlatform("macOS");
    render(<Header />);

    expect(screen.getByText("⌘K").tagName).toBe("KBD");

    const menu = screen.getByRole("button", { name: "Menu" });
    const tip = screen.getByText("Menu").parentElement as HTMLElement;
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.pointerEnter(menu, {
      pointerType: "mouse",
      clientX: 5,
      clientY: 5,
    });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    fireEvent.pointerLeave(menu, { pointerType: "mouse" });
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });

  it("renders nothing on non-home pages", () => {
    mockPathname.mockReturnValue("/writing/my-article");
    const { container } = render(<Header />);
    expect(container.firstChild).toBeNull();
  });
});
