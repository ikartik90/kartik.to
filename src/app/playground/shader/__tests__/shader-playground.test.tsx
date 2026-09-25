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
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { SHADER_SPECS, defaultState } from "@/data/shader-specs";
import {
  FRAMING_DEFAULTS,
  shaderPresetContentFor,
  shaderParamsFor,
} from "@/domain/shader-preset";
import type { ThemeMode } from "@/store/theme";
import { BOTTOM_SHEET_QUERY } from "@/data/media-queries";

// Every shader ends in a `ShaderMount`, which needs the WebGL jsdom lacks.
vi.mock("@paper-design/shaders-react", () => ({
  ColorPanels: () => null,
  GodRays: () => null,
  StaticMeshGradient: () => null,
  Swirl: () => null,
  Warp: () => null,
}));

// A marker, not nothing: the colours it is handed show which ground the card is on.
vi.mock("@/components/shaders/cosmic-track", () => ({
  CosmicTrack: ({ colors }: { colors: string[] }) => (
    <div data-testid="stage" data-colors={colors.join(",")} />
  ),
}));

// Mocked separately: a Pixel Comets preset mounts this, which would otherwise reach `ShaderMount`.
vi.mock("@/components/shaders/pixel-comets", () => ({
  PixelComets: ({ colors }: { colors: string[] }) => (
    <div data-testid="stage" data-colors={colors.join(",")} />
  ),
}));

// The actions import `@/lib/env`, which throws without DATABASE_URL. Signed out by default.
vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: vi.fn().mockResolvedValue([]),
  getShaderPreset: vi.fn(),
  createShaderPreset: vi.fn(),
  saveShaderPreset: vi.fn(),
  deleteShaderPreset: vi.fn(),
  publishShaderPreset: vi.fn(),
  unpublishShaderPreset: vi.fn(),
}));

const mockUseSession = vi.fn().mockReturnValue({ data: null });
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockSetMode = vi.fn();
const mockMode = vi.fn<() => ThemeMode>(() => "dark");

vi.mock("@/store/theme", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/store/theme")>()),
  useThemeStore: () => ({ mode: mockMode(), setMode: mockSetMode }),
}));

// jsdom lacks matchMedia; `useThemeToggle` resolves `system` through it.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({ matches: false })),
});

/** Answers the bottom-sheet query only; every other query stays false. */
const onBottomSheetLayout = () => {
  (window.matchMedia as unknown as Mock).mockImplementation((query: string) => ({
    matches: query === BOTTOM_SHEET_QUERY,
  }));
};

afterEach(() => {
  (window.matchMedia as unknown as Mock).mockImplementation(() => ({
    matches: false,
  }));
});

const { ShaderPlayground } = await import("../shader-playground");
const { useShaderPresetDraftStore } = await import("@/store/shader-preset-draft");
const { getShaderPresets, publishShaderPreset, unpublishShaderPreset, deleteShaderPreset } = await import(
  "@/app/actions/shader-preset"
);

const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
const signedOut = () => mockUseSession.mockReturnValue({ data: null });

/** Renders the bare route and waits for the library read, before which nothing is drawn. */
async function renderReady() {
  const result = render(<ShaderPlayground />);
  await screen.findByRole("complementary", { name: "Preset properties" });
  return result;
}

/** The row holding the "Preset actions" title, found as the title's parent. */
const presetActionsRow = () =>
  screen.getByText("Preset actions").closest("div")!.parentElement!;

// Parsed: a preset holds a light/dark pair per stop, unlike the spec's defaults.
const SETTINGS = {
  ...shaderPresetContentFor("cosmicTrack").settings,
  framing: {},
};

/** A saved preset this route was opened on, still the author's alone. */
const savedShaderPreset = {
  id: "preset-1",
  title: "Dusk",
  shaderId: "cosmicTrack" as const,
  settings: SETTINGS,
  publishedAt: null,
};

/** One row as `getShaderPresets` hands it over; published, as a visitor's always are. */
const publishedShaderPreset = {
  ...savedShaderPreset,
  untitledIndex: null,
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("ShaderPlayground theme toggle", () => {
  beforeEach(() => {
    mockMode.mockReturnValue("dark");
    mockSetMode.mockClear();
  });
  afterEach(cleanup);

  it("carries the site's two gutter controls, in the canvas", async () => {
    const { container } = await renderReady();
    const canvas = container.querySelector("main > div");
    const control = screen.getByRole("button", { name: "Light theme" });
    const menu = screen.getByRole("button", { name: "Menu" });

    expect(canvas?.contains(control)).toBe(true);
    expect(canvas?.contains(menu)).toBe(true);
    expect(screen.queryByRole("link", { name: "Index" })).toBeNull();
    expect(container.querySelectorAll("[data-theme-glyph]").length).toBe(2);
  });

  it("makes the page give up the width its rail occupies", async () => {
    await renderReady();
    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);
  });

  it("switches the whole site's theme, not a local one", async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();

    await user.click(screen.getByRole("button", { name: "Light theme" }));

    expect(mockSetMode).toHaveBeenCalledWith("light");
    expect(container.querySelector("[data-theme]")).toBeNull();
  });
});

describe("ShaderPlayground preset actions", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  it("stands at the top of the panel", async () => {
    await renderReady();
    const panel = screen.getByRole("complementary", { name: "Preset properties" });

    expect(panel.querySelector("section")).toBe(
      presetActionsRow().parentElement,
    );
  });

  it("holds its controls against the heading, with no row beneath", async () => {
    await renderReady();
    const section = presetActionsRow().parentElement!;

    expect(section.contains(screen.getByRole("button", { name: "Reset" }))).toBe(
      true,
    );
    expect(
      within(section).queryByRole("group", { name: "Preset actions" }),
    ).toBeNull();
  });

  it("leaves the panel's header to the panel's own control", async () => {
    await renderReady();
    const header = screen.getByText("Preset properties").parentElement!;

    expect(
      header.contains(screen.getByRole("button", { name: "Close properties" })),
    ).toBe(true);
    expect(header.contains(screen.getByRole("button", { name: "Reset" }))).toBe(
      false,
    );
  });
});

describe("ShaderPlayground panel dismissal", () => {
  afterEach(cleanup);

  const panel = () => screen.getByRole("complementary", { name: "Preset properties" });
  const reopen = () => screen.queryByRole("button", { name: "Preset properties" });
  const railToolbar = () =>
    screen.getByRole("toolbar", { name: "Preview aspect ratio" });

  it("opens with the panel up, and nothing offering to open it", async () => {
    await renderReady();

    expect(panel().hasAttribute("data-dismissed")).toBe(false);
    expect(reopen()).toBeNull();
  });

  it("opens with the sheet collapsed on a phone held upright", async () => {
    onBottomSheetLayout();
    await renderReady();

    expect(panel().hasAttribute("data-dismissed")).toBe(true);
    expect(reopen()).not.toBeNull();
  });

  it("sends the panel away from the close button in its header", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Close properties" }));

    expect(panel().hasAttribute("data-dismissed")).toBe(true);
  });

  it("offers the way back in the aspect rail's toolbar, behind a separator", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Close properties" }));

    const button = reopen();
    expect(button).not.toBeNull();
    expect(button?.parentElement?.contains(railToolbar())).toBe(true);
    expect(button?.previousElementSibling?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("brings the panel back, and stops offering to", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Close properties" }));
    await user.click(reopen()!);

    expect(panel().hasAttribute("data-dismissed")).toBe(false);
    expect(reopen()).toBeNull();
  });

  it("hands the page its width back while the panel is away", async () => {
    const user = userEvent.setup();
    await renderReady();

    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Close properties" }));
    expect(document.body.hasAttribute("data-properties-panel")).toBe(false);

    await user.click(reopen()!);
    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);
  });
});

describe("ShaderPlayground reset control", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  // Through the route's prop: the page resets a draft seeded any other way.
  const saved = {
    id: "preset-1",
    title: "Dusk",
    shaderId: "cosmicTrack" as const,
    settings: {
      ...shaderPresetContentFor("cosmicTrack").settings,
      params: {
        ...defaultState(SHADER_SPECS.cosmicTrack).params,
        rampLength: 4,
      },
      framing: {},
    },
    publishedAt: null,
  };

  const resetButton = () => screen.getByRole("button", { name: "Reset" });

  it("stands against the Preset actions heading", async () => {
    await renderReady();

    expect(presetActionsRow().contains(resetButton())).toBe(true);
  });

  it("puts the params back to the preset's, not the table's", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={saved} />);

    act(() => useShaderPresetDraftStore.getState().setParam("rampLength", 9));
    await user.click(resetButton());

    expect(useShaderPresetDraftStore.getState().settings.params.rampLength).toBe(4);
  });

  // Unreachable while `SHADER_SPECS` holds one shader.
  it.todo("falls back to the new shader's defaults after a switch");
});

describe("ShaderPlayground motion group", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const motionGroup = () => screen.getByRole("group", { name: "Motion" });

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers a shader's own timing controls in with the shared Speed", async () => {
    await renderReady();

    expect(labelsIn(motionGroup())).toEqual(
      expect.arrayContaining(["Speed", "Interval", "Easing", "Easing Bias"]),
    );
  });

  it("keeps them out of the shader's own parameters", async () => {
    await renderReady();
    const params = screen.getByRole("group", { name: "Track" });

    expect(labelsIn(params)).not.toContain("Easing");
  });
});

describe("ShaderPlayground ramp group", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the ramp controls into one section", async () => {
    await renderReady();

    expect(labelsIn(screen.getByRole("group", { name: "Ramp" }))).toEqual([
      "Phase",
      "Travel",
      "Stagger",
      "Symmetry",
      "Length",
      "Tail",
    ]);
  });

  it("takes them out of the shader's own parameters", async () => {
    await renderReady();
    const params = labelsIn(screen.getByRole("group", { name: "Track" }));

    for (const label of [
      "Phase",
      "Travel",
      "Stagger",
      "Symmetry",
      "Length",
      "Tail",
    ]) {
      expect(params).not.toContain(label);
    }
  });

  it("leaves the fan's own geometry in Track", async () => {
    await renderReady();

    expect(labelsIn(screen.getByRole("group", { name: "Track" }))).toEqual(
      expect.arrayContaining(["Spread", "Bandwidth", "Roundness", "Apex"]),
    );
  });

  // Unreachable while every shader carries these controls.
  it.todo("is absent for a shader that has none");
});

describe("ShaderPlayground edge group", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the edge controls into one section", async () => {
    await renderReady();

    expect(labelsIn(screen.getByRole("group", { name: "Edge" }))).toEqual([
      "Edge Width",
      "Softness",
      "Edge Tail",
    ]);
  });

  it("takes them out of the shader's own parameters", async () => {
    await renderReady();
    const params = labelsIn(screen.getByRole("group", { name: "Track" }));

    for (const label of ["Edge Width", "Softness", "Edge Tail"]) {
      expect(params).not.toContain(label);
    }
  });

  it("leaves the rails' colour with the other swatches", async () => {
    await renderReady();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Edge");
    expect(colours).not.toContain("Edge Width");
  });

  it("names the stops' row for what this shader lays them along", async () => {
    await renderReady();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Ramp");
  });

  // Unreachable while every shader carries these controls.
  it.todo("is absent for a shader that has none");
});

describe("ShaderPlayground grid group", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const pixelCometsPreset = {
    id: "preset-2",
    title: "Pixel Comets",
    shaderId: "pixelComets" as const,
    settings: { ...shaderPresetContentFor("pixelComets").settings, framing: {} },
    publishedAt: null,
  };

  async function renderPixelComets() {
    const result = render(<ShaderPlayground preset={pixelCometsPreset} />);
    await screen.findByRole("complementary", { name: "Preset properties" });
    return result;
  }

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the lattice controls into one section", async () => {
    await renderPixelComets();

    expect(labelsIn(screen.getByRole("group", { name: "Grid" }))).toEqual([
      "Pixel Size",
      "Grid Width",
      "Major Grid",
    ]);
  });

  it("draws the shader's own parameters under its own heading", async () => {
    await renderPixelComets();

    expect(screen.getByRole("group", { name: "Comet Field" })).toBeTruthy();
  });

  it("gathers the comets' own controls under the field's heading", async () => {
    await renderPixelComets();

    expect(labelsIn(screen.getByRole("group", { name: "Comet Field" }))).toEqual([
      "Count",
      "Direction",
      "Origin Min",
      "Origin Max",
      "Travel",
      "Tail",
      "Tail Blend",
      "Falloff",
    ]);
  });

  it("draws Direction as a bar of independent toggles", async () => {
    await renderPixelComets();

    const bar = screen.getByRole("toolbar", { name: "Direction" });
    expect(
      Array.from(bar.querySelectorAll("button")).map((button) => button.textContent),
    ).toEqual(["Up", "Down", "Left", "Right"]);
  });

  it("opens with every direction pressed, and releases one without releasing the rest", async () => {
    await renderPixelComets();

    const bar = screen.getByRole("toolbar", { name: "Direction" });
    const pressed = () =>
      Array.from(bar.querySelectorAll("button"))
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => button.textContent);

    expect(pressed()).toEqual(["Up", "Down", "Left", "Right"]);

    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    expect(pressed()).toEqual(["Down", "Left", "Right"]);
  });

  it("gathers the bloom controls, with the head's stretch beside its radius", async () => {
    await renderPixelComets();

    expect(labelsIn(screen.getByRole("group", { name: "Glow" }))).toEqual([
      "Head Glow",
      "Head Radius",
      "Head Stretch",
      "Tail Glow",
      "Tail Radius",
    ]);
  });

  it("puts Parallax with the other timing controls", async () => {
    await renderPixelComets();

    expect(labelsIn(screen.getByRole("group", { name: "Motion" }))).toEqual([
      "Speed",
      "Parallax",
      "Swerve",
      "Easing",
      "Easing Bias",
    ]);
  });

  it("puts both lattice inks on one row", async () => {
    await renderPixelComets();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Grid");
    expect(colours).not.toContain("Major");
  });

  it("names the stops' row for the comets they colour", async () => {
    await renderPixelComets();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Comets");
    expect(colours).not.toContain("Ramp");
  });

  it("names that row for a reader who cannot see it", async () => {
    await renderPixelComets();

    expect(screen.getByRole("group", { name: "Comets colours" })).toBeTruthy();
  });

  it("still names each ink for a reader who cannot see which is which", async () => {
    await renderPixelComets();
    const row = screen.getByRole("group", { name: "Grid colours" });

    expect(within(row).getByRole("button", { name: "Grid colour" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Major colour" })).toBeTruthy();
  });
});

describe("ShaderPlayground dither group", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const labelsIn = (group: HTMLElement) =>
    Array.from(group.querySelectorAll("label")).map((el) => el.textContent);

  it("gathers the dither controls into one section", async () => {
    await renderReady();

    expect(labelsIn(screen.getByRole("group", { name: "Dither" }))).toEqual([
      "Ramp Dither",
      "Edge Dither",
      "Dither Size",
    ]);
  });

  it("takes them out of the shader's own parameters", async () => {
    await renderReady();
    const params = labelsIn(screen.getByRole("group", { name: "Track" }));

    expect(params).not.toContain("Ramp Dither");
    expect(params).not.toContain("Edge Dither");
    expect(params).not.toContain("Dither Size");
  });

  // Unreachable while every shader carries these controls.
  it.todo("is absent for a shader that has none");
});

describe("ShaderPlayground aspect toolbar", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const aspectRail = () =>
    screen.getByRole("toolbar", { name: "Preview aspect ratio" });

  const gutterRow = () => {
    const menu = screen.getByRole("button", { name: "Menu" });
    const toggle = screen.getByRole("button", { name: "Light theme" });
    return Array.from(document.querySelectorAll("div"))
      .filter((el) => el.contains(menu) && el.contains(toggle))
      .pop();
  };

  it("keeps the gutter row to the page's own two controls", async () => {
    await renderReady();
    const menu = screen.getByRole("button", { name: "Menu" });
    const toggle = screen.getByRole("button", { name: "Light theme" });
    const order = Array.from(gutterRow()?.children ?? []);

    expect(order.length).toBe(2);
    expect(order[0].contains(menu)).toBe(true);
    expect(order[1].contains(toggle)).toBe(true);
    expect(gutterRow()?.contains(aspectRail())).toBe(false);
  });

  it("stands with the card, after the gutter row", async () => {
    await renderReady();
    const rail = aspectRail();
    const card = document.querySelector("[data-preset-stage]");
    const canvas = card?.parentElement;
    const kids = Array.from(canvas?.children ?? []);

    expect(canvas?.contains(rail)).toBe(true);
    expect(kids.findIndex((el) => el.contains(rail))).toBeGreaterThan(
      kids.findIndex((el) => el === gutterRow()),
    );
  });

  it("opens square", async () => {
    await renderReady();
    expect(
      aspectRail()
        .querySelector('button[aria-pressed="true"]')
        ?.getAttribute("aria-label"),
    ).toBe("1:1");
  });

  it("records the shape on the draft without dirtying it", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "4:3" }));

    expect(useShaderPresetDraftStore.getState().aspect).toBe("4/3");
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  it("reshapes the preview to the chosen frame", async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    const preset = () =>
      container.querySelector<HTMLElement>("[data-preset-stage]");

    await waitFor(() => expect(preset()).not.toBeNull());
    expect(preset()?.style.getPropertyValue("--preset-w")).toBe("1");
    expect(preset()?.style.getPropertyValue("--preset-h")).toBe("1");

    await user.click(screen.getByRole("button", { name: "16:9" }));

    expect(preset()?.style.getPropertyValue("--preset-w")).toBe("16");
    expect(preset()?.style.getPropertyValue("--preset-h")).toBe("9");
  });

  it("opens a saved preset square as well", () => {
    render(
      <ShaderPlayground
        preset={{
          id: "preset-1",
          title: "Dusk",
          shaderId: "cosmicTrack",
          settings: {
            ...shaderPresetContentFor("cosmicTrack").settings,
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

describe("ShaderPlayground unsaved marks", () => {
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    (getShaderPresets as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const railMarked = () =>
    !!screen
      .getByRole("toolbar", { name: "Preview aspect ratio" })
      .querySelector("[data-unsaved]");

  it("marks the reframed shape for the author", async () => {
    signedIn();
    await renderReady();

    expect(railMarked()).toBe(false);
    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    expect(railMarked()).toBe(true);
  });

  it("marks nothing for a visitor, who has no save to be behind on", async () => {
    signedOut();
    await renderReady();

    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    expect(useShaderPresetDraftStore.getState().editedAspects).toContain("1/1");
    expect(railMarked()).toBe(false);
  });
});

describe("ShaderPlayground delete", () => {
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    signedIn();
    (getShaderPresets as Mock).mockResolvedValue([]);
    (deleteShaderPreset as Mock).mockReset();
    (deleteShaderPreset as Mock).mockResolvedValue(undefined);
    window.history.replaceState(null, "", "/playground/shader/preset-1");

    // jsdom has no `<dialog>` behaviour; `open` is what the confirm keys off.
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
  /** By its own title: the presets strip mounts a confirm of its own. Read off `open`. */
  const asking = () =>
    !!document
      .querySelector('dialog[aria-label="Delete Preset"]')
      ?.hasAttribute("open");

  it("offers Delete on a saved preset with nothing left to reset", async () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await waitFor(() => expect(deleteButton()).not.toBeNull());
    expect(reset()).toBeNull();
  });

  it("goes back to Reset the moment the draft is edited", async () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);
    await waitFor(() => expect(deleteButton()).not.toBeNull());

    act(() => useShaderPresetDraftStore.getState().setParam("rampLength", 4));

    expect(reset()).not.toBeNull();
    expect(deleteButton()).toBeNull();
  });

  it("keeps Reset on a draft that has never been saved", async () => {
    await renderReady();

    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
    expect(reset()).not.toBeNull();
    expect(deleteButton()).toBeNull();
  });

  it("withholds Delete from a visitor", async () => {
    signedOut();
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
    expect(deleteButton()).toBeNull();
    expect(reset()).not.toBeNull();
  });

  it("asks before deleting, and deletes nothing until it is answered", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(
      await screen.findByRole("button", { name: "Delete preset" }),
    );

    expect(asking()).toBe(true);
    expect(deleteShaderPreset).not.toHaveBeenCalled();
  });

  it("removes the preset and returns to a blank draft", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(
      await screen.findByRole("button", { name: "Delete preset" }),
    );
    await user.click(screen.getByRole("option", { name: "Delete" }));

    await waitFor(() => expect(deleteShaderPreset).toHaveBeenCalledWith("preset-1"));
    await waitFor(() =>
      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull(),
    );
    expect(window.location.pathname).toBe("/playground/shader");
  });

  it("stays put when the question is declined", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(
      await screen.findByRole("button", { name: "Delete preset" }),
    );
    await user.click(screen.getByRole("option", { name: "Cancel" }));

    expect(deleteShaderPreset).not.toHaveBeenCalled();
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("preset-1");
  });

  it("leaves the draft alone when the delete fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (deleteShaderPreset as Mock).mockRejectedValue(new Error("no"));
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(
      await screen.findByRole("button", { name: "Delete preset" }),
    );
    await user.click(screen.getByRole("option", { name: "Delete" }));

    await waitFor(() => expect(deleteShaderPreset).toHaveBeenCalled());
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("preset-1");
    expect(window.location.pathname).toBe("/playground/shader/preset-1");
  });
});

describe("ShaderPlayground preloader", () => {
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const stage = () => document.querySelector("[data-preset-stage]");
  const panel = () =>
    screen.queryByRole("complementary", { name: "Preset properties" });

  it("draws no preset until the library has been read", async () => {
    let settle: (rows: unknown[]) => void = () => {};
    (getShaderPresets as Mock).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve as (rows: unknown[]) => void;
      }),
    );
    render(<ShaderPlayground />);

    expect(stage()).toBeNull();

    await act(async () => {
      settle([]);
    });
    await waitFor(() => expect(stage()).not.toBeNull());
  });

  it("gives up waiting when the library cannot be read", async () => {
    (getShaderPresets as Mock).mockRejectedValue(new Error("no"));
    render(<ShaderPlayground />);

    await waitFor(() => expect(stage()).not.toBeNull());
  });

  it("draws a routed preset straight away", () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);

    expect(stage()).not.toBeNull();
  });

  it("holds the properties rail back until the library has been read", async () => {
    let settle: (rows: unknown[]) => void = () => {};
    (getShaderPresets as Mock).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve as (rows: unknown[]) => void;
      }),
    );
    render(<ShaderPlayground />);

    expect(panel()).toBeNull();

    await act(async () => {
      settle([]);
    });
    await waitFor(() => expect(panel()).not.toBeNull());
  });

  it("gives up waiting on the rail too when the library cannot be read", async () => {
    (getShaderPresets as Mock).mockRejectedValue(new Error("no"));
    render(<ShaderPlayground />);

    await waitFor(() => expect(panel()).not.toBeNull());
  });

  it("draws a routed preset's rail straight away", () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);

    expect(panel()).not.toBeNull();
  });

  it("withholds the chrome's entrance mark until the library has been read", async () => {
    let settle: (rows: unknown[]) => void = () => {};
    (getShaderPresets as Mock).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve as (rows: unknown[]) => void;
      }),
    );
    render(<ShaderPlayground />);

    const page = screen.getByRole("main");
    expect(page.hasAttribute("data-entered")).toBe(false);
    screen.getByRole("toolbar", { name: "Preview aspect ratio" });

    await act(async () => {
      settle([]);
    });
    await waitFor(() => expect(page.hasAttribute("data-entered")).toBe(true));
  });

  it("ships no rail in the server's markup, whose draft has been seeded by nothing", () => {
    const routed = {
      ...savedShaderPreset,
      settings: {
        ...SETTINGS,
        colors: [
          { light: "#112233FF", dark: "#112233FF" },
          { light: "#445566FF", dark: "#445566FF" },
        ],
      },
    };
    const html = renderToStaticMarkup(<ShaderPlayground preset={routed} />);

    expect(html).not.toContain('aria-label="Preset properties"');
    for (const colour of SETTINGS.colors) {
      expect(html).not.toContain(colour.light.replace("#", "").slice(0, 6));
    }
  });
});

describe("ShaderPlayground framing", () => {
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const rail = () =>
    screen.getByRole("toolbar", { name: "Preview aspect ratio" });
  const pick = (ratio: string) =>
    fireEvent.click(within(rail()).getByRole("button", { name: ratio }));
  const flip = (to: "portrait" | "landscape") =>
    fireEvent.click(
      within(rail()).getByRole("button", { name: `Switch to ${to}` }),
    );

  const framingSlider = (label: string) => {
    const group = screen.getByRole("group", { name: /^Framing/ });
    return within(group)
      .getAllByRole("slider")
      .find((node) =>
        node.closest("[data-field]")?.textContent?.startsWith(label),
      );
  };

  it("names the shape its placement controls apply to", async () => {
    await renderReady();

    expect(screen.getByRole("group", { name: "Framing 1:1" })).toBeTruthy();
    pick("4:3");
    expect(screen.getByRole("group", { name: "Framing 4:3" })).toBeTruthy();
  });

  // Rotation, not scale: its step lands on whole numbers.
  it("keeps a placement per shape, and gives each one back", async () => {
    await renderReady();
    pick("16:9");

    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    pick("4:3");
    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", -90));

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe(
      "-90",
    );
    pick("16:9");
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  it("carries the placement across an orientation change, unchanged", async () => {
    await renderReady();
    // Square has no other side, so start from 4:3.
    pick("4:3");

    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    flip("portrait");

    expect(screen.getByRole("group", { name: "Framing 3:4" })).toBeTruthy();
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  it("lets the two sides of an orientation pair be framed apart", async () => {
    await renderReady();
    pick("4:3");

    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    flip("portrait");
    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", -90));

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe(
      "-90",
    );
    flip("landscape");
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  it("carries the placement between shapes of one orientation", async () => {
    await renderReady();

    pick("16:9");
    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    pick("4:3");

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  it("hands the shader the placement of the shape on screen", async () => {
    await renderReady();

    act(() => useShaderPresetDraftStore.getState().setFraming("scale", 2));
    const { settings, aspect } = useShaderPresetDraftStore.getState();

    expect(shaderParamsFor(settings, aspect).scale).toBe(2);
    expect("scale" in settings.params).toBe(false);
  });
});

describe("ShaderPlayground presets", () => {
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([]);
  });
  afterEach(cleanup);

  const strip = () => screen.queryByRole("group", { name: "Presets" });

  it("shows a visitor with nothing published no strip at all", async () => {
    await renderReady();

    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
    expect(strip()).toBeNull();
  });

  it("gives the author theirs, in the canvas", async () => {
    signedIn();
    const { container } = await renderReady();

    // The strip appears a commit after hydration (see `useIsAdmin`).
    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  it("gives a visitor the published library, in the same place", async () => {
    (getShaderPresets as Mock).mockResolvedValue([publishedShaderPreset]);
    const { container } = await renderReady();

    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  // jsdom applies no `:has()` styles, so this asserts the attribute the page reads.
  it("marks the strip so the page can reserve its band, and only then", async () => {
    const { container } = await renderReady();
    const main = () => container.querySelector("main");

    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
    expect(main()?.querySelector("[data-presets]")).toBeNull();

    cleanup();
    signedIn();
    const signedInRender = await renderReady();

    await waitFor(() =>
      expect(
        signedInRender.container.querySelector("main [data-presets]"),
      ).not.toBeNull(),
    );
  });
});

describe("ShaderPlayground authoring controls", () => {
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([]);
    (publishShaderPreset as Mock).mockReset();
    (unpublishShaderPreset as Mock).mockReset();
  });
  afterEach(cleanup);

  const shaderGroup = () => screen.queryByRole("group", { name: "Shader" });
  const publishButton = () => screen.queryByRole("button", { name: "Publish" });
  const unpublishButton = () =>
    screen.queryByRole("button", { name: "Unpublish" });

  it("withholds the shader picker from a visitor, and keeps its controls", async () => {
    await renderReady();

    expect(shaderGroup()).toBeNull();
    expect(screen.getByRole("group", { name: "Colours" })).toBeTruthy();
    expect(screen.getByRole("group", { name: /^Framing/ })).toBeTruthy();
  });

  it("gives the author the shader picker", async () => {
    signedIn();
    await renderReady();

    await waitFor(() => expect(shaderGroup()).not.toBeNull());
  });

  it("offers a visitor no way to publish", async () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
    expect(publishButton()).toBeNull();
    expect(unpublishButton()).toBeNull();
  });

  it("stands beside the section's other control", async () => {
    signedIn();
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await waitFor(() => expect(publishButton()).not.toBeNull());
    const row = presetActionsRow();
    expect(row.contains(publishButton()!)).toBe(true);
    expect(
      row.contains(screen.getByRole("button", { name: "Delete preset" })),
    ).toBe(true);
  });

  it("cannot publish a preset that has never been saved", async () => {
    signedIn();
    await renderReady();

    await waitFor(() => expect(publishButton()).not.toBeNull());
    expect(publishButton()).toHaveProperty("disabled", true);
  });

  it("publishes the saved preset, and turns into its own undo", async () => {
    signedIn();
    const user = userEvent.setup();
    (publishShaderPreset as Mock).mockResolvedValue({
      publishedAt: new Date("2026-02-01"),
    });
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    expect(publishShaderPreset).toHaveBeenCalledWith("preset-1");
    await waitFor(() => expect(unpublishButton()).not.toBeNull());
    expect(useShaderPresetDraftStore.getState().publishedAt).toEqual(
      new Date("2026-02-01"),
    );
  });

  it("opens a published preset offering to take it back off", async () => {
    signedIn();
    const user = userEvent.setup();
    (unpublishShaderPreset as Mock).mockResolvedValue({ publishedAt: null });
    render(
      <ShaderPlayground
        preset={{ ...savedShaderPreset, publishedAt: new Date("2026-02-01") }}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Unpublish" }));

    expect(unpublishShaderPreset).toHaveBeenCalledWith("preset-1");
    await waitFor(() => expect(publishButton()).not.toBeNull());
  });

  it("does not dirty the draft", async () => {
    signedIn();
    const user = userEvent.setup();
    (publishShaderPreset as Mock).mockResolvedValue({
      publishedAt: new Date("2026-02-01"),
    });
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(unpublishButton()).not.toBeNull());
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  it("leaves the button saying what is still true when the write fails", async () => {
    signedIn();
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (publishShaderPreset as Mock).mockRejectedValue(new Error("no"));
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(publishShaderPreset).toHaveBeenCalled());
    expect(publishButton()).not.toBeNull();
    expect(useShaderPresetDraftStore.getState().publishedAt).toBeNull();
  });
});

describe("ShaderPlayground ground", () => {
  /** A preset whose two grounds are unmistakably different. */
  const twoToned = {
    ...savedShaderPreset,
    settings: {
      ...SETTINGS,
      colors: [
        { light: "#AAAAAAFF", dark: "#111111FF" },
        { light: "#BBBBBBFF", dark: "#222222FF" },
      ],
    },
  };

  const stageColors = () =>
    screen.getByTestId("stage").getAttribute("data-colors");

  const groundToggle = () =>
    screen.getByRole("button", {
      name: /Show the (light|dark) colours/,
    });

  // The draft store outlives a test; reset it so the route's preset is adopted.
  beforeEach(() => {
    useShaderPresetDraftStore.getState().reset();
    mockMode.mockReturnValue("dark");
    mockSetMode.mockClear();
  });
  afterEach(cleanup);

  it("opens on the site's own theme, not on a fixed one", async () => {
    render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    expect(stageColors()).toBe("#111111FF,#222222FF");
  });

  it("follows the site when the site is light instead", async () => {
    mockMode.mockReturnValue("light");
    render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");
  });

  it("sends the card to the other ground and the site nowhere", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    await user.click(groundToggle());

    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  // Two moves: the first agrees with the peek by luck.
  it("re-aims at the site's theme every time it changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    await user.click(groundToggle());
    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");

    mockMode.mockReturnValue("light");
    rerender(<ShaderPlayground preset={twoToned} />);
    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");

    mockMode.mockReturnValue("dark");
    rerender(<ShaderPlayground preset={twoToned} />);
    expect(stageColors()).toBe("#111111FF,#222222FF");
    expect(
      screen.getByRole("button", { name: "Show the light colours" }),
    ).toBeTruthy();
  });

  it("shows the glyph of the ground it would take you to", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    expect(
      screen.getByRole("button", { name: "Show the light colours" }),
    ).toBeTruthy();
    await user.click(groundToggle());
    expect(
      screen.getByRole("button", { name: "Show the dark colours" }),
    ).toBeTruthy();
  });

  it("writes an edit to the ground on screen and no other", async () => {
    render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    act(() =>
      useShaderPresetDraftStore.getState().setColors([
        { light: "#AAAAAAFF", dark: "#999999FF" },
        { light: "#BBBBBBFF", dark: "#222222FF" },
      ]),
    );

    const colors = useShaderPresetDraftStore.getState().settings.colors;
    expect(colors[0]).toEqual({ light: "#AAAAAAFF", dark: "#999999FF" });
  });
});
