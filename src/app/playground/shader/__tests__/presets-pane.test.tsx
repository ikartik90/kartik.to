// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { ShaderId } from "@/data/shader-specs";
import { shaderPresetContentFor, type ThemedColor } from "@/domain/shader-preset";
import { useShaderPresetDraftStore } from "@/store/shader-preset-draft";

// The actions are `"use server"` files importing `@/lib/env`, which validates
// DATABASE_URL at import time and throws in a run with no `.env`.
vi.mock("@/app/actions/shader-preset", () => ({
  getShaderPresets: vi.fn().mockResolvedValue([]),
  getShaderPreset: vi.fn(),
  createShaderPreset: vi.fn(),
  saveShaderPreset: vi.fn(),
  deleteShaderPreset: vi.fn(),
}));

// The stage's whole job is a webgl2 context, which jsdom has none of. A canvas
// is what the thumbnailer goes looking for, so a canvas is what it gets — the
// capture path then runs for real, end to end, into the tile.
vi.mock("../shader-stage", () => ({
  MAX_PIXELS: 1,
  layerStyle: "",
  ShaderStage: ({ spec }: { spec: { id: string } }) => (
    <canvas data-shader={spec.id} width={160} height={160} />
  ),
}));

// Who is asking. The strip is public now, so most of what follows is only true
// of one of the two — signed IN by default, because the author's is the strip
// with every control on it; the visitor's is its own block at the foot.
const mockUseSession = vi.fn();
vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: () => mockUseSession() },
}));

/** Signed in as the author, and signed out as anybody else. */
const signedIn = () =>
  mockUseSession.mockReturnValue({ data: { user: { email: "a@b.c" } } });
const signedOut = () => mockUseSession.mockReturnValue({ data: null });

// The strip navigates nowhere — it puts a preset in the draft and corrects the
// URL in place. `next/navigation` is stubbed anyway, so a stray `useRouter`
// creeping back in fails loudly rather than being answered by a real router.
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

/** Where the URL bar says we are. */
const path = () => window.location.pathname;

const { PresetsPane } = await import("../presets-pane");
const { clearThumbnailCache } = await import("../shader-preset-thumbnails");
const { getShaderPresets, createShaderPreset } = await import("@/app/actions/shader-preset");

// Parsed rather than authored: the spec table writes one colour per stop and a
// preset holds a light/dark pair each, so a fixture built from `defaultState`
// alone is not the shape the pane is handed.
const settingsFor = (shaderId: ShaderId) => ({
  ...shaderPresetContentFor(shaderId).settings,
  framing: {},
});

/**
 * A saved preset as the action hands it over.
 *
 * Published, because that is what a preset in a VISITOR's strip is — the action
 * hands them no other kind. It makes no difference to the author's strip, which
 * is shown both.
 */
const preset = (id: string, title: string | null, colors: string[]) => ({
  id,
  title,
  untitledIndex: title ? null : 1,
  shaderId: "cosmicTrack" as const,
  // One colour per stop at the call site, split into the pair a preset holds —
  // these fixtures are about WHICH preset is on screen, not about theming it.
  settings: {
    ...settingsFor("cosmicTrack"),
    colors: colors.map((color) => ({ light: color, dark: color })),
  },
  publishedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

describe("PresetsPane", () => {
  beforeEach(() => {
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

    signedIn();
    clearThumbnailCache();
    HTMLCanvasElement.prototype.toDataURL = vi.fn(
      () => "data:image/png;base64,PICTURE",
    );

    useShaderPresetDraftStore.getState().reset();
    (getShaderPresets as Mock).mockReset();
    (getShaderPresets as Mock).mockResolvedValue([]);
    (createShaderPreset as Mock).mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    window.history.replaceState(null, "", "/playground/shader");
  });
  afterEach(cleanup);

  /**
   * Whether the question is up.
   *
   * Read off the `<dialog>`'s own `open`, NOT off the words in it: the confirm
   * is always mounted and only toggles that attribute, so its title is in the
   * document whether or not anything is being asked — a text query here passes
   * either way and proves nothing.
   */
  const asking = () => !!document.querySelector("dialog")?.hasAttribute("open");

  /** The strip read left to right — scoped to it, so a modal's buttons cannot join in. */
  const tiles = () =>
    within(screen.getByRole("group", { name: "Presets" }))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));

  // The author's blank draft is theirs to keep: they arrived to make a new
  // preset, and they have both a shader picker and an add tile to do it with.
  // Opening them on their newest preset instead would take that away.
  it("leaves the author's blank draft alone", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("c", "Newest", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    await screen.findByRole("button", { name: "Newest" });
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(path()).toBe("/playground/shader");
  });

  it("offers a way to add one even with nothing saved yet", async () => {
    render(<PresetsPane />);
    await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());

    expect(screen.getByRole("button", { name: "New preset" })).toBeTruthy();
  });

  // The action hands them over newest-first and the strip shows them in that
  // order — it does not re-sort, because a second answer to "what order are
  // these in" is a second place for it to be wrong. See `getShaderPresets`.
  it("shows the saved presets in the order it is given them", async () => {
    (getShaderPresets as Mock).mockResolvedValue([
      preset("c", "Newest", ["#FFFFFFFF"]),
      preset("b", "Middle", ["#000000FF"]),
      preset("a", "Oldest", ["#FF0000FF"]),
    ]);
    render(<PresetsPane />);

    await screen.findByRole("button", { name: "Newest" });
    expect(tiles()).toEqual(["New preset", "Newest", "Middle", "Oldest"]);
  });

  it("names an untitled preset the way the palette names an untitled draft", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("a", null, ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    expect(await screen.findByRole("button", { name: "Untitled 1" })).toBeTruthy();
  });

  // The tile is painted from the preset's OWN ramp — see `shaderPresetSwatch`
  // for why it cannot be the preset itself. Two presets, so this pins "painted
  // from this one" rather than "painted"; the exact CSS is
  // `shaderPresetSwatch`'s own test, and asserting it here would only be
  // asserting how jsdom serialises a colour.
  it("paints each tile from its preset's colours", async () => {
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#2E6BFFFF", "#FFD9A0FF"]),
      preset("b", "Dawn", ["#FF4D97FF", "#12042BFF"]),
    ]);
    render(<PresetsPane />);

    const dusk = await screen.findByRole("button", { name: "Dusk" });
    const dawn = screen.getByRole("button", { name: "Dawn" });
    expect(dusk.style.background).toContain("linear-gradient");
    expect(dawn.style.background).toContain("linear-gradient");
    expect(dusk.style.background).not.toBe(dawn.style.background);
  });

  // The swatch is a stand-in. What the strip is FOR is seeing what each preset
  // actually looks like, which is a photograph of the preset taken off-screen —
  // see `preset-thumbnails` for why it cannot be a live one.
  it("replaces the ramp with a picture of the preset once one is drawn", async () => {
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#2E6BFFFF", "#FFD9A0FF"]),
    ]);
    render(<PresetsPane />);

    const tile = await screen.findByRole("button", { name: "Dusk" });
    expect(tile.style.background).toContain("linear-gradient");

    await waitFor(() =>
      expect(tile.style.backgroundImage).toContain("PICTURE"),
    );
  });

  // A save is the other thing that can change the library — the row you were
  // editing now looks different. Missing it would leave that tile showing the
  // picture the preset had before you touched it.
  it("re-reads the library when work is committed", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await waitFor(() => expect(getShaderPresets).toHaveBeenCalledOnce());

    // Mid-edit: nothing has been written, so nothing is re-read.
    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("scale", 2);
    });
    expect(getShaderPresets).toHaveBeenCalledOnce();

    // Committed — the store goes clean, exactly as a save leaves it.
    await act(async () => {
      useShaderPresetDraftStore.getState().load({
        id: "a",
        title: "Dusk",
        shaderId: "cosmicTrack",
        settings: settingsFor("cosmicTrack"),
        publishedAt: null,
      });
    });
    await waitFor(() => expect(getShaderPresets).toHaveBeenCalledTimes(2));
  });

  // --- Adding ---------------------------------------------------------------

  it("saves the draft as a new preset, and takes up editing that one", async () => {
    const user = userEvent.setup();
    (createShaderPreset as Mock).mockResolvedValue({
      id: "new-1",
      title: null,
      shaderId: "swirl",
      settings: settingsFor("swirl"),
    });
    render(<PresetsPane />);

    useShaderPresetDraftStore.getState().selectShader("swirl");
    await user.click(screen.getByRole("button", { name: "New preset" }));

    await waitFor(() =>
      expect(createShaderPreset).toHaveBeenCalledWith(
        expect.objectContaining({ shaderId: "swirl" }),
      ),
    );
    // Adopted: the draft is now that preset, its URL says so, and the work is
    // no longer unsaved. The URL is corrected in PLACE — asking the router for
    // the preset's route would fetch a preset the page is already holding and
    // remount the playground around the answer.
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("new-1");
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(path()).toBe("/playground/shader/new-1");
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("leaves the draft alone when the save fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    (createShaderPreset as Mock).mockRejectedValue(new Error("no"));
    render(<PresetsPane />);

    await user.click(screen.getByRole("button", { name: "New preset" }));

    await waitFor(() => expect(createShaderPreset).toHaveBeenCalled());
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(path()).toBe("/playground/shader");
  });

  // --- Opening --------------------------------------------------------------

  // Opening one is a change of what the page HOLDS, not a trip to another page:
  // the strip already has the whole preset, so it hands it to the draft and
  // corrects the URL. Going through the router would fetch what is already in
  // hand and remount the playground — the shader torn down and recompiled —
  // around an identical answer.
  it("opens a preset into the draft without navigating", async () => {
    const user = userEvent.setup();
    const dusk = preset("a", "Dusk", ["#FFFFFFFF"]);
    (getShaderPresets as Mock).mockResolvedValue([dusk]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
    expect(useShaderPresetDraftStore.getState().shaderId).toBe("cosmicTrack");
    // Opened clean: adopting a saved preset is not an edit to it.
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    expect(path()).toBe("/playground/shader/a");
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // The rule the palette already follows in withholding a destination you are
  // already on: the row would do nothing, and a control that does nothing reads
  // as a broken one.
  it("marks the open preset as current, and does not reopen it", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    useShaderPresetDraftStore.getState().load({
      id: "a",
      title: "Dusk",
      shaderId: "cosmicTrack",
      settings: settingsFor("cosmicTrack"),
      publishedAt: null,
    });
    render(<PresetsPane />);

    const tile = await screen.findByRole("button", { name: "Dusk" });
    expect(tile.getAttribute("aria-current")).toBe("true");

    await user.click(tile);
    expect(path()).toBe("/playground/shader");
  });

  // --- Unsaved work ---------------------------------------------------------

  // Opening a preset LEAVES what is being tuned. One stray press on a strip of
  // near-identical tiles would otherwise throw away an afternoon.
  // Opening one no longer asks, and that is the point of the strip: the draft
  // you were tuning is SET ASIDE rather than thrown away, so a preset can be
  // opened to look at while another is in progress. The question survives on
  // the way out of the editor, where work actually goes missing.
  it("opens a preset over unsaved work without asking", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    await user.click(await screen.findByRole("button", { name: "Dusk" }));

    expect(asking()).toBe(false);
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
    expect(path()).toBe("/playground/shader/a");
  });

  it("hands the work back when the draft is taken up again", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#FFFFFFFF"]),
      preset("b", "Dawn", ["#000000FF"]),
    ]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    await user.click(screen.getByRole("button", { name: "Dawn" }));
    await user.click(screen.getByRole("button", { name: "Dusk" }));

    expect(useShaderPresetDraftStore.getState().settings.params.rampLength).toBe(4);
    expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
  });

  // --- Telling the page it may draw -----------------------------------------
  //
  // The page holds the preset AND the properties rail back on this signal, so
  // what it has to mean is "the draft is holding what it is going to hold" —
  // not "the fetch came back". Between those two moments the draft is still on
  // the control table's first shader, and a rail drawn there is a column of
  // numbers belonging to a preset nobody published.
  it("does not report settled until the draft holds the preset it opens on", async () => {
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);

    // Read AT THE MOMENT of the call, not after — the whole question is what is
    // true when the page is told it may draw.
    let idWhenTold: string | null | undefined;
    let coloursWhenTold: ThemedColor[] | undefined;
    const onSettled = vi.fn(() => {
      const draft = useShaderPresetDraftStore.getState();
      idWhenTold = draft.shaderPresetId;
      coloursWhenTold = draft.settings.colors;
    });

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());

    expect(idWhenTold).toBe("a");
    expect(coloursWhenTold).toEqual([
      { light: "#FFFFFFFF", dark: "#FFFFFFFF" },
    ]);
  });

  // The author is not moved onto anybody's preset — their blank draft IS the
  // final state, so the signal must not wait for an adoption that never comes.
  it("reports settled for the author, who is left on their own draft", async () => {
    signedIn();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    const onSettled = vi.fn();

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
  });

  // Nothing to adopt is an answer too, and the page must not wait forever on
  // it.
  it("reports settled when the library cannot be read", async () => {
    signedOut();
    (getShaderPresets as Mock).mockRejectedValue(new Error("no"));
    const onSettled = vi.fn();

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
  });

  it("reports settled only once, however the strip re-reads", async () => {
    signedOut();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    const onSettled = vi.fn();

    render(<PresetsPane onSettled={onSettled} />);
    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  // --- What the tiles mark --------------------------------------------------

  /** Whether a tile carries the unsaved mark. */
  const marked = (label: string) =>
    !!screen
      .getByRole("button", { name: label })
      .parentElement?.querySelector("[data-unsaved]");

  it("marks a preset holding work you cannot see", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([
      preset("a", "Dusk", ["#FFFFFFFF"]),
      preset("b", "Dawn", ["#000000FF"]),
    ]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    await user.click(screen.getByRole("button", { name: "Dawn" }));

    expect(marked("Dusk")).toBe(true);
    expect(marked("Dawn")).toBe(false);
  });

  it("marks the preset on screen once it is touched", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);

    await user.click(await screen.findByRole("button", { name: "Dusk" }));
    expect(marked("Dusk")).toBe(false);

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    expect(marked("Dusk")).toBe(true);
  });

  // --- The never-saved draft ------------------------------------------------
  //
  // It has no row and so no id, but it is as openable as any preset — and
  // without a tile, work tuned before the first save would be the one thing the
  // strip could not give back.
  it("gives the unsaved new draft a tile of its own, marked", async () => {
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await screen.findByRole("button", { name: "Dusk" });

    expect(screen.queryByRole("button", { name: "Unsaved draft" })).toBeNull();

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    expect(marked("Unsaved draft")).toBe(true);
  });

  it("takes the new draft back up, with its work", async () => {
    const user = userEvent.setup();
    (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
    render(<PresetsPane />);
    await screen.findByRole("button", { name: "Dusk" });

    await act(async () => {
      useShaderPresetDraftStore.getState().setParam("rampLength", 4);
    });
    await user.click(screen.getByRole("button", { name: "Dusk" }));
    await user.click(screen.getByRole("button", { name: "Unsaved draft" }));

    expect(useShaderPresetDraftStore.getState().shaderPresetId).toBeNull();
    expect(useShaderPresetDraftStore.getState().settings.params.rampLength).toBe(4);
    expect(path()).toBe("/playground/shader");
  });

  // --- Signed out -----------------------------------------------------------
  //
  // The playground is public and so is the strip. What a visitor gets is the
  // PUBLISHED library — `getShaderPresets` is the one that decides that, and is
  // already mocked here, so what these pin is the half this component owns: the
  // add tile is the author's, and a strip with nothing in it is no strip.
  describe("for a visitor", () => {
    beforeEach(signedOut);

    // A visitor can move the controls — the preset is theirs to play with — so
    // their draft goes dirty like anyone's. The mark means "work you have not
    // written" and they have nowhere to write it, so for them it is a dot that
    // appears and never resolves.
    it("marks no tile, having no save to be behind on", async () => {
      const user = userEvent.setup();
      (getShaderPresets as Mock).mockResolvedValue([
        preset("a", "Dusk", ["#FFFFFFFF"]),
        preset("b", "Dawn", ["#000000FF"]),
      ]);
      render(<PresetsPane />);

      await user.click(await screen.findByRole("button", { name: "Dusk" }));
      await act(async () => {
        useShaderPresetDraftStore.getState().setParam("rampLength", 4);
      });
      expect(useShaderPresetDraftStore.getState().isDirty).toBe(true);
      expect(marked("Dusk")).toBe(false);

      await user.click(screen.getByRole("button", { name: "Dawn" }));
      expect(marked("Dusk")).toBe(false);
    });


    it("offers no way to add one", async () => {
      (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
      render(<PresetsPane />);

      await screen.findByRole("button", { name: "Dusk" });
      expect(screen.queryByRole("button", { name: "New preset" })).toBeNull();
    });

    // Opening one is the same act it is for the author: the preset lands in the
    // draft and every control on the page is theirs to push around. What is
    // missing is only the writing.
    it("still opens a preset into the draft", async () => {
      const user = userEvent.setup();
      (getShaderPresets as Mock).mockResolvedValue([preset("a", "Dusk", ["#FFFFFFFF"])]);
      render(<PresetsPane />);

      await user.click(await screen.findByRole("button", { name: "Dusk" }));

      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
      expect(path()).toBe("/playground/shader/a");
    });

    // What a visitor ARRIVES on. They cannot pick a shader and cannot save one,
    // so a blank draft is not a starting point for them — it is a preset nobody
    // published, sitting above a strip whose one tile reads as unselected. The
    // newest published preset is the only honest thing to open on.
    it("opens on the newest published preset", async () => {
      (getShaderPresets as Mock).mockResolvedValue([
        preset("c", "Newest", ["#FFFFFFFF"]),
        preset("a", "Oldest", ["#FF0000FF"]),
      ]);
      render(<PresetsPane />);

      await waitFor(() =>
        expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("c"),
      );
      // The same act as pressing the tile, which is what makes the tile read as
      // the one open rather than leaving the strip looking untouched.
      expect(
        (await screen.findByRole("button", { name: "Newest" })).getAttribute(
          "aria-current",
        ),
      ).toBe("true");
      expect(path()).toBe("/playground/shader/c");
      expect(useShaderPresetDraftStore.getState().isDirty).toBe(false);
    });

    // The route already handed the playground a preset, so there is nothing to
    // choose — arriving at `/playground/shader/<id>` must not be redirected to
    // whatever happens to be newest.
    it("leaves a preset the route was opened on alone", async () => {
      (getShaderPresets as Mock).mockResolvedValue([preset("c", "Newest", ["#FFFFFFFF"])]);
      useShaderPresetDraftStore.getState().load({
        id: "a",
        title: "Oldest",
        shaderId: "cosmicTrack",
        settings: settingsFor("cosmicTrack"),
        publishedAt: new Date("2026-01-01"),
      });
      render(<PresetsPane />);

      await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
      expect(useShaderPresetDraftStore.getState().shaderPresetId).toBe("a");
    });

    // No library, so no bar: the author always has the add tile and so always
    // has a strip, but a rounded strip holding nothing is chrome describing an
    // absence — and the page reserves its band off whether one was drawn.
    it("draws no strip at all when nothing has been published", async () => {
      const { container } = render(<PresetsPane />);

      await waitFor(() => expect(getShaderPresets).toHaveBeenCalled());
      expect(screen.queryByRole("group", { name: "Presets" })).toBeNull();
      expect(container.querySelector("[data-presets]")).toBeNull();
    });
  });
});
