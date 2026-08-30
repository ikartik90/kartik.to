// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Header } from "../header";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";

const mockPathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// jsdom does not implement matchMedia, which the theme toggle in the opposite
// gutter resolves `system` mode through.
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

  it("renders the circular logo and its tagline on the home page", () => {
    render(<Header />);
    expect(screen.getByRole("banner")).toBeDefined();
    expect(
      document.querySelector('img[src*="kartik-iyer-logo"]'),
    ).not.toBeNull();
    expect(screen.getByText("DESIGNER • BUILDER • ENGINEER •")).toBeDefined();
  });

  it("leaves the name to the logo rather than setting it beside it", () => {
    render(<Header />);
    // Nothing spells the name out in the row any more, so the picture has to
    // carry it — an empty alt would drop it from the page entirely.
    expect(screen.queryByText("Kartik Iyer")).toBeNull();
    expect(screen.getByAltText("Kartik Iyer")).toBeDefined();
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

    // The shortcut is the resting label; CSS is what withholds it from a
    // touch-first device and hides it under the cursor.
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
