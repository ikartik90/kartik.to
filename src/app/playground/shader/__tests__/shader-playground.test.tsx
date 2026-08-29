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

// Renders a MARKER rather than nothing, because what the mounted shader is
// handed is now a question worth asking: a preset holds a colour per ground and
// the card resolves the pair, so "which colours reached the canvas" is the only
// honest way to test which ground the card is standing on. It stays out of the
// server's markup either way — the stage is behind the page's `ready` gate.
vi.mock("@/components/shaders/cosmic-track", () => ({
  CosmicTrack: ({ colors }: { colors: string[] }) => (
    <div data-testid="stage" data-colors={colors.join(",")} />
  ),
}));

// The same marker for the second shader, and it has to be its own mock: the
// stage switches on the preset's `shaderId`, so a preset saved on Pixel Comets mounts
// THIS one — and unmocked it reaches `ShaderMount`, which the library mock
// above does not carry.
vi.mock("@/components/shaders/pixel-comets", () => ({
  PixelComets: ({ colors }: { colors: string[] }) => (
    <div data-testid="stage" data-colors={colors.join(",")} />
  ),
}));

// The presets strip reaches the database, through a `"use server"` module that
// validates DATABASE_URL at import time and throws in a run with no `.env`. The
// session is stubbed alongside it: signed OUT by default, which is what a
// visitor to this public playground is.
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

/**
 * Answer the bottom-sheet query for the rest of this test — a phone held
 * upright. Every OTHER query keeps answering false, which is what keeps the
 * theme resolution above untouched: `useThemeToggle` asks the same mock.
 */
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

/** Signed in as the author, and signed out as anybody else. */
const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
const signedOut = () => mockUseSession.mockReturnValue({ data: null });

/**
 * Render the bare route and wait for it to settle.
 *
 * The page draws neither the preset nor the properties rail until the library
 * read lands — until then the draft is holding the control table's first
 * shader, and a rail of those numbers describes a preset nobody published (see
 * the preloader block). So a test that reaches for a control has to let that
 * answer arrive first, exactly as a reader does.
 */
async function renderReady() {
  const result = render(<ShaderPlayground />);
  await screen.findByRole("complementary", { name: "Preset properties" });
  return result;
}

/**
 * The "Preset actions" heading's own row — the strip the two controls that act
 * on the preset sit against, rather than a line of their own beneath it.
 *
 * Walked from the title's text: the heading is a `Typography` inside the
 * recipe's `sectionTitle`, and the row is that title's parent. Named here
 * because three suites ask the same question of it.
 */
const presetActionsRow = () =>
  screen.getByText("Preset actions").closest("div")!.parentElement!;

// Parsed, not authored: `defaultState` is the spec table's shape (one colour
// per stop) and a preset's is the schema's (a light/dark pair each). Going
// through `shaderPresetContentFor` is what makes the fixture the thing the panel
// actually receives.
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

/** One row as `getShaderPresets` hands it over — published, which is the only kind a visitor is given. */
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
    // The menu sits with it, as it does on an article — and the way back is
    // inside it now, as "Back to index", rather than being a control of its own.
    expect(canvas?.contains(menu)).toBe(true);
    expect(screen.queryByRole("link", { name: "Index" })).toBeNull();
    // Both glyphs ship and the cascade picks — the site's own mechanism, which
    // works here because the theme is the document's.
    expect(container.querySelectorAll("[data-theme-glyph]").length).toBe(2);
  });

  it("makes the page give up the width its rail occupies", async () => {
    await renderReady();
    // The rail here is the recipe, not the dismissible component, so the page
    // asks for the inset itself — the same one every other panel in the app
    // gets, rather than a width reserved a second way on this page.
    expect(document.body.hasAttribute("data-properties-panel")).toBe(true);
  });

  it("switches the whole site's theme, not a local one", async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();

    await user.click(screen.getByRole("button", { name: "Light theme" }));

    expect(mockSetMode).toHaveBeenCalledWith("light");
    // Nothing in the playground holds a theme of its own — no scoped override to
    // leave the page and the canvas disagreeing.
    expect(container.querySelector("[data-theme]")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// "Preset actions" — the strip at the top of the panel.
//
// A section whose whole content is its heading: the two controls that act on
// the PRESET (Reset or Delete, and Publish) sit against the title rather than
// on a row of their own underneath it. They were in the panel's own header,
// which is the wrong strip for them — that one names the panel and carries the
// control that closes it, where these act on the thing the panel is editing.
// ---------------------------------------------------------------------------
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

  // The heading's row IS the section. A control panel under it would put the
  // buttons on a line of their own and leave the strip above them empty.
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

  // The panel's own header keeps what belongs to the panel: its name, and the
  // control that sends it away.
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

// ---------------------------------------------------------------------------
// Dismissing the panel — the sheet on a phone, the docked rail on a desktop.
//
// ONE state for both, and the way back is one control in one place: the aspect
// rail's own toolbar, behind a separator. It used to be a sheet-only affair,
// on the grounds that a phone turned on its side had to find its rail again —
// which was the repair for a panel you could send away with nothing offering
// to bring it back. There is a button now, in both layouts, so the state can
// mean what it says.
//
// WHICH SHAPE the panel takes is CSS (one media query, stated once in
// `panda.config.ts`), so what is testable here is the state that CSS keys off,
// plus the page inset — the rail is `position: fixed`, so the width it stands
// in is the page's to give back (see `usePropertiesPanelInset`).
// ---------------------------------------------------------------------------
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

  // A phone held upright opens with the sheet DOWN, which the docked rail does
  // not: the sheet takes half the viewport, and half a phone is not enough to
  // judge a picture in. So the panel is something you reach for there rather
  // than something you dismiss, and the way back is on the band from the first
  // paint. Seeded after mount rather than at first render — the answer needs
  // `matchMedia`, which the server cannot ask, and an initial state that
  // disagreed with the server's would be a hydration mismatch on `main`.
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

  // In the RAIL's chrome, not beside the theme toggle where it used to stand.
  // It is the one control on the band that acts on the panel, and the toggle is
  // the page's — a third thing wedged in beside it read as part of that pair.
  it("offers the way back in the aspect rail's toolbar, behind a separator", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "Close properties" }));

    const button = reopen();
    expect(button).not.toBeNull();
    // The box the button stands in also holds the shapes — which is the rail's
    // own chrome, not a second rail of its own somewhere on the band.
    expect(button?.parentElement?.contains(railToolbar())).toBe(true);
    // And behind a hairline: decorative, exactly as the rail's own dividers are.
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

  // The rail is `position: fixed`, so the column it stands in is reserved by the
  // page rather than taken by the panel. A collapsed rail that kept the inset
  // would leave 360px of nothing beside a picture that could have used it.
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

// ---------------------------------------------------------------------------
// "Reset params" — the button that undoes an experiment.
//
// WHERE it undoes to depends on what is behind the draft — the preset you
// opened, or the shader's defaults where no preset has been saved — and that is
// the store's to decide, not the label's. So what is worth asserting here is
// which of the two the button actually lands on.
// ---------------------------------------------------------------------------
describe("ShaderPlayground reset control", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  // Opened THROUGH THE ROUTE'S PROP, which is how a preset actually arrives:
  // the page seeds the draft from it on mount, and would reset a draft seeded
  // any other way straight back to blank.
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

  // Against the "Preset actions" heading, which is the section it belongs to:
  // what it acts on is the PRESET — the saved row behind the panel and the
  // draft in front of it — rather than the panel's own chrome, which is what
  // the strip at the very top is for.
  it("stands against the Preset actions heading", async () => {
    await renderReady();

    expect(presetActionsRow().contains(resetButton())).toBe(true);
  });

  // Driven through the control itself rather than the store action, so the
  // header button and the rule behind it are tested as one thing.
  it("puts the params back to the preset's, not the table's", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={saved} />);

    act(() => useShaderPresetDraftStore.getState().setParam("rampLength", 9));
    await user.click(resetButton());

    expect(useShaderPresetDraftStore.getState().settings.params.rampLength).toBe(4);
  });

  // A preset's params belong to the shader it was authored on, so switching
  // away has to leave the baseline behind with it.
  //
  // UNREACHABLE while `SHADER_SPECS` holds one shader — switching lands back on
  // the shader the preset was saved on, so the baseline still fits and Reset
  // rightly goes to the save rather than to the table. See the same todo in the
  // store's own tests, where the guard lives.
  it.todo("falls back to the new shader's defaults after a switch");
});

// ---------------------------------------------------------------------------
// The Motion group — what MOVES, kept together.
//
// Speed is shared by every shader that samples time. A shader can also put its
// own timing controls here, which is not the same as them being shared: they
// are that shader's uniforms, and only it has them.
// ---------------------------------------------------------------------------
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

  // They are the shader's uniforms, not the shared block's, so they must not
  // also appear among the geometry sliders the panel groups by default.
  it("keeps them out of the shader's own parameters", async () => {
    await renderReady();
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
      // Not "Ramp Length" — the section already says ramp.
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

  // The fan's geometry stays where it was — the split is between where the
  // colours sit and what they are drawn on, not a wholesale emptying.
  it("leaves the fan's own geometry in Track", async () => {
    await renderReady();

    expect(labelsIn(screen.getByRole("group", { name: "Track" }))).toEqual(
      expect.arrayContaining(["Spread", "Bandwidth", "Roundness", "Apex"]),
    );
  });

  // UNREACHABLE while every shader in the table carries these controls: the
  // absence was driven by switching to one that does not, and the built-ins
  // that did have gone. The guard is still on the group (`length > 0`).
  it.todo("is absent for a shader that has none");
});

// ---------------------------------------------------------------------------
// The Edge group — the rails, and how hard a band meets what is beside it.
//
// The rails' COLOUR stays with the other swatches; what gathers here is the
// three numbers that decide how the edge reads: how wide the line is, how
// sharply the fill ends, and how far the line outlives the fill.
// ---------------------------------------------------------------------------
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

  // The swatch is not one of them: a colour belongs with the colours.
  it("leaves the rails' colour with the other swatches", async () => {
    await renderReady();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Edge");
    expect(colours).not.toContain("Edge Width");
  });

  // The stops' row is named by the SHADER, the same way its own parameter
  // group is — see `colorsLabel`. "Ramp" is Cosmic Track's word for them:
  // colours laid along the fan, read as one continuous gradient.
  it("names the stops' row for what this shader lays them along", async () => {
    await renderReady();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Ramp");
  });

  // UNREACHABLE while every shader in the table carries these controls: the
  // absence was driven by switching to one that does not, and the built-ins
  // that did have gone. The guard is still on the group (`length > 0`).
  it.todo("is absent for a shader that has none");
});

// ---------------------------------------------------------------------------
// The Grid group and its two inks — Pixel Comets' lattice.
//
// Rendered through the ROUTE'S PROP, which is how a second shader actually
// reaches this panel: the picker that would otherwise switch to it is the
// author's alone, so a preset saved on Pixel Comets is the only way a reader ever sees
// these controls.
// ---------------------------------------------------------------------------
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

    // `ownLabel`, not the hard-coded "Track" this panel used to carry — that
    // one named the fan, and there is no fan here. Named for what the field is
    // a field OF, since the panel already has a Grid group and a bare "Field"
    // beside it read as a second name for the lattice.
    expect(screen.getByRole("group", { name: "Comet Field" })).toBeTruthy();
  });

  // The comets' own controls, in the order the table names them — and the two
  // that replaced Seed sit where it sat, between how many comets there are and
  // how far each one runs.
  //
  // Direction sits directly under Count, which is the control it is read
  // against: the two together are the field's size and its shape, and Count is
  // shared over whichever axes Direction leaves running rather than divided
  // between them.
  //
  // Seed is gone rather than moved: it hashed the lanes and did nothing else,
  // and a control whose whole job is "a different arrangement of the same
  // field" is not what these two do. The cost is that the arrangement is now
  // fixed at a given Count, which is the trade the band is worth.
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

  // Direction is the panel's one multi-toggle row: four independent choices,
  // any combination, drawn in the segmented control's rail because it is the
  // same kind of row. A single-select here would be unable to say "up and
  // left", which is half of what the control is for.
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

  // Head Stretch sits with the other bloom controls, next to the radius it
  // shapes: the two together are the ellipse, one naming its width across the
  // lane and the other how far it is drawn out along it.
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

  // Parallax sits with the other timing controls rather than with the comets'
  // own, and it earns that by what you SEE it do: it hands each comet a depth
  // and a nearer one covers more ground in the same cycle, which reads as one
  // moving faster than another. That it does so by lengthening a run is the
  // mechanism, not the control.
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

  // The point of `extraColorRows`: the major ink is a SWATCH BESIDE the minor
  // one, not a row of its own. A row each would have said the two were
  // unrelated, and spent a label and a line of the panel saying it.
  it("puts both lattice inks on one row", async () => {
    await renderPixelComets();
    const colours = labelsIn(screen.getByRole("group", { name: "Colours" }));

    expect(colours).toContain("Grid");
    expect(colours).not.toContain("Major");
  });

  // The same row, named by the other shader — and here the stops are not a
  // ramp at all: each one is a whole comet's colour, kept for that comet's
  // life, so nothing is read BETWEEN two of them. Calling that a ramp
  // described a gradient the shader never draws.
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

    // Named by ROLE rather than numbered by position: "Colour 2" would say
    // which one is on the right, and the thing worth knowing is that it is the
    // major one.
    expect(within(row).getByRole("button", { name: "Grid colour" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Major colour" })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// The Dither group — the ordered-dither controls, kept together.
//
// They are one mechanism read three ways: two strengths over a single Bayer
// matrix, and the cell size that matrix is sampled at. Scattered among the
// geometry sliders, only their names said they were related.
// ---------------------------------------------------------------------------
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

  // A shader with no dither controls must not grow an empty strip for them —
  // the same rule the Motion group follows.
  // UNREACHABLE while every shader in the table carries these controls: the
  // absence was driven by switching to one that does not, and the built-ins
  // that did have gone. The guard is still on the group (`length > 0`).
  it.todo("is absent for a shader that has none");
});

// ---------------------------------------------------------------------------
// The aspect toolbar — the frame the preset is being designed against.
//
// A preset is SHAPELESS: nothing that embeds one reads this. It is a viewing
// frame for the author (does this fan still read on a banner?) and nothing
// more — moving it neither writes to the preset nor dirties the draft.
// ---------------------------------------------------------------------------
describe("ShaderPlayground aspect toolbar", () => {
  beforeEach(() => useShaderPresetDraftStore.getState().reset());
  afterEach(cleanup);

  const aspectRail = () =>
    screen.getByRole("toolbar", { name: "Preview aspect ratio" });

  // The innermost box holding the page's two gutter controls. Found from the
  // controls rather than named by class, so what is asserted is what sits
  // together rather than what anything is called.
  const gutterRow = () => {
    const menu = screen.getByRole("button", { name: "Menu" });
    const toggle = screen.getByRole("button", { name: "Light theme" });
    return Array.from(document.querySelectorAll("div"))
      .filter((el) => el.contains(menu) && el.contains(toggle))
      .pop();
  };

  // The row is the PAGE's two controls and nothing else. The rail stood between
  // them until the row ran out of width on a phone (the ⌘K chip went under it),
  // and a control that has to be in the row on one layout and under the card on
  // another cannot live in the row's own box on either.
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

  // Which puts it in the CANVAS, beside the card it shapes — one seat in the
  // markup, and two in the stylesheet: the gutter band on a desktop, and 8px
  // under the card on a phone. WHICH of the two is CSS (`aspectRailStyle`), so
  // what is testable here is the one thing both seats need, which is the rail
  // sharing the card's box rather than the row's.
  //
  // After the row, never before it: that is the order a keyboard walks the page
  // in — the page's controls, then the preset's — and on a phone it is also the
  // order the two are read in down the screen.
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

  // SQUARE, every time. A preset records no shape of its own any more — it is
  // framed for all of them — so there is nothing to reopen in, and the neutral
  // frame is the one that shows the composition rather than a crop of it.
  it("opens square", async () => {
    await renderReady();
    expect(
      aspectRail()
        .querySelector('button[aria-pressed="true"]')
        ?.getAttribute("aria-label"),
    ).toBe("1:1");
  });

  // The frame is the PLAYGROUND's state, not the preset's — a viewing choice.
  // So it moves the rail and nothing else: the draft has no less and no more
  // unsaved work in it than it had before the press.
  it("records the shape on the draft without dirtying it", async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.click(screen.getByRole("button", { name: "4:3" }));

    expect(useShaderPresetDraftStore.getState().aspect).toBe("4/3");
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
  });

  // And it reshapes the preview, which is the point of the control: the same
  // uniforms read differently on a banner and on a poster.
  it("reshapes the preview to the chosen frame", async () => {
    const user = userEvent.setup();
    const { container } = await renderReady();
    const preset = () =>
      container.querySelector<HTMLElement>("[data-preset-stage]");

    // The card waits for the library read before it draws at all — see the
    // preloader. Until then there is no stage to measure.
    await waitFor(() => expect(preset()).not.toBeNull());
    expect(preset()?.style.getPropertyValue("--preset-w")).toBe("1");
    expect(preset()?.style.getPropertyValue("--preset-h")).toBe("1");

    await user.click(screen.getByRole("button", { name: "16:9" }));

    expect(preset()?.style.getPropertyValue("--preset-w")).toBe("16");
    expect(preset()?.style.getPropertyValue("--preset-h")).toBe("9");
  });

  // A saved preset reopens in the frame it was designed in, not in the default.
  // A saved preset opens square too — it carries a placement for every shape and
  // names none of them as the one to reopen in.
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

// ---------------------------------------------------------------------------
// Deleting a preset — the header's second control.
//
// Reset and Delete share ONE slot, and which of them is in it says what there
// is to do: while the draft has unsaved work the button undoes it, and once
// there is nothing to undo it removes the preset instead. So you can never
// reach for Reset and get Delete — in every state where Reset would do
// something, Reset is what is there.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Who the unsaved marks are for.
//
// A visitor can move every control the mounted shader has — the panel is not
// theirs to save FROM, it is theirs to play with — so a draft of theirs goes
// dirty exactly as the author's does. The mark means "work you have not
// written", and a visitor has nowhere to write it: for them it is a dot that
// appears, never resolves, and points at a save they cannot reach.
// ---------------------------------------------------------------------------
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
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await waitFor(() => expect(deleteButton()).not.toBeNull());
    expect(reset()).toBeNull();
  });

  // The moment there is work to undo, the slot goes back to being Reset —
  // which is what makes the swap safe to press blind.
  it("goes back to Reset the moment the draft is edited", async () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);
    await waitFor(() => expect(deleteButton()).not.toBeNull());

    act(() => useShaderPresetDraftStore.getState().setParam("rampLength", 4));

    expect(reset()).not.toBeNull();
    expect(deleteButton()).toBeNull();
  });

  // Nothing saved is nothing to delete: the blank route opens on a draft that
  // has never been written, and a Delete there would name no row.
  it("keeps Reset on a draft that has never been saved", async () => {
    await renderReady();

    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
    expect(reset()).not.toBeNull();
    expect(deleteButton()).toBeNull();
  });

  // A visitor cannot delete, and the server refuses them a second time.
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

  // Deleting is a deliberate "I do not want this", so the preset does not stay
  // on screen: the draft goes back to blank and the URL stops naming a row that
  // no longer exists.
  it("removes the preset and returns to a blank draft", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(
      await screen.findByRole("button", { name: "Delete preset" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

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
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteShaderPreset).not.toHaveBeenCalled();
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("preset-1");
  });

  // A failed delete must not look like a successful one: the row is still
  // there, so the playground must still be holding it.
  it("leaves the draft alone when the delete fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (deleteShaderPreset as Mock).mockRejectedValue(new Error("no"));
    render(<ShaderPlayground preset={savedShaderPreset} />);

    await user.click(
      await screen.findByRole("button", { name: "Delete preset" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteShaderPreset).toHaveBeenCalled());
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("preset-1");
    expect(window.location.pathname).toBe("/playground/shader/preset-1");
  });
});

// ---------------------------------------------------------------------------
// The wait before the preset is drawn.
//
// A preset opened by ROUTE is settled before this component renders. The bare
// route is the one that waits: a visitor arriving there is taken to the newest
// published preset once the strip has read the library, and until that read
// lands the draft holds the control table's first shader — a preset nobody
// published, shown for a round trip and then swapped out underneath them.
// ---------------------------------------------------------------------------
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

  // A library that cannot be read is an answer as much as an empty one is. A
  // page that waited forever for it would be worse than one that opens blank.
  it("gives up waiting when the library cannot be read", async () => {
    (getShaderPresets as Mock).mockRejectedValue(new Error("no"));
    render(<ShaderPlayground />);

    await waitFor(() => expect(stage()).not.toBeNull());
  });

  // The route already handed the preset down, so there is nothing to wait for —
  // and a preloader in front of a preset the server already fetched would be a
  // wait invented for its own sake.
  it("draws a routed preset straight away", () => {
    render(<ShaderPlayground preset={savedShaderPreset} />);

    expect(stage()).not.toBeNull();
  });

  // The rail waits on the same answer the preset does. Every control on it
  // reads the DRAFT, and until the library lands the draft is holding the
  // control table's first shader — so a rail drawn now is a column of numbers
  // describing a preset nobody published, which is then swapped out underneath
  // the reader a round trip later. Worse than a rail that is not there yet: a
  // reader who starts pushing those sliders loses the edit.
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

  // The one the client-side checks above cannot see.
  //
  // A hard load paints the SERVER's markup before a line of JavaScript runs, so
  // whatever the rail holds in that markup is on screen for the length of a
  // hydration — and on the server the draft has been seeded by nothing at all.
  // It is still on the control table's first shader, five colours deep, while
  // the preset being opened has two. Drawing the rail there puts another preset's
  // numbers on screen for as long as it takes the bundle to arrive, and no
  // effect — layout or otherwise — can pull them back, because none of them has
  // run yet.
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

    // Not the rail, and specifically not the numbers it would have been
    // holding — the shader defaults, which belong to no preset anybody opened.
    expect(html).not.toContain('aria-label="Preset properties"');
    for (const colour of SETTINGS.colors) {
      expect(html).not.toContain(colour.light.replace("#", "").slice(0, 6));
    }
  });
});

// ---------------------------------------------------------------------------
// Framing, per shape — the four placement controls kept one set per aspect
// ratio, so a preset can be framed one way as a poster and another as a banner.
//
// Driven through the RAIL and the sliders rather than through the store, so the
// panel and the rule behind it are tested as one thing. The rules themselves
// are `@/domain/shader-preset`'s and the store's own tests.
// ---------------------------------------------------------------------------
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

  /** The Framing group's slider for one control, read off the panel. */
  const framingSlider = (label: string) => {
    const group = screen.getByRole("group", { name: /^Framing/ });
    return within(group)
      .getAllByRole("slider")
      .find((node) =>
        node.closest("[data-field]")?.textContent?.startsWith(label),
      );
  };

  // The heading names the SHAPE, because the sliders under it apply to one. A
  // panel reading plain "Framing" beside ten other framings you cannot see
  // would be the only thing on it that lies.
  it("names the shape its placement controls apply to", async () => {
    await renderReady();

    expect(screen.getByRole("group", { name: "Framing 1:1" })).toBeTruthy();
    pick("4:3");
    expect(screen.getByRole("group", { name: "Framing 4:3" })).toBeTruthy();
  });

  // Two shapes of ONE orientation, so nothing here is the quarter turn — what
  // is under test is that each shape holds its own. Rotation rather than scale
  // because its step lands on whole numbers, where scale's grid starts at 0.01
  // and the slider would report 3.01 for a stored 3.
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

  // Turning the frame over is not a special case — the other side is a shape
  // you have not framed yet, and it opens on what you arrived with so that
  // reframing it is yours to do rather than yours to undo.
  it("carries the placement across an orientation change, unchanged", async () => {
    await renderReady();
    // From a shape that HAS another side. The playground opens square, and a
    // square is neither orientation — flipping one turns the list over and
    // leaves the card where it is.
    pick("4:3");

    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    flip("portrait");

    expect(screen.getByRole("group", { name: "Framing 3:4" })).toBeTruthy();
    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  // And then the two sides are framed apart, which is the point of the split.
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

  // A different crop of the same composition, so nothing turns.
  it("carries the placement between shapes of one orientation", async () => {
    await renderReady();

    pick("16:9");
    act(() => useShaderPresetDraftStore.getState().setFraming("rotation", 30));
    pick("4:3");

    expect(framingSlider("Rotation")?.getAttribute("aria-valuenow")).toBe("30");
  });

  // The placement is what the CANVAS is given — the split is about where a
  // value is kept, and the shader takes one object. Read off the store rather
  // than the stubbed canvas, which draws nothing in jsdom.
  it("hands the shader the placement of the shape on screen", async () => {
    await renderReady();

    act(() => useShaderPresetDraftStore.getState().setFraming("scale", 2));
    const { settings, aspect } = useShaderPresetDraftStore.getState();

    expect(shaderParamsFor(settings, aspect).scale).toBe(2);
    expect("scale" in settings.params).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The presets strip — the saved presets, along the foot of the canvas.
//
// PUBLIC. A visitor is shown the presets that have been published and can open
// any of them; what signing in adds is the add tile, which is the pane's own
// business (see `presets-pane`). What this file owns is where the strip sits
// and the band the picture gives up for it.
// ---------------------------------------------------------------------------
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

    // One commit later than the first render, deliberately: the session is
    // invisible to the server, so an admin-only node on the hydrating render
    // would be React error #418. See `useIsAdmin`.
    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  it("gives a visitor the published library, in the same place", async () => {
    (getShaderPresets as Mock).mockResolvedValue([publishedShaderPreset]);
    const { container } = await renderReady();

    await waitFor(() => expect(strip()).not.toBeNull());
    expect(container.querySelector("main > div")?.contains(strip())).toBe(true);
  });

  // The picture gives up the band the strip stands in, the way it already gives
  // up the gutter row: chrome must not preset the thing being judged.
  //
  // Reserved off whether a strip was DRAWN rather than off the session, which
  // is what makes the visitor case work — the page reads `data-presets` on the
  // pane through `:has()`, which jsdom applies no styles for, so what is
  // asserted here is that the pane says so and that the page can see it.
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

// ---------------------------------------------------------------------------
// What the author is shown on top of the playground everybody gets: the shader
// picker, and the button that puts a preset on show.
// ---------------------------------------------------------------------------
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

  // A visitor came for the preset in front of them. A picker that swapped it for
  // a bare shader would throw that preset away with nothing to get it back —
  // while every control BELOW it acts on the preset they are looking at, which
  // is the whole of what they can play with.
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

  // In the panel's own header, beside the Reset/Delete slot: all of them act on
  // the saved row behind the panel rather than on the page you are looking at.
  // The slot reads Delete here rather than Reset, because a freshly opened
  // preset has nothing left to reset — see the delete suite below.
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

  // Nothing has been written yet, so there is no row for "publish this" to
  // name. ⌘S is the one press that decides between creating a row and updating
  // one; a second control making that decision would be two doors to one room.
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
    // The row is the authority on its own state, so the button follows what
    // came back rather than a guess it made on the way out.
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

  // Publishing writes the row's own column and leaves the picture alone, so it
  // must not leave the draft claiming unsaved work — the palette would then put
  // a "discard changes?" question in front of an exit that would lose nothing.
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

  // A failed write must not look like a successful one: the strip would go on
  // showing the preset to nobody while the panel claimed it was out.
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

// ---------------------------------------------------------------------------
// Which GROUND the card is standing on. A preset holds a colour per theme, so
// the page has to choose one — and the choice belongs to the CARD alone: the
// rail, the strip and the site's own toggle stay where the visitor put them.
// ---------------------------------------------------------------------------
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

  // The draft survives a test, so a preset handed in as a prop is only adopted
  // by a store that has been put back to blank first — the same reset every
  // other block that opens through the route uses.
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

  // The whole point of the control: judge the preset on the other ground WITHOUT
  // taking the page there. Asserted against the site's theme store, which is
  // what the page's own toggle writes to.
  it("sends the card to the other ground and the site nowhere", async () => {
    const user = userEvent.setup();
    render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    await user.click(groundToggle());

    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");
    expect(mockSetMode).not.toHaveBeenCalled();
  });

  // The SITE's toggle re-aims the card every time it moves, the panel's own
  // control notwithstanding. That control is a PEEK at the other ground, not a
  // second theme the card keeps: latched, it survived the site's toggle, so a
  // page taken to the other theme and back showed the colours of the one it had
  // left. Two moves to catch it — the first agrees with the peek by luck.
  it("re-aims at the site's theme every time it changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ShaderPlayground preset={twoToned} />);
    await screen.findByRole("complementary", { name: "Preset properties" });

    // Peek at the light ground with the site still dark.
    await user.click(groundToggle());
    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");

    // The site goes light — where the card already is, so nothing moves.
    mockMode.mockReturnValue("light");
    rerender(<ShaderPlayground preset={twoToned} />);
    expect(stageColors()).toBe("#AAAAAAFF,#BBBBBBFF");

    // And back. The card has to come with it.
    mockMode.mockReturnValue("dark");
    rerender(<ShaderPlayground preset={twoToned} />);
    expect(stageColors()).toBe("#111111FF,#222222FF");
    expect(
      screen.getByRole("button", { name: "Show the light colours" }),
    ).toBeTruthy();
  });

  // The glyph names where pressing it GOES, so it is the ground you are not on.
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

  // An edit lands on the ground being LOOKED at, and leaves the other alone —
  // otherwise switching, tuning and switching back would have quietly retuned
  // the theme you never saw.
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
