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

// jsdom has no matchMedia; stubbed per test so `system` mode resolves both ways.
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

  it("offers dark while the page is light", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Dark theme" })).toBeDefined();
  });

  it("offers light while the page is dark", () => {
    mockMode.mockReturnValue("dark");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Light theme" })).toBeDefined();
  });

  it("reads the system preference when the mode follows the system", () => {
    mockMode.mockReturnValue("system");
    mockPrefersDark.mockReturnValue(true);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Light theme" })).toBeDefined();
  });

  it("switches to the theme it offered", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(mockSetMode).toHaveBeenCalledWith("dark");
  });

  it("switches back the other way", () => {
    mockMode.mockReturnValue("dark");
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
    expect(mockSetMode).toHaveBeenCalledWith("light");
  });

  it("ships both glyphs so the paint never shows the wrong one", () => {
    const { container } = render(<ThemeToggle />);
    expect(container.querySelectorAll("[data-theme-glyph]").length).toBe(2);
  });
});
