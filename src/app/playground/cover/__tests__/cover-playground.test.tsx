// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import { FRAMING_DEFAULTS, shaderParamsFor } from "@/domain/cover";
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
  publishCover: vi.fn(),
  unpublishCover: vi.fn(),
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
const { getCovers, publishCover, unpublishCover, deleteCover } = await import(
  "@/app/actions/cover"
);

/** Signed in as the author, and signed out as anybody else. */
const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
const signedOut = () => mockUseSession.mockReturnValue({ data: null });

const SETTINGS = {
  ...defaultState(SHADER_SPECS.cosmicTrack),
  framing: {},
};

/** A saved cover this route was opened on, still the author's alone. */
const savedCover = {
  id: "cover-1",
  title: "Dusk",
  shaderId: "cosmicTrack" as const,
  settings: SETTINGS,
  publishedAt: null,
};

/** One row as `getCovers` hands it over — published, which is the only kind a visitor is given. */
const publishedCover = {
  ...savedCover,
  untitledIndex: null,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

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
// "Reset params" — the button that undoes an experiment.
//
// WHERE it undoes to depends on what is behind the draft — the preset you
// opened, or the shader's defaults where no preset has been saved — and that is
// the store's to decide, not the label's. So what is worth asserting here is
// which of the two the button actually lands on.
// ---------------------------------------------------------------------------
describe("CoverPlayground reset control", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());
  afterEach(cleanup);

  // Opened THROUGH THE ROUTE'S PROP, which is how a preset actually arrives:
  // the page seeds the draft from it on mount, and would reset a draft seeded
  // any other way straight back to blank.
  const saved = {
    id: "cover-1",
    title: "Dusk",
    shaderId: "cosmicTrack" as const,
    settings: {
      ...defaultState(SHADER_SPECS.cosmicTrack),
      params: {
        ...defaultState(SHADER_SPECS.cosmicTrack).params,
        rampLength: 4,
      },
      framing: {},
    },
    publishedAt: null,
  };

  const resetButton = () => screen.getByRole("button", { name: "Reset" });

  // In the panel's own header, opposite the heading — it acts on everything
  // below it, so it belongs to the panel rather than sitting in a section that
  // is only one of the things it resets.
  it("stands in the panel header, opposite the heading", () => {
    render(<CoverPlayground />);
    const header = screen.getByText("Properties").parentElement;

    expect(header?.contains(resetButton())).toBe(true);
  });

  // Driven through the control itself rather than the store action, so the
  // header button and the rule behind it are tested as one thing.
  it("puts the params back to the preset's, not the table's", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground cover={saved} />);

    act(() => useCoverDraftStore.getState().setParam("rampLength", 9));
    await user.click(resetButton());

    expect(useCoverDraftStore.getState().settings.params.rampLength).toBe(4);
  });

  // A preset's params belong to the shader it was authored on, so switching
  // away has to leave the baseline behind with it. Driven through the store
  // rather than the popover: WHICH control picks the shader is not what this is
  // about.
  it("falls back to the new shader's defaults after a switch", () => {
    render(<CoverPlayground cover={saved} />);

    act(() => useCoverDraftStore.getState().selectShader("godRays"));
    act(() => useCoverDraftStore.getState().setParam("density", 9));
    fireEvent.click(resetButton());

    expect(useCoverDraftStore.getState().settings.params).toEqual(
      defaultState(SHADER_SPECS.godRays).params,
    );
  });
});

// ---------------------------------------------------------------------------
// The Motion group — what MOVES, kept together.
//
// Speed is shared by every shader that samples time. A shader can also put its
// own timing controls here, which is not the same as them being shared: they
// are that shader's uniforms, and only it has them.
// ---------------------------------------------------------------------------
describe("CoverPlayground motion group", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());
  afterEach(cleanup);

  const motionGroup = () => screen.getByRole("group", { name: "Motion" });

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers a shader's own timing controls in with the shared Speed", () => {
    render(<CoverPlayground />);

    expect(labelsIn(motionGroup())).toEqual(
      expect.arrayContaining(["Speed", "Interval", "Easing", "Easing Bias"]),
    );
  });

  // They are the shader's uniforms, not the shared block's, so they must not
  // also appear among the geometry sliders the panel groups by default.
  it("keeps them out of the shader's own parameters", () => {
    render(<CoverPlayground />);
    const params = screen.getByRole("group", { name: "Track" });

    expect(labelsIn(params)).not.toContain("Easing");
  });
});

// ---------------------------------------------------------------------------
// The Ramp group — where the colours SIT along the track, and how they are
// shared out between the bands.
//
// Under Track, because it is drawn ON the track: the fan's geometry is decided
// first and the ramp is laid along it. What stays in Track is that geometry,
// which the ramp is drawn on but does not decide.
// ---------------------------------------------------------------------------
describe("CoverPlayground ramp group", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());
  afterEach(cleanup);

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the ramp controls into one section", () => {
    render(<CoverPlayground />);

    expect(labelsIn(screen.getByRole("group", { name: "Ramp" }))).toEqual([
      "Phase",
      "Travel",
      "Stagger",
      "Symmetry",
      // Not "Ramp Length" — the section already says ramp.
      "Length",
      "Tail",
    ]);
  });

  it("takes them out of the shader's own parameters", () => {
    render(<CoverPlayground />);
    const params = labelsIn(screen.getByRole("group", { name: "Track" }));

    for (const label of ["Phase", "Travel", "Stagger", "Symmetry", "Length", "Tail"]) {
      expect(params).not.toContain(label);
    }
  });

  // The fan's geometry stays where it was — the split is between where the
  // colours sit and what they are drawn on, not a wholesale emptying.
  it("leaves the fan's own geometry in Track", () => {
    render(<CoverPlayground />);

    expect(labelsIn(screen.getByRole("group", { name: "Track" }))).toEqual(
      expect.arrayContaining(["Spread", "Bandwidth", "Roundness", "Apex"]),
    );
  });

  it("is absent for a shader that has none", () => {
    render(<CoverPlayground />);
    act(() => useCoverDraftStore.getState().selectShader("godRays"));

    expect(screen.queryByRole("group", { name: "Ramp" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The Edge group — the rails, and how hard a band meets what is beside it.
//
// The rails' COLOUR stays with the other swatches; what gathers here is the
// three numbers that decide how the edge reads: how wide the line is, how
// sharply the fill ends, and how far the line outlives the fill.
// ---------------------------------------------------------------------------
describe("CoverPlayground edge group", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());
  afterEach(cleanup);

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the edge controls into one section", () => {
    render(<CoverPlayground />);

    expect(labelsIn(screen.getByRole("group", { name: "Edge" }))).toEqual([
      "Edge Width",
      "Softness",
      "Edge Tail",
    ]);
  });

  it("takes them out of the shader's own parameters", () => {
    render(<CoverPlayground />);
    const params = labelsIn(screen.getByRole("group", { name: "Track" }));

    for (const label of ["Edge Width", "Softness", "Edge Tail"]) {
      expect(params).not.toContain(label);
    }
  });

  // The swatch is not one of them: a colour belongs with the colours.
  it("leaves the rails' colour with the other swatches", () => {
    render(<CoverPlayground />);
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Edge");
    expect(colours).not.toContain("Edge Width");
  });

  it("is absent for a shader that has none", () => {
    render(<CoverPlayground />);
    act(() => useCoverDraftStore.getState().selectShader("godRays"));

    expect(screen.queryByRole("group", { name: "Edge" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The Dither group — the ordered-dither controls, kept together.
//
// They are one mechanism read three ways: two strengths over a single Bayer
// matrix, and the cell size that matrix is sampled at. Scattered among the
// geometry sliders, only their names said they were related.
// ---------------------------------------------------------------------------
describe("CoverPlayground dither group", () => {
  beforeEach(() => useCoverDraftStore.getState().reset());
  afterEach(cleanup);

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the dither controls into one section", () => {
    render(<CoverPlayground />);

    expect(labelsIn(screen.getByRole("group", { name: "Dither" }))).toEqual([
      "Ramp Dither",
      "Edge Dither",
      "Dither Size",
    ]);
  });

  it("takes them out of the shader's own parameters", () => {
    render(<CoverPlayground />);
    const params = labelsIn(screen.getByRole("group", { name: "Track" }));

    expect(params).not.toContain("Ramp Dither");
    expect(params).not.toContain("Edge Dither");
    expect(params).not.toContain("Dither Size");
  });

  // A shader with no dither controls must not grow an empty strip for them —
  // the same rule the Motion group follows.
  it("is absent for a shader that has none", () => {
    render(<CoverPlayground />);
    act(() => useCoverDraftStore.getState().selectShader("godRays"));

    expect(screen.queryByRole("group", { name: "Dither" })).toBeNull();
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

  // SQUARE, every time. A cover records no shape of its own any more — it is
  // framed for all of them — so there is nothing to reopen in, and the neutral
  // frame is the one that shows the composition rather than a crop of it.
  it("opens square", () => {
    render(<CoverPlayground />);
    expect(
      aspectRail()
        .querySelector('button[aria-pressed="true"]')
        ?.getAttribute("aria-label"),
    ).toBe("1:1");
  });

  // The frame is a note on the cover, so it goes where the rest of the authored
  // state goes — into the draft the palette saves.
  it("records the shape on the draft", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground />);

    await user.click(screen.getByRole("button", { name: "4:3" }));

    expect(useCoverDraftStore.getState().aspect).toBe("4/3");
    expect(useCoverDraftStore.getState().isDirty).toBe(true);
  });

  // And it reshapes the preview, which is the point of the control: the same
  // uniforms read differently on a banner and on a poster.
  it("reshapes the preview to the chosen frame", async () => {
    const user = userEvent.setup();
    const { container } = render(<CoverPlayground />);
    const cover = () =>
      container.querySelector<HTMLElement>("[data-cover-stage]");

    // The card waits for the library read before it draws at all — see the
    // preloader. Until then there is no stage to measure.
    await waitFor(() => expect(cover()).not.toBeNull());
    expect(cover()?.style.getPropertyValue("--cover-w")).toBe("1");
    expect(cover()?.style.getPropertyValue("--cover-h")).toBe("1");

    await user.click(screen.getByRole("button", { name: "16:9" }));

    expect(cover()?.style.getPropertyValue("--cover-w")).toBe("16");
    expect(cover()?.style.getPropertyValue("--cover-h")).toBe("9");
  });

  // A saved cover reopens in the frame it was designed in, not in the default.
  // A saved cover opens square too — it carries a placement for every shape and
  // names none of them as the one to reopen in.
  it("opens a saved cover square as well", () => {
    render(
      <CoverPlayground
        cover={{
          id: "cover-1",
          title: "Dusk",
          shaderId: "swirl",
          settings: {
            ...defaultState(SHADER_SPECS.swirl),
            framing: { "3/2": { ...FRAMING_DEFAULTS, scale: 2 } },
          },
          publishedAt: null,
        }}
      />,
    );

    expect(
      aspectRail()
        .querySelector('button[aria-pressed="true"]')
        ?.getAttribute("aria-label"),
    ).toBe("1:1");
  });
});

// ---------------------------------------------------------------------------
// Deleting a preset — the header's second control.
//
// Reset and Delete share ONE slot, and which of them is in it says what there
// is to do: while the draft has unsaved work the button undoes it, and once
// there is nothing to undo it removes the preset instead. So you can never
// reach for Reset and get Delete — in every state where Reset would do
// something, Reset is what is there.
// ---------------------------------------------------------------------------
describe("CoverPlayground delete", () => {
  beforeEach(() => {
    useCoverDraftStore.getState().reset();
    signedIn();
    (getCovers as Mock).mockResolvedValue([]);
    (deleteCover as Mock).mockReset();
    (deleteCover as Mock).mockResolvedValue(undefined);
    window.history.replaceState(null, "", "/playground/cover/cover-1");

    // jsdom ships no `<dialog>` behaviour. The same stub the palette's tests
    // use: `open` is what the confirm's own effect and every query key off.
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
  });
  afterEach(cleanup);

  const deleteButton = () =>
    screen.queryByRole("button", { name: "Delete preset" });
  const reset = () => screen.queryByRole("button", { name: "Reset" });
  /**
   * Whether THIS question is up.
   *
   * Addressed by its own title, not by `querySelector("dialog")`: the presets
   * strip mounts a confirm of its own, so a bare dialog query returns whichever
   * happens to be first in the tree — which is the strip's, permanently closed.
   * Read off `open` rather than off the words in it, since a confirm is always
   * mounted and only toggles that attribute.
   */
  const asking = () =>
    !!document
      .querySelector('dialog[aria-label="Delete Preset"]')
      ?.hasAttribute("open");

  it("offers Delete on a saved preset with nothing left to reset", async () => {
    render(<CoverPlayground cover={savedCover} />);

    await waitFor(() => expect(deleteButton()).not.toBeNull());
    expect(reset()).toBeNull();
  });

  // The moment there is work to undo, the slot goes back to being Reset —
  // which is what makes the swap safe to press blind.
  it("goes back to Reset the moment the draft is edited", async () => {
    render(<CoverPlayground cover={savedCover} />);
    await waitFor(() => expect(deleteButton()).not.toBeNull());

    act(() => useCoverDraftStore.getState().setParam("rampLength", 4));

    expect(reset()).not.toBeNull();
    expect(deleteButton()).toBeNull();
  });

  // Nothing saved is nothing to delete: the blank route opens on a draft that
  // has never been written, and a Delete there would name no row.
  it("keeps Reset on a draft that has never been saved", async () => {
    render(<CoverPlayground />);

    await waitFor(() => expect(getCovers).toHaveBeenCalled());
    expect(reset()).not.toBeNull();
    expect(deleteButton()).toBeNull();
  });

  // A visitor cannot delete, and the server refuses them a second time.
  it("withholds Delete from a visitor", async () => {
    signedOut();
    render(<CoverPlayground cover={savedCover} />);

    await waitFor(() => expect(getCovers).toHaveBeenCalled());
    expect(deleteButton()).toBeNull();
    expect(reset()).not.toBeNull();
  });

  it("asks before deleting, and deletes nothing until it is answered", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground cover={savedCover} />);

    await user.click((await screen.findByRole("button", { name: "Delete preset" })));

    expect(asking()).toBe(true);
    expect(deleteCover).not.toHaveBeenCalled();
  });

  // Deleting is a deliberate "I do not want this", so the cover does not stay
  // on screen: the draft goes back to blank and the URL stops naming a row that
  // no longer exists.
  it("removes the preset and returns to a blank draft", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground cover={savedCover} />);

    await user.click(await screen.findByRole("button", { name: "Delete preset" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteCover).toHaveBeenCalledWith("cover-1"));
    await waitFor(() =>
      expect(useCoverDraftStore.getState().coverId).toBeNull(),
    );
    expect(window.location.pathname).toBe("/playground/cover");
  });

  it("stays put when the question is declined", async () => {
    const user = userEvent.setup();
    render(<CoverPlayground cover={savedCover} />);

    await user.click(await screen.findByRole("button", { name: "Delete preset" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteCover).not.toHaveBeenCalled();
    expect(useCoverDraftStore.getState().coverId).toBe("cover-1");
  });

  // A failed delete must not look like a successful one: the row is still
  // there, so the playground must still be holding it.
  it("leaves the draft alone when the delete fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (deleteCover as Mock).mockRejectedValue(new Error("no"));
    render(<CoverPlayground cover={savedCover} />);

    await user.click(await screen.findByRole("button", { name: "Delete preset" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteCover).toHaveBeenCalled());
    expect(useCoverDraftStore.getState().coverId).toBe("cover-1");
    expect(window.location.pathname).toBe("/playground/cover/cover-1");
  });
});

// ---------------------------------------------------------------------------
// The wait before the cover is drawn.
//
// A cover opened by ROUTE is settled before this component renders. The bare
// route is the one that waits: a visitor arriving there is taken to the newest
// published cover once the strip has read the library, and until that read
// lands the draft holds the control table's first shader — a cover nobody
// published, shown for a round trip and then swapped out underneath them.
// ---------------------------------------------------------------------------
describe("CoverPlayground preloader", () => {
  beforeEach(() => {
    useCoverDraftStore.getState().reset();
    signedOut();
    (getCovers as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const stage = () => document.querySelector("[data-cover-stage]");

  it("draws no cover until the library has been read", async () => {
    let settle: (rows: unknown[]) => void = () => {};
    (getCovers as Mock).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve as (rows: unknown[]) => void;
      }),
    );
    render(<CoverPlayground />);

    expect(stage()).toBeNull();

    await act(async () => {
      settle([]);
    });
    await waitFor(() => expect(stage()).not.toBeNull());
  });

  // A library that cannot be read is an answer as much as an empty one is. A
  // page that waited forever for it would be worse than one that opens blank.
  it("gives up waiting when the library cannot be read", async () => {
    (getCovers as Mock).mockRejectedValue(new Error("no"));
    render(<CoverPlayground />);

    await waitFor(() => expect(stage()).not.toBeNull());
  });

  // The route already handed the cover down, so there is nothing to wait for —
  // and a preloader in front of a cover the server already fetched would be a
  // wait invented for its own sake.
  it("draws a routed cover straight away", () => {
    render(<CoverPlayground cover={savedCover} />);

    expect(stage()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Framing, per shape — the four placement controls kept one set per aspect
// ratio, so a cover can be framed one way as a poster and another as a banner.
//
// Driven through the RAIL and the sliders rather than through the store, so the
// panel and the rule behind it are tested as one thing. The rules themselves
// are `@/domain/cover`'s and the store's own tests.
// ---------------------------------------------------------------------------
describe("CoverPlayground framing", () => {
  beforeEach(() => {
    useCoverDraftStore.getState().reset();
    signedOut();
    (getCovers as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const rail = () => screen.getByRole("toolbar", { name: "Preview aspect ratio" });
  const pick = (ratio: string) =>
    fireEvent.click(within(rail()).getByRole("button", { name: ratio }));
  const flip = (to: "portrait" | "landscape") =>
    fireEvent.click(
      within(rail()).getByRole("button", { name: `Switch to ${to}` }),
    );

  /** The Framing group's slider for one control, read off the panel. */
  const framingSlider = (label: string) => {
    const group = screen.getByRole("group", { name: /^Framing/ });
    return within(group)
      .getAllByRole("slider")
      .find((node) => node.closest("[data-field]")?.textContent?.startsWith(label));
  };

  // The heading names the SHAPE, because the sliders under it apply to one. A
  // panel reading plain "Framing" beside ten other framings you cannot see
  // would be the only thing on it that lies.
  it("names the shape its placement controls apply to", () => {
    render(<CoverPlayground />);

    expect(screen.getByRole("group", { name: "Framing 1:1" })).toBeTruthy();
    pick("4:3");
    expect(screen.getByRole("group", { name: "Framing 4:3" })).toBeTruthy();
  });

  // Two shapes of ONE orientation, so nothing here is the quarter turn — what
  // is under test is that each shape holds its own. Rotation rather than scale
  // because its step lands on whole numbers, where scale's grid starts at 0.01
  // and the slider would report 3.01 for a stored 3.
  it("keeps a placement per shape, and gives each one back", () => {
    render(<CoverPlayground />);
    pick("16:9");

    act(() => useCoverDraftStore.getState().setFraming("rotation", 30));
    pick("4:3");
    act(() => useCoverDraftStore.getState().setFraming("rotation", -90));

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("-90");
    pick("16:9");
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  // Turning the frame over is not a special case — the other side is a shape
  // you have not framed yet, and it opens on what you arrived with so that
  // reframing it is yours to do rather than yours to undo.
  it("carries the placement across an orientation change, unchanged", () => {
    render(<CoverPlayground />);
    // From a shape that HAS another side. The playground opens square, and a
    // square is neither orientation — flipping one turns the list over and
    // leaves the card where it is.
    pick("4:3");

    act(() => useCoverDraftStore.getState().setFraming("rotation", 30));
    flip("portrait");

    expect(screen.getByRole("group", { name: "Framing 3:4" })).toBeTruthy();
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  // And then the two sides are framed apart, which is the point of the split.
  it("lets the two sides of an orientation pair be framed apart", () => {
    render(<CoverPlayground />);
    pick("4:3");

    act(() => useCoverDraftStore.getState().setFraming("rotation", 30));
    flip("portrait");
    act(() => useCoverDraftStore.getState().setFraming("rotation", -90));

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("-90");
    flip("landscape");
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  // A different crop of the same composition, so nothing turns.
  it("carries the placement between shapes of one orientation", () => {
    render(<CoverPlayground />);

    pick("16:9");
    act(() => useCoverDraftStore.getState().setFraming("rotation", 30));
    pick("4:3");

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  // The placement is what the CANVAS is given — the split is about where a
  // value is kept, and the shader takes one object. Read off the store rather
  // than the stubbed canvas, which draws nothing in jsdom.
  it("hands the shader the placement of the shape on screen", () => {
    render(<CoverPlayground />);

    act(() => useCoverDraftStore.getState().setFraming("scale", 2));
    const { settings, aspect } = useCoverDraftStore.getState();

    expect(shaderParamsFor(settings, aspect).scale).toBe(2);
    expect("scale" in settings.params).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The presets strip — the saved covers, along the foot of the canvas.
//
// PUBLIC. A visitor is shown the covers that have been published and can open
// any of them; what signing in adds is the add tile, which is the pane's own
// business (see `presets-pane`). What this file owns is where the strip sits
// and the band the picture gives up for it.
// ---------------------------------------------------------------------------
describe("CoverPlayground presets", () => {
  beforeEach(() => {
    useCoverDraftStore.getState().reset();
    signedOut();
    (getCovers as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const strip = () => screen.queryByRole("group", { name: "Presets" });

  it("shows a visitor with nothing published no strip at all", async () => {
    render(<CoverPlayground />);

    await waitFor(() => expect(getCovers).toHaveBeenCalled());
    expect(strip()).toBeNull();
  });

  it("gives the author theirs, in the canvas", async () => {
    signedIn();
    const { container } = render(<CoverPlayground />);

    // One commit later than the first render, deliberately: the session is
    // invisible to the server, so an admin-only node on the hydrating render
    // would be React error #418. See `useIsAdmin`.
    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  it("gives a visitor the published library, in the same place", async () => {
    (getCovers as Mock).mockResolvedValue([publishedCover]);
    const { container } = render(<CoverPlayground />);

    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  // The picture gives up the band the strip stands in, the way it already gives
  // up the gutter row: chrome must not cover the thing being judged.
  //
  // Reserved off whether a strip was DRAWN rather than off the session, which
  // is what makes the visitor case work — the page reads `data-presets` on the
  // pane through `:has()`, which jsdom applies no styles for, so what is
  // asserted here is that the pane says so and that the page can see it.
  it("marks the strip so the page can reserve its band, and only then", async () => {
    const { container } = render(<CoverPlayground />);
    const main = () => container.querySelector("main");

    await waitFor(() => expect(getCovers).toHaveBeenCalled());
    expect(main()?.querySelector("[data-presets]")).toBeNull();

    cleanup();
    signedIn();
    const signedInRender = render(<CoverPlayground />);

    await waitFor(() =>
      expect(
        signedInRender.container.querySelector("main [data-presets]"),
      ).not.toBeNull(),
    );
  });
});

// ---------------------------------------------------------------------------
// What the author is shown on top of the playground everybody gets: the shader
// picker, and the button that puts a cover on show.
// ---------------------------------------------------------------------------
describe("CoverPlayground authoring controls", () => {
  beforeEach(() => {
    useCoverDraftStore.getState().reset();
    signedOut();
    (getCovers as Mock).mockResolvedValue([]);
    (publishCover as Mock).mockReset();
    (unpublishCover as Mock).mockReset();
  });
  afterEach(cleanup);

  const shaderGroup = () => screen.queryByRole("group", { name: "Shader" });
  const publishButton = () => screen.queryByRole("button", { name: "Publish" });
  const unpublishButton = () =>
    screen.queryByRole("button", { name: "Unpublish" });

  // A visitor came for the cover in front of them. A picker that swapped it for
  // a bare shader would throw that cover away with nothing to get it back —
  // while every control BELOW it acts on the cover they are looking at, which
  // is the whole of what they can play with.
  it("withholds the shader picker from a visitor, and keeps its controls", () => {
    render(<CoverPlayground />);

    expect(shaderGroup()).toBeNull();
    expect(screen.getByRole("group", { name: "Colours" })).toBeTruthy();
    expect(screen.getByRole("group", { name: /^Framing/ })).toBeTruthy();
  });

  it("gives the author the shader picker", async () => {
    signedIn();
    render(<CoverPlayground />);

    await waitFor(() => expect(shaderGroup()).not.toBeNull());
  });

  it("offers a visitor no way to publish", async () => {
    render(<CoverPlayground cover={savedCover} />);

    await waitFor(() => expect(getCovers).toHaveBeenCalled());
    expect(publishButton()).toBeNull();
    expect(unpublishButton()).toBeNull();
  });

  // In the panel's own header, beside the Reset/Delete slot: all of them act on
  // the saved row behind the panel rather than on the page you are looking at.
  // The slot reads Delete here rather than Reset, because a freshly opened
  // cover has nothing left to reset — see the delete suite below.
  it("stands beside the header's other control", async () => {
    signedIn();
    render(<CoverPlayground cover={savedCover} />);

    await waitFor(() => expect(publishButton()).not.toBeNull());
    const header = screen.getByText("Properties").parentElement;
    expect(header?.contains(publishButton())).toBe(true);
    expect(
      header?.contains(screen.getByRole("button", { name: "Delete preset" })),
    ).toBe(true);
  });

  // Nothing has been written yet, so there is no row for "publish this" to
  // name. ⌘S is the one press that decides between creating a row and updating
  // one; a second control making that decision would be two doors to one room.
  it("cannot publish a cover that has never been saved", async () => {
    signedIn();
    render(<CoverPlayground />);

    await waitFor(() => expect(publishButton()).not.toBeNull());
    expect(publishButton()).toHaveProperty("disabled", true);
  });

  it("publishes the saved cover, and turns into its own undo", async () => {
    signedIn();
    const user = userEvent.setup();
    (publishCover as Mock).mockResolvedValue({ publishedAt: new Date("2026-02-01") });
    render(<CoverPlayground cover={savedCover} />);

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    expect(publishCover).toHaveBeenCalledWith("cover-1");
    // The row is the authority on its own state, so the button follows what
    // came back rather than a guess it made on the way out.
    await waitFor(() => expect(unpublishButton()).not.toBeNull());
    expect(useCoverDraftStore.getState().publishedAt).toEqual(
      new Date("2026-02-01"),
    );
  });

  it("opens a published cover offering to take it back off", async () => {
    signedIn();
    const user = userEvent.setup();
    (unpublishCover as Mock).mockResolvedValue({ publishedAt: null });
    render(
      <CoverPlayground
        cover={{ ...savedCover, publishedAt: new Date("2026-02-01") }}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Unpublish" }));

    expect(unpublishCover).toHaveBeenCalledWith("cover-1");
    await waitFor(() => expect(publishButton()).not.toBeNull());
  });

  // Publishing writes the row's own column and leaves the picture alone, so it
  // must not leave the draft claiming unsaved work — the palette would then put
  // a "discard changes?" question in front of an exit that would lose nothing.
  it("does not dirty the draft", async () => {
    signedIn();
    const user = userEvent.setup();
    (publishCover as Mock).mockResolvedValue({ publishedAt: new Date("2026-02-01") });
    render(<CoverPlayground cover={savedCover} />);

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(unpublishButton()).not.toBeNull());
    expect(useCoverDraftStore.getState().isDirty).toBe(false);
  });

  // A failed write must not look like a successful one: the strip would go on
  // showing the cover to nobody while the panel claimed it was out.
  it("leaves the button saying what is still true when the write fails", async () => {
    signedIn();
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (publishCover as Mock).mockRejectedValue(new Error("no"));
    render(<CoverPlayground cover={savedCover} />);

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(publishCover).toHaveBeenCalled());
    expect(publishButton()).not.toBeNull();
    expect(useCoverDraftStore.getState().publishedAt).toBeNull();
  });
});
