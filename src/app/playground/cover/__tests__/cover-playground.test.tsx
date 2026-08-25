// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
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

// The presets strip reaches the database, through a `"use server"` module that
// validates DATABASE_URL at import time and throws in a run with no `.env`. The
// session is stubbed alongside it: signed OUT by default, which is what a
// visitor to this public playground is.
vi.mock("@/app/actions/cover", () => ({
  getCovers: vi.fn().mockResolvedValue([]),
  getCover: vi.fn(),
  createCover: vi.fn(),
  saveCover: vi.fn(),
  deleteCover: vi.fn(),
}));

const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
const { useCoverDraftStore } = await import("@/store/cover-draft");

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

// ---------------------------------------------------------------------------
// The aspect toolbar — the frame the cover is being designed against.
//
// A cover is SHAPELESS: nothing that embeds one reads this. It is a viewing
// frame for the author (does this fan still read on a banner?) and a note the
// draft carries, so reopening the cover reopens the shape it was judged in.
// ---------------------------------------------------------------------------
describe("CoverPlayground aspect toolbar", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());
  afterEach(cleanup);

  const aspectRail = () =>
    screen.getByRole("toolbar", { name: "Preview aspect ratio" });

  // It rides in the gutter row rather than travelling with the picture: the
  // frame is a property of the page, and it holds still while the cover
  // changes shape underneath it.
  it("stands in the gutter row, between the menu and the theme toggle", () => {
    render(<CoverPlayground />);
    const rail = aspectRail();
    const menu = screen.getByRole("button", { name: "Menu" });
    const toggle = screen.getByRole("button", { name: "Light theme" });

    // The row itself — the one box that holds all three. Found from the rail
    // rather than named by class, so the assertion is about what sits together
    // rather than about what anything is called.
    // The INNERMOST such box — the canvas contains all three as well, and it is
    // the row they share that this is about.
    const band = Array.from(document.querySelectorAll("div"))
      .filter(
        (el) => el.contains(menu) && el.contains(toggle) && el.contains(rail),
      )
      .pop();
    const order = Array.from(band?.children ?? []);

    expect(order.length).toBe(3);
    expect(order[0].contains(menu)).toBe(true);
    expect(order[1].contains(rail)).toBe(true);
    expect(order[2].contains(toggle)).toBe(true);
  });

  it("opens on the shape the draft is being designed at", () => {
    render(<CoverPlayground />);
    expect(
      aspectRail()
        .querySelector('button[aria-pressed="true"]')
        ?.getAttribute("aria-label"),
    ).toBe("9:16");
  });

  // The frame is a note on the cover, so it goes where the rest of the authored
  // state goes — into the draft the palette saves.
  it("records the shape on the draft", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground />);

    await user.click(screen.getByRole("button", { name: "1:1" }));

    expect(useCoverDraftStore.getState().settings.aspect).toBe("1/1");
    expect(useCoverDraftStore.getState().isDirty).toBe(true);
  });

  // And it reshapes the preview, which is the point of the control: the same
  // uniforms read differently on a banner and on a poster.
  it("reshapes the preview to the chosen frame", async () => {
    const user = userEvent.setup();
    const { container } = render(<CoverPlayground />);
    const cover = () =>
      container.querySelector<HTMLElement>("[data-cover-stage]");

    expect(cover()?.style.getPropertyValue("--cover-w")).toBe("9");
    expect(cover()?.style.getPropertyValue("--cover-h")).toBe("16");

    // The rail opens on the portrait list, since the poster it opens on is
    // portrait — so a banner is one press away rather than a shape you have to
    // go looking for.
    await user.click(
      screen.getByRole("button", { name: "Switch to landscape" }),
    );

    expect(cover()?.style.getPropertyValue("--cover-w")).toBe("16");
    expect(cover()?.style.getPropertyValue("--cover-h")).toBe("9");
  });

  // A saved cover reopens in the frame it was designed in, not in the default.
  it("opens a saved cover on its own shape", () => {
    render(
      <CoverPlayground
        cover={{
          id: "cover-1",
          title: "Dusk",
          shaderId: "swirl",
          settings: {
            ...defaultState(SHADER_SPECS.swirl),
            aspect: "3/2",
          },
        }}
      />,
    );

    expect(
      aspectRail()
        .querySelector('button[aria-pressed="true"]')
        ?.getAttribute("aria-label"),
    ).toBe("3:2");
  });
});

// ---------------------------------------------------------------------------
// The presets strip — the author's saved covers, along the foot of the canvas.
//
// Signed-in only. The playground itself is public and stays public: tuning a
// shader is not a privilege, and only the saved library is.
// ---------------------------------------------------------------------------
describe("CoverPlayground presets", () => {
  beforeEach(() => {
    useCoverDraftStore.getState().reset();
    mockUseSession.mockReturnValue({ data: null });
  });
  afterEach(cleanup);

  const strip = () => screen.queryByRole("group", { name: "Presets" });

  it("shows a visitor no strip at all", () => {
    render(<CoverPlayground />);
    expect(strip()).toBeNull();
  });

  it("gives the author theirs, in the canvas", async () => {
    mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
    const { container } = render(<CoverPlayground />);

    // One commit later than the first render, deliberately: the session is
    // invisible to the server, so an admin-only node on the hydrating render
    // would be React error #418. See `useIsAdmin`.
    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  // The picture gives up the band the strip stands in, the way it already gives
  // up the gutter row: chrome must not cover the thing being judged.
  it("makes the page reserve the strip's band, and only then", async () => {
    const { container, rerender } = render(<CoverPlayground />);
    const main = () => container.querySelector("main");
    expect(main()?.hasAttribute("data-presets")).toBe(false);

    mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
    rerender(<CoverPlayground />);
    await waitFor(() => expect(main()?.hasAttribute("data-presets")).toBe(true));
  });
});
