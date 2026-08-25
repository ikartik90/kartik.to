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
    const menu = screen.getByRole("button", { name: "Menu" });

    expect(canvas?.contains(control)).toBe(true);
    // The menu sits with it, as it does on an article — and the way back is
    // inside it now, as "Back to index", rather than being a control of its own.
    expect(canvas?.contains(menu)).toBe(true);
    expect(screen.queryByRole("link", { name: "Index" })).toBeNull();
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

// ---------------------------------------------------------------------------
// The panel as a BOTTOM SHEET. Which shape it takes is CSS — one media query,
// stated once in `panda.config.ts` — so what is testable here is the state the
// CSS keys off: whether the sheet has been sent away, and the control that
// brings it back. Deliberately so: a phone turned on its side must find its
// rail again, and it does that by nothing outside that media query ever
// reading `data-dismissed`.
// ---------------------------------------------------------------------------
describe("CoverPlayground bottom sheet", () => {
  afterEach(cleanup);

  const panel = () => screen.getByRole("complementary", { name: "Properties" });
  const reopen = () => screen.queryByRole("button", { name: "Properties" });

  it("opens with the panel up, and nothing offering to open it", () => {
    render(<CoverPlayground />);

    expect(panel().hasAttribute("data-dismissed")).toBe(false);
    expect(reopen()).toBeNull();
  });

  it("sends the sheet away from the close button in its header", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground />);

    await user.click(screen.getByRole("button", { name: "Close properties" }));

    expect(panel().hasAttribute("data-dismissed")).toBe(true);
  });

  it("offers the way back beside the theme toggle, once it has gone", async () => {
    const user = userEvent.setup();
    const { container } = render(<CoverPlayground />);

    await user.click(screen.getByRole("button", { name: "Close properties" }));

    const button = reopen();
    const toggle = screen.getByRole("button", { name: "Light theme" });
    expect(button).not.toBeNull();
    // Beside the toggle, in the canvas's own gutter row — not a third thing
    // floating somewhere else on the page.
    expect(button?.parentElement).toBe(toggle.parentElement);
    expect(container.querySelector("main > div")?.contains(button!)).toBe(true);
  });

  it("brings the sheet back, and stops offering to", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground />);

    await user.click(screen.getByRole("button", { name: "Close properties" }));
    await user.click(reopen()!);

    expect(panel().hasAttribute("data-dismissed")).toBe(false);
    expect(reopen()).toBeNull();
  });
});
