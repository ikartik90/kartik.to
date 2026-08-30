// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { MenuButton } from "../menu-button";
import { subscribeCommandPalette } from "@/utils/command-palette-channel";

/** Claim the field the shortcut's platform detection reads first. */
function stubPlatform(platform: string) {
  Object.defineProperty(navigator, "userAgentData", {
    value: { platform },
    configurable: true,
  });
}

describe("MenuButton", () => {
  afterEach(() => {
    cleanup();
    delete (navigator as { userAgentData?: unknown }).userAgentData;
  });

  it("asks for the command palette when pressed", () => {
    const open = vi.fn();
    const stop = subscribeCommandPalette(open);
    render(<MenuButton />);

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    expect(open).toHaveBeenCalledTimes(1);
    stop();
  });

  it("writes the shortcut with the key the platform actually types", () => {
    stubPlatform("Windows");
    render(<MenuButton />);

    expect(screen.getByText("Ctrl K").tagName).toBe("KBD");
    expect(screen.queryByText("⌘K")).toBeNull();
  });

  it("carries the icon's name in a hover tooltip, not beside it", () => {
    stubPlatform("macOS");
    render(<MenuButton />);

    const button = screen.getByRole("button", { name: "Menu" });
    // Icon only — the glyph is an <svg>, so the button holds no text of its own.
    expect(button.textContent).toBe("");
    expect(screen.getByText("⌘K").tagName).toBe("KBD");

    const tip = screen.getByText("Menu").parentElement as HTMLElement;
    expect(tip.getAttribute("aria-hidden")).toBe("true");
    expect(tip.hasAttribute("data-visible")).toBe(false);

    fireEvent.pointerEnter(button, {
      pointerType: "mouse",
      clientX: 5,
      clientY: 5,
    });
    expect(tip.hasAttribute("data-visible")).toBe(true);

    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    expect(tip.hasAttribute("data-visible")).toBe(false);
  });
});
