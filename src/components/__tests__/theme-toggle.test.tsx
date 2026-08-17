// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThemeToggle } from "../theme-toggle";
import type { ThemeMode } from "@/store/theme";

const mockSetMode = vi.fn();
const mockMode = vi.fn<() => ThemeMode>(() => "light");

vi.mock("@/store/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/store/theme")>()),
  useThemeStore: () => ({ mode: mockMode(), setMode: mockSetMode }),
}));

// jsdom does not implement matchMedia — controllable per test, so `system`
// mode can be resolved both ways.
const mockPrefersDark = vi.fn(() => false);
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({ matches: mockPrefersDark() })),
});

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockMode.mockReturnValue("light");
    mockPrefersDark.mockReturnValue(false);
    mockSetMode.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  // The control names the theme it OFFERS, not the one in force — it is a
  // door, and a door is labelled with the room on the other side of it.
  it("offers dark while the page is light", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeDefined();
  });

  it("offers light while the page is dark", () => {
    mockMode.mockReturnValue("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeDefined();
  });

  it("reads the system preference when the mode follows the system", () => {
    mockMode.mockReturnValue("system");
    mockPrefersDark.mockReturnValue(true);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeDefined();
  });

  it("switches to the theme it offered", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(mockSetMode).toHaveBeenCalledWith("dark");
  });

  it("switches back the other way", () => {
    mockMode.mockReturnValue("dark");
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(mockSetMode).toHaveBeenCalledWith("light");
  });

  // Both glyphs ship on every render and CSS picks between them, so the icon is
  // right in the FIRST painted frame — a JS-chosen icon would have to wait for
  // the mount that the label waits for, and be visibly wrong until then.
  it("ships both glyphs so the paint never shows the wrong one", () => {
    const { container } = render(<ThemeToggle />);
    expect(container.querySelectorAll("[data-theme-glyph]").length).toBe(2);
  });
});
