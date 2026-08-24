// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeMode } from "@/store/theme";

// Every shader the playground can mount, stubbed. They all end in a
// `ShaderMount`, which asks for a webgl2 context jsdom does not have — and what
// is under test here is the page around the canvas, not the picture inside it.
vi.mock("@paper-design/shaders-react", () => ({
  ColorPanels: () => null,
  GodRays: () => null,
  StaticMeshGradient: () => null,
  Swirl: () => null,
  Warp: () => null,
}));

vi.mock("@/components/shaders/cosmic-track", () => ({
  CosmicTrack: () => null,
}));

// The playground's toggle writes to the SITE's theme store, which is the whole
// point of it — so the store is what this asserts against.
const mockSetMode = vi.fn();
const mockMode = vi.fn<() => ThemeMode>(() => "dark");

vi.mock("@/store/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/store/theme")>()),
  useThemeStore: () => ({ mode: mockMode(), setMode: mockSetMode }),
}));

// jsdom does not implement matchMedia; `useThemeToggle` resolves `system`
// through it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({ matches: false })),
});

const { CoverPlayground } = await import("../cover-playground");

describe("CoverPlayground theme toggle", () => {
  beforeEach(() => {
    mockMode.mockReturnValue("dark");
    mockSetMode.mockClear();
  });
  afterEach(cleanup);

  it("carries the site's two gutter controls, in the canvas", () => {
    const { container } = render(<CoverPlayground />);
    const canvas = container.querySelector("main > div");
    const control = screen.getByRole("button", { name: "Light theme" });
    const back = screen.getByRole("link", { name: "Index" });

    expect(canvas?.contains(control)).toBe(true);
    // The way back sits with it, as it does on an article — and it goes to the
    // front page, not backwards through history.
    expect(canvas?.contains(back)).toBe(true);
    expect(back.getAttribute("href")).toBe("/");
    // Both glyphs ship and the cascade picks — the site's own mechanism, which
    // works here because the theme is the document's.
    expect(container.querySelectorAll("[data-theme-glyph]").length).toBe(2);
  });

  it("makes the page give up the width its rail occupies", () => {
    render(<CoverPlayground />);
    // The rail here is the recipe, not the dismissible component, so the page
    // asks for the inset itself — the same one every other panel in the app
    // gets, rather than a width reserved a second way on this page.
    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);
  });

  it("switches the whole site's theme, not a local one", async () => {
    const user = userEvent.setup();
    const { container } = render(<CoverPlayground />);

    await user.click(
      screen.getByRole("button", { name: "Light theme" }),
    );

    expect(mockSetMode).toHaveBeenCalledWith("light");
    // Nothing in the playground holds a theme of its own — no scoped override to
    // leave the page and the canvas disagreeing.
    expect(container.querySelector("[data-theme]")).toBeNull();
  });
});
